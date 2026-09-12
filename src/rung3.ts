import { readFileSync } from 'fs';
import { client, MODEL_ID, INPUT_PRICE_PER_MTOK, OUTPUT_PRICE_PER_MTOK } from './lib/model';
import { loadDoc, docExists } from './lib/docs';
import { loadCases, resolveContext, type AssertionData, type CaseData } from './lib/cases';

// Case-by-case reasoning, the three design decisions behind this file's
// unjudged/skipped split and precedence rule, and the per-assertion notes:
// docs/case-design.md. Case data itself lives in fixtures/cases.json,
// loaded and validated by src/lib/cases.ts — nothing about a case's shape
// is defined in this file anymore.

// ---- Assertions -------------------------------------------------------

type AssertionVerdict =
  | { verdict: 'pass' }
  | { verdict: 'fail'; reason: string }
  | { verdict: 'unjudged'; reason: string };

// The harness dispatches on `type` here — one place, not a branch per case
// in the run loop. Anything that keeps this from producing a clean
// pass/fail (wrong type, malformed assertion, a structural check handed
// prose) is caught and returned as `unjudged`, not thrown and not silently
// passed.
function runAssertion(text: string, a: AssertionData): AssertionVerdict {
  try {
    switch (a.type) {
      case 'exact': {
        if (typeof a.value !== 'string') throw new Error('exact assertion missing value');
        return text.trim() === a.value
          ? { verdict: 'pass' }
          : { verdict: 'fail', reason: `expected exactly "${a.value}"` };
      }
      case 'contains': {
        if (typeof a.value !== 'string') throw new Error('contains assertion missing value');
        const ci = a.caseInsensitive !== false;
        const haystack = ci ? text.toLowerCase() : text;
        const needle = ci ? a.value.toLowerCase() : a.value;
        return haystack.includes(needle)
          ? { verdict: 'pass' }
          : { verdict: 'fail', reason: `missing substring "${a.value}"` };
      }
      case 'json_field': {
        if (typeof a.field !== 'string') throw new Error('json_field assertion missing field');
        const parsed: unknown = JSON.parse(text); // throws on prose — caught below, not a crash
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('parsed JSON is not an object');
        }
        return a.field in parsed
          ? { verdict: 'pass' }
          : { verdict: 'fail', reason: `missing JSON field "${a.field}"` };
      }
      default: {
        // AssertionData is a flat interface (JSON has no discriminated
        // unions), not a union type — so it's a.type that narrows to
        // never here, exhaustiveness-checked, not the whole object. In
        // practice unreachable: src/lib/cases.ts's validateCases() already
        // rejects any type outside this switch before a case ever gets
        // here — this default is the runtime backstop if that's ever
        // bypassed, not the primary guard.
        const exhaustive: never = a.type;
        return { verdict: 'unjudged', reason: `unknown assertion type: ${JSON.stringify(exhaustive)}` };
      }
    }
  } catch (err) {
    // The API call already succeeded by the time this runs — real text
    // exists. A throw here means the ASSERTION couldn't evaluate it (wrong
    // type for this response, malformed check), which is a different
    // problem than the platform failing to answer, and a different problem
    // again from never having attached an assertion at all (see `skipped`
    // below). Filing it as `errored` would blend a test-authoring defect
    // with a platform failure — the exact conflation the Reporting rule
    // (docs/method.md) exists to prevent.
    return { verdict: 'unjudged', reason: err instanceof Error ? err.message : String(err) };
  }
}

// unjudged beats failed beats passed — decided once, here, not left to
// whichever assertion happens to run first. All assertions are evaluated
// (no early return), because the precedence is a property of the whole
// set, not of iteration order.
function evaluateCase(text: string, expected: AssertionData[]): { verdict: 'passed' | 'failed'; reason?: string } | { verdict: 'unjudged'; reason: string } {
  const results = expected.map((a) => runAssertion(text, a));

  const unjudgedResult = results.find((r) => r.verdict === 'unjudged');
  if (unjudgedResult) return { verdict: 'unjudged', reason: unjudgedResult.reason };

  const failResult = results.find((r) => r.verdict === 'fail');
  if (failResult) return { verdict: 'failed', reason: failResult.reason };

  return { verdict: 'passed' };
}

