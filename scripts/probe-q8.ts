// Ad hoc evidence for docs/sut-design.md §2: writing D5's architecture
// section for real (queue -> validate -> decode -> store -> publish) put
// an 80%-relevant chunk right next to the undocumented fact Q8 actually
// asks about (how work is distributed across/within that queue). Does the
// model confabulate a distribution mechanism, or refuse? Same method as
// scripts/probe-q2.ts / probe-q6.ts — run it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d5-platform-architecture-and-scope.md', 'utf-8');
const question = 'How the uplinks are distributed on a queue?';

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
