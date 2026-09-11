import { readFileSync } from 'fs';
import { client, MODEL_ID, INPUT_PRICE_PER_MTOK, OUTPUT_PRICE_PER_MTOK } from './lib/model';

// ---------------------------------------------------------------------------
// Explain-back, written while building this, not after.
//
// Walking the five cases from rung2 before writing assertions for them:
//
// q03 (answerable)       — deterministic. D1 states the downlink topic
//                          format as literal text; a `contains` check on
//                          that literal string is a real check, not a proxy.
// q02 (near-miss)        — half deterministic. docs/labelling-rules.md's
//                          rule has two clauses: refusal present (checkable
//                          by `contains "Not in the documentation."`), and
//                          no speculative cause after it (NOT checkable by
//                          any substring — detecting "is this sentence a
//                          confabulated cause" is a judgment call, not a
//                          pattern match). q02 gets one assertion, not two,
//                          and the missing second half is the reason this
//                          case is where rung 7's judge earns its place —
//                          found in this repo's own labelling rule, not
//                          invented for this rung.
// q11 (depends-on-reader) — skipped, not undecidable. Its sourceDoc (D2)
//                          doesn't exist yet, so there's no real content to
//                          check a response against, and that's known
//                          before any call is made — see "skipped" below.
// q09 (underspecified)   — undecidable by category, not by missing corpus.
//                          The correct behaviour is a clarifying question,
//                          and unlike near-miss's mandated exact phrase,
//                          nothing requires a specific form for one —
//                          prompts/assistant.txt just says "ask for it."
//                          There is no honest substring for "asked about
//                          the right ambiguity." This is the one case no
//                          deterministic assertion can ever judge, full
//                          stop — confirmed, not assumed.
// q15 (out-of-scope)      — skipped, same shape as q11 (sourceDoc D5
//                          unwritten). Arguably testable sooner than q11,
//                          since "the client's own broker" is out of scope
//                          regardless of which document gets retrieved —
//                          skipped anyway for consistency rather than
//                          special-cased; revisit once D5 exists.
//
// Two real, working deterministic cases (q03, q02); two skipped for want of
// a document to check against (q11, q15); one that no deterministic check
// can ever honestly judge (q09), kept because it's rung 7's reason to exist.
//
// Two design decisions made after the first version of this file, not
// before, because the first version is what exposed the need for them:
//
// 1. "No assertion attached" and "an assertion existed but couldn't
//    evaluate the response" were both landing in one `unjudged` counter.
//    Those are different states discovered at different times — the first
//    is known before a case ever runs (q09, q11, q15 above); the second is
//    a runtime discovery about a response that was actually produced. The
//    first version also paid for three API calls before finding out their
//    results were unusable. Both problems share one fix: check
//    `expected.length === 0` before calling the model, not after. A case
//    skipped for want of an assertion never reaches `client.messages.create`
//    — it costs nothing and lands in its own `skipped` bucket. `unjudged`
//    now means only "the model answered, and the check on that answer
//    broke" — a defect in this file, not a known gap going in.
//
// 2. evaluateCase returned on the first non-pass, so a case with one
//    failing assertion and one unjudged one reported whichever was listed
//    first — the verdict depended on list order, not on the responses.
//    Precedence, decided once, here: unjudged beats failed beats passed.
//    All assertions in a case's list are evaluated regardless of earlier
//    results; if any of them couldn't be evaluated, the whole case is
//    unjudged — you cannot honestly call a response failed (or passed) on
//    the strength of a check you only partly ran. Only once nothing is
//    unjudged does a single failure make the case failed.
// ---------------------------------------------------------------------------

// ---- Assertions -------------------------------------------------------

interface ExactAssertion {
  type: 'exact';
  value: string;
}

interface ContainsAssertion {
  type: 'contains';
  value: string;
  caseInsensitive?: boolean; // default true, matching icontains elsewhere in this repo
}

interface JsonFieldAssertion {
  type: 'json_field';
  field: string;
}

type Assertion = ExactAssertion | ContainsAssertion | JsonFieldAssertion;

type AssertionVerdict =
  | { verdict: 'pass' }
  | { verdict: 'fail'; reason: string }
  | { verdict: 'unjudged'; reason: string };

