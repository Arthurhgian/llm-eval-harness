// Runs the real loader against the real fixtures/cases.json, then proves
// each check in validateCases() can actually catch what it claims to —
// same discipline as src/rung3.ts's selfTest(): a check nobody has shown
// can fail is not a check, and a check that rejects everything (including
// valid data) is exactly as useless as one that rejects nothing.
import { loadCases, validateCases, resolveContext, CaseValidationError } from '../src/lib/cases';
import { DocNotWrittenError } from '../src/lib/docs';

function expectInvalid(label: string, cases: unknown[]) {
  try {
    validateCases(cases);
    console.log(`${label} -> BROKEN (expected a validation error, got none)`);
  } catch (err) {
    const ok = err instanceof CaseValidationError;
    console.log(`${label} -> ${ok ? 'OK' : 'BROKEN'}${ok ? '' : ` (threw ${String(err)}, not CaseValidationError)`}`);
  }
}

function expectValid(label: string, cases: unknown[]) {
  try {
    validateCases(cases);
    console.log(`${label} -> OK`);
  } catch (err) {
    console.log(`${label} -> BROKEN (rejected valid data):`, err);
  }
}

const base = {
  id: 'x1',
  category: 'Answerable',
  sourceDoc: 'D1',
  input: 'test question',
  expected: [{ type: 'contains', value: 'foo' }],
};

console.log('--- real fixtures/cases.json ---');
try {
  const cases = loadCases();
  console.log(`fixtures/cases.json -> OK (${cases.length} cases, no violations)`);
} catch (err) {
  console.log('fixtures/cases.json -> BROKEN:', err);
}
console.log('');

console.log('--- falsifiability: each check must actually reject a violation ---');
expectInvalid('duplicate id', [base, { ...base }]);
expectInvalid('unknown category', [{ ...base, category: 'Maybe' }]);
expectInvalid('unknown sourceDoc', [{ ...base, sourceDoc: 'D9' }]);
expectInvalid('expected empty without skipReason', [{ ...base, expected: [] }]);
expectInvalid('expected non-empty with skipReason set', [{ ...base, skipReason: 'blocked' }]);
expectInvalid('assertion with unknown type', [{ ...base, expected: [{ type: 'regex', value: 'x' }] }]);
expectInvalid('contains assertion missing value', [{ ...base, expected: [{ type: 'contains' }] }]);
expectInvalid('json_field assertion missing field', [{ ...base, expected: [{ type: 'json_field' }] }]);
console.log('');

console.log('--- positive controls: valid data must NOT be rejected ---');
expectValid('ordinary live case', [base]);
expectValid('valid skipped case (empty expected + skipReason)', [
  { ...base, expected: [], skipReason: 'blocked: reason' },
]);
expectValid('exact assertion with value', [{ ...base, expected: [{ type: 'exact', value: 'foo' }] }]);
expectValid('json_field assertion with field', [
  { ...base, expected: [{ type: 'json_field', field: 'foo' }] },
]);
expectValid('sourceDoc naming an unwritten doc (D4) is a valid id, not a violation', [
  { ...base, sourceDoc: 'D4' },
]);
console.log('');

console.log('--- resolveContext: sourceDoc -> contents ---');
const d1Content = resolveContext('D1');
console.log(
  'resolveContext("D1") returns real content ->',
  d1Content.length > 0 ? 'OK' : 'BROKEN',
  `(${d1Content.length} chars)`,
);
try {
  resolveContext('D4');
  console.log('resolveContext("D4") -> BROKEN (expected DocNotWrittenError, got none)');
} catch (err) {
  const ok = err instanceof DocNotWrittenError;
  console.log(`resolveContext("D4") throws DocNotWrittenError -> ${ok ? 'OK' : 'BROKEN'}`);
}
