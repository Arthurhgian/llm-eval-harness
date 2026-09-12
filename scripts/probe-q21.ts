// Ad hoc evidence for fixtures/cases.json's q21 — json_field's first real
// case. D4's error envelope is verbatim JSON; this checks whether the
// model reproduces it as standalone JSON (json_field can judge it) or
// wraps it in prose (see docs/labelling-rules.md, "json_field: does prose
// wrapping the JSON count as a response?" — that shape is `unjudged`, not
// `failed`). Runs the real assertion from src/rung3.ts against the real
// response, not a hand-picked example. Same method as
// scripts/probe-q2.ts — run it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d4-api-reference.md', 'utf-8');
const question = "What does the API return if you request data for a device EUI that isn't registered?";

const prompt = readFileSync('prompts/assistant.txt', 'utf-8')
  .replace('{{context}}', context)
  .replace('{{question}}', question);

function classify(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return 'unjudged (parsed, not an object)';
    return 'error' in parsed ? 'pass (valid JSON, "error" field present)' : 'fail (valid JSON, "error" field missing)';
  } catch (err) {
    return `unjudged (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function main() {
  const message = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  console.log(text);
  console.log('');
  console.log('verdict:', classify(text));
}

main();
