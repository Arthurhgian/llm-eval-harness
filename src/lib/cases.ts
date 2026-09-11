import { readFileSync } from 'fs';
import type { DocId } from './docs';
import { ALL_DOC_IDS, loadDoc } from './docs';

// The five kinds from docs/sut-design.md §2, plus "Answerable" for
// questions that aren't one of the four unanswerable kinds. One array, so
// this list and that table can't drift apart silently.
export const CATEGORIES = [
  'Answerable',
  'Near-miss',
  'Depends on the reader',
  'Underspecified',
  'Out of scope',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type AssertionType = 'exact' | 'contains' | 'json_field';

export interface AssertionData {
  type: AssertionType;
  value?: string;
  field?: string;
  caseInsensitive?: boolean;
}

export interface CaseData {
  id: string;
  category: Category;
  sourceDoc: DocId;
  input: string;
  expected: AssertionData[];
  skipReason?: string;
}

export class CaseValidationError extends Error {
  constructor(public readonly violations: string[]) {
    super(`case data failed validation:\n${violations.map((v) => `  - ${v}`).join('\n')}`);
    this.name = 'CaseValidationError';
  }
}

// Everything below is a check the TypeScript compiler used to give for
// free when these were inline `Case[]` literals — discriminated-union
// shape, at least. id uniqueness was never actually compiler-enforced
// even then (nothing stops two object literals sharing an id); it held
// only because a human could eyeball a fifteen-entry array. Neither holds
// for JSON, which the compiler never sees at all. This function is what
// replaces both: the checks a type system gave for free, and the check
// nothing ever really gave.
export function validateCases(cases: unknown): CaseData[] {
  if (!Array.isArray(cases)) {
    throw new CaseValidationError(['top level is not an array']);
  }

  const violations: string[] = [];
  const seenIds = new Set<string>();

  cases.forEach((raw, i) => {
    const c = raw as Partial<CaseData>;
    const label = typeof c.id === 'string' && c.id.length > 0 ? c.id : `#${i}`;

    if (typeof c.id !== 'string' || c.id.length === 0) {
      violations.push(`${label}: id is missing or not a non-empty string`);
    } else if (seenIds.has(c.id)) {
      violations.push(`${label}: duplicate id`);
    } else {
      seenIds.add(c.id);
    }

    if (!(CATEGORIES as readonly string[]).includes(c.category as string)) {
      violations.push(
        `${label}: category ${JSON.stringify(c.category)} is not one of ${CATEGORIES.join(', ')}`,
      );
    }

    if (!(ALL_DOC_IDS as readonly string[]).includes(c.sourceDoc as string)) {
      violations.push(
        `${label}: sourceDoc ${JSON.stringify(c.sourceDoc)} is not a known doc id (${ALL_DOC_IDS.join(', ')})`,
      );
    }

    if (typeof c.input !== 'string' || c.input.length === 0) {
      violations.push(`${label}: input is missing or not a non-empty string`);
    }

    if (!Array.isArray(c.expected)) {
      violations.push(`${label}: expected is missing or not an array`);
      return;
    }

    const isEmpty = c.expected.length === 0;
    const hasSkipReason = typeof c.skipReason === 'string' && c.skipReason.length > 0;
    if (isEmpty && !hasSkipReason) {
      violations.push(`${label}: expected is empty but skipReason is missing`);
    }
    if (!isEmpty && hasSkipReason) {
      violations.push(
        `${label}: expected is non-empty but skipReason is set — a case can't be both live and skipped`,
      );
    }

    c.expected.forEach((rawAssertion, j) => {
      const a = rawAssertion as Partial<AssertionData>;
      if (a.type !== 'exact' && a.type !== 'contains' && a.type !== 'json_field') {
        violations.push(`${label}: expected[${j}] has unknown type ${JSON.stringify(a.type)}`);
        return;
      }
      if ((a.type === 'exact' || a.type === 'contains') && typeof a.value !== 'string') {
        violations.push(`${label}: expected[${j}] (${a.type}) is missing string "value"`);
      }
      if (a.type === 'json_field' && typeof a.field !== 'string') {
        violations.push(`${label}: expected[${j}] (json_field) is missing string "field"`);
      }
    });
  });

  if (violations.length > 0) {
    throw new CaseValidationError(violations);
  }

  return cases as CaseData[];
}

// Reads and validates fixtures/cases.json (or a given path).
//
// 11 Sep 2026 — decided now, before any runner calls this in anger: a
// malformed cases.json crashes the process. It does not become `unjudged`.
// `unjudged` means a specific case ran, got a real response, and the
// check on that response broke — it's a fact about one case. A file that
// won't parse or won't validate isn't a fact about any case; there are no
// cases yet, so there's nothing to count, bucket, or report. Folding it
// into `unjudged` would print a report that looks like "some cases had
// judging trouble" when the true state is "the run never started" — the
// same conflation the passed/failed/errored split exists to prevent,
// recurring one layer up, at the file instead of the case. This is a
// fixture defect, not a test result, so JSON.parse and validateCases are
// both left to throw uncaught here — no try/catch, on purpose — and the
// process exits loud and non-zero, which is what should happen when the
// data is broken, not the thing the data is testing.
export function loadCases(path = 'fixtures/cases.json'): CaseData[] {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  return validateCases(raw);
}

// Resolves a case's sourceDoc to the document's content. A thin wrapper,
// deliberately — this module owns case *shape*, not doc *storage*, so it
// delegates to the doc registry rather than re-deciding what happens for
// an unwritten doc. A case naming D4 (q09, today) throws
// DocNotWrittenError here exactly as it would calling loadDoc directly;
// callers that mean to treat that as `skipped` catch it specifically, the
// same way src/rung3.ts already does for the doc-existence check.
export function resolveContext(sourceDoc: DocId): string {
  return loadDoc(sourceDoc);
}
