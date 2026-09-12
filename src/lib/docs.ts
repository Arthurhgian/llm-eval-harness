import { readFileSync } from 'fs';

// Every id docs/sut-design.md §3 has named. All five now resolve to a real
// file (D4 was the last, written 12 Sep 2026) — "nameable" (this type) and
// "written" (the map below) used to be two different facts while D4 sat in
// the type with no entry in the map; they've now converged, but the type
// stays independent of the map's contents rather than being derived from
// its keys, so a future doc can still be named here before its file exists,
// the same way D4 was.
export type DocId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

// The type above is compile-time only, erased at runtime — no help
// validating a DocId that arrived as a plain string from JSON, which is
// exactly the situation fixtures/cases.json is in. One array, so this list
// and the type above can't drift apart silently the way two independently
// maintained lists could.
export const ALL_DOC_IDS: readonly DocId[] = ['D1', 'D2', 'D3', 'D4', 'D5'];

// Exactly the docs that exist today — currently all five. A doc named in
// the type above but not yet written stays absent as a key here, not
// present with a null or empty value, the way D4 was until 12 Sep 2026:
// absence from a Map is a real, checkable "not found".
const DOC_PATHS = new Map<DocId, string>([
  ['D1', 'corpus/d1-mqtt-topics-and-messaging.md'],
  ['D2', 'corpus/d2-data-lifecycle-and-retention.md'],
  ['D3', 'corpus/d3-device-onboarding-and-connectivity.md'],
  ['D4', 'corpus/d4-api-reference.md'],
  ['D5', 'corpus/d5-platform-architecture-and-scope.md'],
]);

const cache = new Map<DocId, string>();

// Thrown for a DocId with no file behind it yet. Unreachable for all five
// current ids now that D4 is written (12 Sep 2026) — kept, not deleted,
// for the next doc named in the type before its file exists, the same
// state D4 was in from 11 Sep to 12 Sep. Deliberately a distinct, named
// error: a thrown Node ENOENT from a registered-but-wrong path (a typo in
// DOC_PATHS, a moved or deleted file) is a different problem — a real bug
// in this module, not a known gap — and must not be caught by the same
// handler as "not written yet". Callers that mean to treat "not written"
// as `skipped` should catch DocNotWrittenError specifically, not Error.
export class DocNotWrittenError extends Error {
  constructor(public readonly id: DocId) {
    super(`${id} has no file yet — see docs/sut-design.md §3.`);
    this.name = 'DocNotWrittenError';
  }
}

// True if `id` currently resolves to a file. The check a case runner uses
// to decide `skipped` — known in advance — before ever calling loadDoc and
// risking a thrown error mid-run, the same "judgeability before the call"
// discipline src/rung3.ts already applies to assertions.
export function docExists(id: DocId): boolean {
  return DOC_PATHS.has(id);
}

// Loads and caches a doc's content by id. Never returns undefined or an
// empty string for a missing doc — that would let a case run against no
// context and get graded on nothing, silently. Throws DocNotWrittenError
// instead; check docExists() first to avoid the throw entirely.
export function loadDoc(id: DocId): string {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  const path = DOC_PATHS.get(id);
  if (path === undefined) {
    throw new DocNotWrittenError(id);
  }

  const content = readFileSync(path, 'utf-8');
  cache.set(id, content);
  return content;
}
