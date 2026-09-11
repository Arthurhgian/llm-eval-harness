// Ad hoc evidence for docs/sut-design.md §2: does Q2 ("why is my uplink
// arriving with no decoded payload value?") stay a near-miss against D1 as
// actually written, or does the model confabulate a cause? Run it, don't
// eyeball it — and re-run it (n=1 today) when that claim needs more samples.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d1-mqtt-topics-and-messaging.md', 'utf-8');
const question = 'Why is my uplink arriving with no decoded payload value?';

// Read, not retyped — a change to assistant.txt changes what this probes,
// automatically, instead of silently testing a stale copy of it.
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
