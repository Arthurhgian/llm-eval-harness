// Ad hoc evidence for docs/sut-design.md §2: does Q6 stay a near-miss
// against D2 as written, or does the shape of a removal doc pull the model
// into answering "can I edit received data?" by implication? Same method
// as scripts/probe-q2.ts — run it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d2-data-lifecycle-and-retention.md', 'utf-8');
const question = 'How can the data received be edited/overwritten?';

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