// The harness dispatches on `type` here — one place, not a branch per case
// in the run loop. Anything that keeps this from producing a clean
// pass/fail (wrong type, malformed assertion, a structural check handed
// prose) is caught and returned as `unjudged`, not thrown and not silently
// passed.
function runAssertion(text: string, a: Assertion): AssertionVerdict {
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
        const exhaustive: never = a;
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
function evaluateCase(text: string, expected: Assertion[]): { verdict: 'passed' | 'failed'; reason?: string } | { verdict: 'unjudged'; reason: string } {
  const results = expected.map((a) => runAssertion(text, a));

  const unjudgedResult = results.find((r) => r.verdict === 'unjudged');
  if (unjudgedResult) return { verdict: 'unjudged', reason: unjudgedResult.reason };

  const failResult = results.find((r) => r.verdict === 'fail');
  if (failResult) return { verdict: 'failed', reason: failResult.reason };

  return { verdict: 'passed' };
}

// ---- Cases --------------------------------------------------------------

interface Case {
  id: string;
  input: string;
  context?: string; // fed through prompts/assistant.txt when present; omitted = contextless call
  // A list, not a single assertion — decided before writing any case,
  // because the near-miss rule already needs more than one check on a
  // single response. An empty list is not "forgot to write one" — it's the
  // deliberate marker for "no deterministic check exists," checked BEFORE
  // the API call (see `skipped`), and skipReason says why. All assertions
  // in a non-empty list must pass for the case to pass.
  expected: Assertion[];
  skipReason?: string; // required when expected is []
}

const D1 = readFileSync('corpus/d1-mqtt-topics-and-messaging.md', 'utf-8');
const ASSISTANT_PROMPT = readFileSync('prompts/assistant.txt', 'utf-8');

function buildPrompt(context: string, question: string): string {
  return ASSISTANT_PROMPT.replace('{{context}}', context).replace('{{question}}', question);
}

const CASES: Case[] = [
  {
    id: 'q03',
    input: "What's the topic format for downlink?",
    context: D1,
    expected: [
      { type: 'contains', value: 'qualimetrics/{device_eui}/down/{port}', caseInsensitive: false },
    ],
  },
  {
    id: 'q02',
    input: 'Why is my uplink arriving with no decoded payload value?',
    context: D1,
    // Deterministic half only, on purpose — see the explain-back above and
    // docs/labelling-rules.md. The "no speculative cause after the refusal"
    // clause has no assertion here; it isn't missing, it's deferred.
    // Case-sensitive and with the period: prompts/assistant.txt mandates
    // this exact literal phrase, not a paraphrase of it — checking it
    // case-insensitively would pass a response that violates the prompt.
    expected: [{ type: 'contains', value: 'Not in the documentation.', caseInsensitive: false }],
  },
  {
    id: 'q11',
    input: "What's the retention on raw data?",
    expected: [],
    skipReason: 'sourceDoc D2 is unwritten (docs/sut-design.md §4)',
  },
  {
    id: 'q09',
    input: 'Whats is the timeout for receiving requests?',
    expected: [],
    skipReason:
      'no deterministic check exists for "asked an appropriate clarifying question" — no fixed phrase is required, unlike near-miss\'s refusal string',
  },
  {
    id: 'q15',
    input: "What are the client's MQTT broker limitations for the device's communication?",
    expected: [],
    skipReason: 'sourceDoc D5 is unwritten (docs/sut-design.md §4)',
  },
];

// ---- json_field / exact self-test ----------------------------------------
//
// Neither type has a real case today. json_field is the one the rung
// explicitly warns against faking: none of the five questions has a reason
// to demand JSON output, so none gets one. A real case earns a place once
// something in the corpus genuinely specifies a machine-readable response
// shape — e.g. "return the status codes as JSON" against D4, once it
// exists. `exact` turns out to have the same gap for a quieter reason: the
// one place it looked like a fit (q02's refusal) doesn't stay exact once
// the model adds the gap explanation and a follow-up question, which is
// exactly why q02 uses `contains` instead. Both are proven correct here,
// directly, instead of bent to fit a case that doesn't want them.
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
  console.log('');
}

// ---- Run ------------------------------------------------------------------

let passed = 0;
let failed = 0;
let errored = 0;
let unjudged = 0;
let skipped = 0;
let totalCost = 0;

async function runCase(c: Case) {
  // Judgeability is known before any call is made — check it first. A case
  // with nothing to check it against never reaches the API: no cost, no
  // wall-clock, and it lands in `skipped`, not `unjudged`.
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
  const prompt = c.context ? buildPrompt(c.context, c.input) : c.input;

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
