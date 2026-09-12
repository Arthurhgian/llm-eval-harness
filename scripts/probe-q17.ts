// Ad hoc evidence for fixtures/cases.json's q17: does the model surface a
// "negative" status code (D4's table includes 429, among others) when
// asked for "positive and negatives," or does it answer with only success
// codes and leave the assertion's "429" unmatched? Same method as
// scripts/probe-q2.ts — run it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d4-api-reference.md', 'utf-8');
const question =
  'What are the main status code received by the API when fetching data(positive and negatives)?';

const prompt = readFileSync('prompts/assistant.txt', 'utf-8')
  .replace('{{context}}', context)
  .replace('{{question}}', question);

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
  console.log('contains "429":', text.includes('429'));
}

main();
