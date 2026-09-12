// Ad hoc evidence for fixtures/cases.json's q20: D4 documents a JSON query
// endpoint (GET /devices/{device_eui}/data) but no export format or
// destination. "Data sheets" and "customizable analysis" aren't platform
// terms. Does the model notice neither term maps onto what's documented and
// ask what's meant, or does it confidently point at the query endpoint as
// if that settles the question? Same method as scripts/probe-q2.ts — run
// it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d4-api-reference.md', 'utf-8');
const question =
  'How can the data received be manipulated via API to be used as data sheets and customizable analysis?';

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
}

main();
