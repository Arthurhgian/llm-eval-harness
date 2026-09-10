import { client, MODEL_ID, INPUT_PRICE_PER_MTOK, OUTPUT_PRICE_PER_MTOK } from './lib/model';

interface Case {
  id: string;
  input: string;
  expected: string;
}

// Pulled from the 20 seed questions in docs/sut-design.md — one per
// category, ids match that doc's Q-numbers. Inline on purpose: moving this
// to a JSON fixture is rung 4, not here.
const CASES: Case[] = [
  {
    id: 'q03',
    input: "What's the topic format for downlink?",
    expected: 'qualimetrics/{device_eui}/down/{port} — docs/sut-design.md §3',
  },
  {
    id: 'q02',
    input: 'Why is my uplink arriving with no decoded payload value?',
    expected:
      'Not documented (near-miss, sibling of Q1) — correct answer is a refusal, not a guessed cause',
  },
  {
    id: 'q11',
    input: "What's the retention on raw data?",
    expected: 'Depends on the reader (plan/tier) — no single retention window is correct',
  },
  {
    id: 'q09',
    input: 'Whats is the timeout for receiving requests?',
    expected:
      'Underspecified — correct answer asks which requests (join, downlink ack, or API)',
  },
  {
    id: 'q15',
    input: "What are the client's MQTT broker limitations for the device's communication?",
    expected: "Out of scope — a client's own broker isn't Qualimetrics' to document",
  },
];

console.log('ANTHROPIC_API_KEY length:', (process.env['ANTHROPIC_API_KEY'] ?? '').length);

// Three separate counts, never blended — see the Reporting rule in
// docs/method.md.
let passed = 0;
let failed = 0;
let errors = 0;

async function runCase(c: Case) {
  const start = Date.now();

  // The try wraps the API call ONLY. Everything after it — reading
  // usage/content off the response, the pass/fail check — stays outside.
  // If it were inside, a bug in this code (a missing field, a bad access)
  // would throw the same way a real API failure does, and the catch below
  // would file it as `errors`: a harness defect recorded as a platform
  // failure. That's the exact conflation the Reporting rule exists to catch,
  // just moved into the code that implements it instead of the report it
  // produces.
  let message;
  try {
    message = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: 'user', content: c.input }],
    });
  } catch (err) {
    errors++;
    console.log(`--- ${c.id} ---`);
    console.log('Input:', c.input);
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
  const totalCost = inputCost + outputCost;

  // icontains, matching the assertion type fixtures/cases.yaml already uses
  // elsewhere in this repo — case-insensitive substring check of `expected`
  // against the response text.
  const pass = text.toLowerCase().includes(c.expected.toLowerCase());
  if (pass) {
    passed++;
  } else {
    failed++;
  }

  console.log(`--- ${c.id} ---`);
  console.log('Input:', c.input);
  console.log('Expected:', c.expected);
  console.log('Response text:', text);
  console.log('Pass:', pass);
  console.log('Input tokens:', message.usage.input_tokens);
  console.log('Output tokens:', message.usage.output_tokens);
  console.log('Elapsed ms:', end - start);
  console.log('Model:', message.model);
  console.log('Input cost: $' + inputCost.toFixed(6));
  console.log('Output cost: $' + outputCost.toFixed(6));
  console.log('Total cost: $' + totalCost.toFixed(6));
  console.log('');
}

async function main() {
  // Sequential, not Promise.all — no assertions yet, so there's nothing to
  // gain from concurrency except harder-to-read interleaved output.
  for (const c of CASES) {
    await runCase(c);
  }

  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log('Errors:', errors);
}

main();