// ---- Cases --------------------------------------------------------------
//
// Case data used to be inline Case[] literals here — id, input, context,
// expected, skipReason, one array to eyeball. It's now fixtures/cases.json,
// loaded and validated by src/lib/cases.ts (CaseData: id, category,
// sourceDoc, input, expected, skipReason). Growing the suite is a JSON
// edit, not a code change — nothing below this comment should need to know
// how many cases there are or what any of them say.

const ASSISTANT_PROMPT = readFileSync('prompts/assistant.txt', 'utf-8');

function buildPrompt(context: string, question: string): string {
  return ASSISTANT_PROMPT.replace('{{context}}', context).replace('{{question}}', question);
}

const CASES: CaseData[] = loadCases();

// ---- json_field / exact self-test ----------------------------------------
//
// json_field now has a real case (q21, added once D4 existed): D4's error
// envelope is a verbatim JSON body, so asking what the API returns for an
// unknown device EUI has a genuine machine-readable shape to check against
// — not faked to give the type coverage. Whether a response that wraps
// that JSON in prose counts as `failed` or `unjudged` is decided in
// docs/labelling-rules.md, not here; this file's behaviour (any JSON.parse
// failure is `unjudged`) already matches that decision. `exact` still has
// no real case, for a quieter reason: the one place it looked like a fit
// (q02's refusal) doesn't stay exact once the model adds the gap
// explanation and a follow-up question, which is exactly why q02 uses
// `contains` instead. Both types are proven correct here, directly,
// instead of bent to fit a case that doesn't want them.
function selfTest() {
  const exactPass = runAssertion('Not in the documentation.', { type: 'exact', value: 'Not in the documentation.' });
  const exactFail = runAssertion('Not in the documentation, sadly.', {
    type: 'exact',
    value: 'Not in the documentation.',
  });

  const jsonPass = runAssertion('{"status": "offline", "reason": "lwt"}', {
    type: 'json_field',
    field: 'reason',
  });
  const jsonFail = runAssertion('{"status": "offline"}', { type: 'json_field', field: 'reason' });
  const jsonUnjudged = runAssertion('Not in the documentation.', { type: 'json_field', field: 'reason' });

  // Precedence check: one fail + one unjudged in the same list must report
  // unjudged, regardless of which is listed first.
  const failThenUnjudged = evaluateCase('nope', [
    { type: 'exact', value: 'yes' },
    { type: 'json_field', field: 'x' },
  ]);
  const unjudgedThenFail = evaluateCase('nope', [
    { type: 'json_field', field: 'x' },
    { type: 'exact', value: 'yes' },
  ]);

  // Falsifiability check for q11/q12's shape, prompted by a review that
  // caught `contains "register"` passing on any input because q12's own
  // question text contains "register" — a check that echoes the question
  // can never fail. q12's real assertions must fail on a response that
  // hedges without ever naming the plan or a real number from the table.
  const q12StyleOnGenericNonAnswer = evaluateCase(
    "I don't have that information — please contact support for your account's specific limits.",
    [
      { type: 'contains', value: 'your plan' },
      { type: 'contains', value: '100,000' },
    ],
  );

  console.log('--- self-test: exact, json_field, precedence ---');
  console.log('exact, matching text       ->', exactPass.verdict, exactPass.verdict === 'pass' ? 'OK' : 'BROKEN');
  console.log('exact, extra text          ->', exactFail.verdict, exactFail.verdict === 'fail' ? 'OK' : 'BROKEN');
  console.log('json_field, field present  ->', jsonPass.verdict, jsonPass.verdict === 'pass' ? 'OK' : 'BROKEN');
  console.log('json_field, field missing  ->', jsonFail.verdict, jsonFail.verdict === 'fail' ? 'OK' : 'BROKEN');
  console.log(
    'json_field, prose not JSON ->',
    jsonUnjudged.verdict,
    jsonUnjudged.verdict === 'unjudged' ? 'OK' : 'BROKEN',
  );
  console.log(
    'fail listed before unjudged ->',
    failThenUnjudged.verdict,
    failThenUnjudged.verdict === 'unjudged' ? 'OK' : 'BROKEN',
  );
  console.log(
    'unjudged listed before fail ->',
    unjudgedThenFail.verdict,
    unjudgedThenFail.verdict === 'unjudged' ? 'OK' : 'BROKEN',
  );
  console.log(
    'q12-style check on a generic non-answer ->',
    q12StyleOnGenericNonAnswer.verdict,
    q12StyleOnGenericNonAnswer.verdict === 'failed' ? 'OK' : 'BROKEN',
  );

  // Doc registry: D1 and D4 both load (proves the map resolves a real id
  // to real content for the oldest and newest document alike), and
  // docExists() agrees with loadDoc() for both rather than being a second,
  // driftable source of truth for the same fact. D4 used to be the case
  // that proved DocNotWrittenError fires instead of a bare Node
  // ENOENT — that check is gone as of 12 Sep 2026, not weakened: D4 is
  // written, so there is no longer a doc in ALL_DOC_IDS this repo could
  // use to exercise "not written yet" without inventing a fake id the type
  // doesn't have. DocNotWrittenError stays in src/lib/docs.ts for the next
  // doc that arrives the same way D4 did; it has nothing left to be tested
  // against here until then.
  const d1Loaded = loadDoc('D1').length > 0;
  const d4Loaded = loadDoc('D4').length > 0;
  const docExistsAgreesWithLoadDoc = docExists('D1') === true && docExists('D4') === true;

  console.log('D1 loads via the registry  ->', d1Loaded ? 'pass' : 'fail', d1Loaded ? 'OK' : 'BROKEN');
  console.log('D4 loads via the registry  ->', d4Loaded ? 'pass' : 'fail', d4Loaded ? 'OK' : 'BROKEN');
  console.log(
    'docExists agrees with loadDoc ->',
    docExistsAgreesWithLoadDoc ? 'pass' : 'fail',
    docExistsAgreesWithLoadDoc ? 'OK' : 'BROKEN',
  );
  console.log('');
}

