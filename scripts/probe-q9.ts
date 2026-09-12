// Ad hoc evidence for docs/sut-design.md §4: q09 asks for "the timeout for
// receiving requests" against a document that now names three distinct
// timeouts (join-accept window, downlink acknowledgment window, API call
// timeout), none of them called "request timeout" on purpose. Does the
// model pick one and answer confidently, or notice the ambiguity and ask
// which one? This is the first time q09 has ever been probed against real
// D4 content — before today D4 didn't exist, so the case only ever ran as
// `skipped` on category grounds, never actually asked. Same method as
// scripts/probe-q2.ts — run it, don't eyeball the prose.
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d4-api-reference.md', 'utf-8');
const question = 'Whats is the timeout for receiving requests?';

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
