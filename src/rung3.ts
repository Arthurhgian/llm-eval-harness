import { readFileSync } from 'fs';
import { client, MODEL_ID, INPUT_PRICE_PER_MTOK, OUTPUT_PRICE_PER_MTOK } from './lib/model';

// ---------------------------------------------------------------------------
// Explain-back, written while building this, not after.
//
// Walking the cases before writing assertions for them (five from rung2,
// q07/q12/q06 added once D2 existed, q08/q16 added and q15 unblocked once
// D5 existed, q13/q14/q18/q19 added and q10 skipped once D3 existed):
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
// q07 (answerable)       — deterministic, same shape as q03. D2 states the
//                          removal endpoint as literal text.
// q06 (near-miss)        — half deterministic, same shape as q02 — the
//                          second near-miss, checked against D2 with
//                          scripts/probe-q6.ts before being trusted.
// q11 (depends-on-reader) — half deterministic, same shape as q02/q06.
//                          `contains "your plan"` checks that the response
//                          names what the answer depends on, which the
//                          question text does not contain. It cannot catch
//                          the actual failure mode this case exists to arm
//                          against — a response that picks one tier and
//                          states it flat while still mentioning "your
//                          plan" somewhere — because that's a judgment
//                          about content, not presence. Deferred, not
//                          caught, same as q02/q06's speculative-cause
//                          clause.
// q12 (depends-on-reader) — half deterministic, same table and same gap as
//                          q11. Two presence checks (`contains "your
//                          plan"`, `contains "100,000"` — the Starter
//                          tier's real number, which the question's own
//                          "data registers" wording does not contain)
//                          confirm the response pulled real, plan-tiered
//                          content instead of echoing the question. Neither
//                          check can confirm the tiers were used correctly
//                          rather than decoratively — same deferral as q11.
// q09 (underspecified)   — undecidable by category, not by missing corpus.
//                          The correct behaviour is a clarifying question,
//                          and unlike near-miss's mandated exact phrase,
//                          nothing requires a specific form for one —
//                          prompts/assistant.txt just says "ask for it."
//                          There is no honest substring for "asked about
//                          the right ambiguity." This is the one case no
//                          deterministic assertion can ever judge, full
//                          stop — confirmed, not assumed.
// q08 (near-miss)        — half deterministic, same shape as q02/q06 —
//                          recategorised from out-of-scope before D5 was
//                          drafted (docs/sut-design.md, dated note): writing
//                          a real ingestion-pipeline section put an
//                          80%-relevant chunk next to the undocumented
//                          distribution mechanism, which is near-miss by
//                          definition. Checked with scripts/probe-q8.ts, not
//                          assumed from the recategorisation alone.
// q16 (out-of-scope)      — half deterministic, same code shape as
//                          q02/q06/q08: the assertion checks for the refusal
//                          and nothing else, so a speculative addition after
//                          it would pass exactly the way it would on a
//                          near-miss case — the check does not verify
//                          "accurate, sourced reason," only "refused." The
//                          real difference is what's at stake, not what's
//                          checked: D5 has no adjacent technical content for
//                          the model to confabulate FROM here (unlike q08's
//                          ingestion-pipeline section), so the risk this
//                          case is exposed to is closer to out-of-scope's
//                          "Low" signal (§2's table) even though the code's
//                          blind spot is identical to a near-miss case's.
//                          Lower risk isn't zero risk, and it isn't checked
//                          either way — worth not overclaiming past what
//                          the assertion actually verifies.
// q15 (out-of-scope)      — same shape and same reasoning as q16, now that
//                          D5 exists — unblocked, not newly written.
// q13 (answerable)        — deterministic, same shape as q03/q07: D3 states
//                          the registration endpoint (`POST /devices`) as
//                          literal text the question doesn't contain.
// q14 (answerable)        — deterministic, same shape: D3 states the
//                          firmware upload endpoint as literal text.
// q10 (depends-on-reader) — skipped, and the reason is checked, not
//                          assumed, at a sample size that actually earns the
//                          word "confirmed". D3 answers this correctly and
//                          completely (status thresholds scale with a
//                          device's own reporting interval, not plan) — the
//                          doc isn't the problem. Original wording scored
//                          1-of-4 against the real doc on the first pass —
//                          suggestive, not proof: Fisher's exact on 1-of-4
//                          vs. the reworded candidate's 4-of-4 gives
//                          p ~ 0.14, which doesn't clear a conventional bar,
//                          and the first draft of this comment called that
//                          gap "decisive" anyway — caught on review, one
//                          word ahead of the evidence. Reran both arms at
//                          n=10: original 0/10, reworded 10/10. Pooled
//                          across both rounds — original 1/14, reworded
//                          14/14 — Fisher's exact gives p ~ 7.5e-7. *That*
//                          is decisive. Category stays depends-on-reader;
//                          rung 3 still skips the *original* wording, since
//                          that's the actual golden-set question and
//                          swapping it is rung 6's job. Full numbers in
//                          docs/sut-design.md, dated note — also rung 5's
//                          done-when condition (one case, repeat-N, pass
//                          rate strictly between 0 and 1, with a
//                          significance test on the result — the same
//                          question rung 7 will ask about every judge-vs-
//                          human agreement number it reports), arrived two
//                          rungs early; don't rediscover
//                          it there, it's already recorded.
// q18 (answerable)        — half deterministic. `contains "rejoin"` (not
//                          "rejoins" — the model paraphrased D3's "rejoins"
//                          as "will rejoin" in the probe run that decided
//                          this value) confirms the response used the
//                          `network`-field mechanism, which the question's
//                          own "different networks" wording doesn't supply
//                          on its own; doesn't confirm the network/connector
//                          distinction was drawn correctly.
// q19 (answerable)        — half deterministic. `contains "preset"` — not
//                          `contains "connector"`, which the question
//                          already contains and could never fail on, the
//                          same trap q12's first draft fell into.
//
// Four cases fully deterministic (q03, q07, q13, q14 — a literal fact with
// nothing deferred); nine half-deterministic (q02, q06, q08, q11, q12, q15,
// q16, q18, q19 — each checks presence of one required element, none
// checks that what follows it is accurate rather than confabulated); one
// skipped for a question-wording defect discovered by probing, not assumed
// (q10); one that no deterministic check can ever honestly judge (q09).
// Ten cases on the list a judge needs to see, not two — this is the list
// rung 7 reads, so it says so here.
//
// Three design decisions made after the first version of this file, not
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
//
// 3. Prefer identifiers over prose in `contains` values, learned from q18
//    vs q13/q14/q07/q03. `POST /devices` is robust: it's a literal
//    identifier the model can only reproduce by quoting the doc, not by
//    paraphrasing correctly. `rejoin` is fragile: it's prose, picked
//    because one observed run happened to say "will rejoin" — a different
//    run could as easily say "reconnects" or "joins again" and mean exactly
//    the same correct thing while failing the check. Both are checked
//    against real output before being trusted (see q18's comment), but
//    checking a fragile value doesn't make it robust, only honestly rated.
//    At rung 6's fifty assertions, default to identifiers, numbers, and
//    literal formats (endpoints, topics, field names, exact figures);
//    treat any prose-word check as half-deterministic even when nothing
//    else about the case calls for that label.
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
const D2 = readFileSync('corpus/d2-data-lifecycle-and-retention.md', 'utf-8');
const D3 = readFileSync('corpus/d3-device-onboarding-and-connectivity.md', 'utf-8');
const D5 = readFileSync('corpus/d5-platform-architecture-and-scope.md', 'utf-8');
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
    id: 'q07',
    input: 'How can the data can be removed?',
    context: D2,
    expected: [{ type: 'contains', value: 'DELETE /devices/{device_eui}/data' }],
  },
  {
    id: 'q06',
    input: 'How can the data received be edited/overwritten?',
    context: D2,
    // Deterministic half only, same shape and same reason as q02 — see
    // docs/labelling-rules.md. Checked with scripts/probe-q6.ts before this
    // assertion was trusted, not just before D2 was.
    expected: [{ type: 'contains', value: 'Not in the documentation.', caseInsensitive: false }],
  },
  {
    id: 'q11',
    input: "What's the retention on raw data?",
    context: D2,
    // "your plan", not bare "plan" — "explanation" contains "plan" as a
    // substring, so the bare word passes on any hedge that happens to use
    // the word "explanation" without ever naming what the answer actually
    // depends on. Still only presence, not correctness: a response stating
    // one tier's figure flat still says "your plan" if it explains why it
    // picked that tier, and this can't catch "the answer picked one tier
    // and stated it as the only one" — that clause is deferred, same shape
    // as q02/q06's deferred clause, not caught here. See the header.
    expected: [{ type: 'contains', value: 'your plan' }],
  },
  {
    id: 'q12',
    input: "What's the limitation(of data registers) for the bucket/database partition?",
    context: D2,
    // NOT `contains "register"` — the question text itself says "data
    // registers", so the model echoes that word in any response, right or
    // wrong, and the check could never fail. "100,000" is the Starter
    // tier's actual number from D2's table, which the question does not
    // contain — earning this means the answer actually pulled a real
    // number from the doc, not just echoed the question's own vocabulary
    // back. Same deferred-correctness caveat as q11: presence, not
    // "used the tiers correctly."
    expected: [
      { type: 'contains', value: 'your plan' },
      { type: 'contains', value: '100,000' },
    ],
  },
  {
    id: 'q08',
    input: 'How the uplinks are distributed on a queue?',
    context: D5,
    // Recategorised from out-of-scope to near-miss before D5 was drafted —
    // see docs/sut-design.md. Deterministic half only, same shape and same
    // reason as q02/q06: checks the refusal, not that nothing speculative
    // about the distribution mechanism follows it.
    expected: [{ type: 'contains', value: 'Not in the documentation.', caseInsensitive: false }],
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
    context: D5,
    expected: [{ type: 'contains', value: 'Not in the documentation.', caseInsensitive: false }],
  },
  {
    id: 'q16',
    input: "How the client's specific middleware can be integrated to the device and application?",
    context: D5,
    expected: [{ type: 'contains', value: 'Not in the documentation.', caseInsensitive: false }],
  },
  {
    id: 'q13',
    input: 'How the real devices can be registered(EUI) into the platform?',
    context: D3,
    expected: [{ type: 'contains', value: 'POST /devices', caseInsensitive: false }],
  },
  {
    id: 'q14',
    input: 'How the devices can receive the firmwares updates?',
    context: D3,
    expected: [
      { type: 'contains', value: 'POST /devices/{device_eui}/firmware', caseInsensitive: false },
    ],
  },
  {
    id: 'q10',
    input: "What the device should be if it's offline or disconnected?",
    expected: [],
    skipReason:
      'question wording is ambiguous ("should be" reads as status-value vs. prescribed-action), confirmed by A/B, not assumed from one sample: original wording 1/14 answered descriptively (10/10 refused at n=10, after 1/4 at n=4); reworded ("What status does the platform show for an offline device?") 14/14. Fisher\'s exact on the pooled result: p ~ 7.5e-7. D3 is correct; the fix is rewording at rung 6, not a deterministic check averaging over the question\'s own ambiguity. See docs/sut-design.md, dated note.',
  },
  {
    id: 'q18',
    input: 'How can I connect devices with different networks',
    context: D3,
    // "rejoin", not "rejoins" — the probe run that picked this value
    // paraphrased D3's "rejoins" as "will rejoin".
    expected: [{ type: 'contains', value: 'rejoin' }],
  },
  {
    id: 'q19',
    input: "How can I set up a specific connector to device's creation",
    context: D3,
    // NOT `contains "connector"` — the question already says "connector",
    // same trap as q12's first draft. "preset" is D3's own distinguishing
    // word for what a connector actually is, which the question lacks.
    expected: [{ type: 'contains', value: 'preset' }],
  },
];

// ---- json_field / exact self-test ----------------------------------------
//
// Neither type has a real case today. json_field is the one the rung
// explicitly warns against faking: none of the fifteen questions has a reason
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