// ---- Run ------------------------------------------------------------------

let passed = 0;
let failed = 0;
let errored = 0;
let unjudged = 0;
let skipped = 0;
let totalCost = 0;

async function runCase(c: CaseData) {
  // Judgeability is known before any call is made — check it first. A case
  // with nothing to check it against never reaches the API: no cost, no
  // wall-clock, and it lands in `skipped`, not `unjudged`. Because this
  // check comes first, resolveContext() below never runs for a skipped
  // case — a live case naming an unwritten doc would still throw
  // DocNotWrittenError uncaught, which is correct: a case marked live
  // (non-empty expected) whose doc doesn't exist is a data inconsistency,
  // not a run-time judgment call, and belongs with cases.json's other
  // fail-loud defects, not folded into skipped or unjudged.
  if (c.expected.length === 0) {
    skipped++;
    console.log(`--- ${c.id} ---`);
    console.log('Input:', c.input);
    console.log('Verdict: skipped');
    console.log('Reason:', c.skipReason ?? 'no assertion attached');
    console.log('');
    return;
  }

  const start = Date.now();
  const prompt = buildPrompt(resolveContext(c.sourceDoc), c.input);

  // try wraps the API call only — same discipline as rung2. A downstream
  // bug in evaluateCase must crash loudly, not get filed as `errored`.
  let message;
  try {
    message = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    errored++;
    console.log(`--- ${c.id} ---`);
    console.log('Input:', c.input);
    console.log('Verdict: errored');
    console.log('Error:', err instanceof Error ? err.message : String(err));
    console.log('');
    return;
  }

  const end = Date.now();

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const inputCost = (message.usage.input_tokens / 1_000_000) * INPUT_PRICE_PER_MTOK;
  const outputCost = (message.usage.output_tokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
  const caseCost = inputCost + outputCost;
  totalCost += caseCost;

  const { verdict, reason } = evaluateCase(text, c.expected);
  if (verdict === 'passed') passed++;
  else if (verdict === 'failed') failed++;
  else unjudged++;

  console.log(`--- ${c.id} ---`);
  console.log('Input:', c.input);
  console.log('Response text:', text);
  console.log('Verdict:', verdict, reason ? `(${reason})` : '');
  console.log('Elapsed ms:', end - start);
  console.log('Cost: $' + caseCost.toFixed(6));
  console.log('');
}

async function main() {
  selfTest();

  for (const c of CASES) {
    await runCase(c);
  }

  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log('Errored:', errored);
  console.log('Unjudged:', unjudged);
  console.log('Skipped:', skipped);
  console.log('Total cost: $' + totalCost.toFixed(6));

  const total = passed + failed + errored + unjudged + skipped;
  const holds = total === CASES.length;
  console.log(
    `Invariant passed+failed+errored+unjudged+skipped === cases.length: ${holds} (${total} === ${CASES.length})`,
  );
}

main();
