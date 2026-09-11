// The instrument behind docs/sut-design.md's Q10 finding — original wording
// 1/14, reworded 14/14, Fisher's exact p ~ 7.5e-7. Deleting this after
// citing the number it produced would be the exact mistake corrected for
// scripts/probe-q2.ts, on a more load-bearing statistic: keep it, re-run it,
// don't just believe the transcript.
//
// The classifier below is the fixed version. The first draft checked
// whether "interval" appeared anywhere in the response text, which scored
// the ORIGINAL wording as 10/10 pass — because a refusal's own explanation
// of what D3 does cover ("...defines what offline means, based on uplink
// reporting intervals...") also contains the word "interval". That result
// contradicted the earlier 1/4 finding and got caught for that reason, not
// because the classifier itself was tested. It should have been: apply the
// same "what response would make this fail" question to analysis code, not
// only to committed assertions (see docs/method.md).
import { readFileSync } from 'fs';
import { client, MODEL_ID } from '../src/lib/model';

const context = readFileSync('corpus/d3-device-onboarding-and-connectivity.md', 'utf-8');
const promptTemplate = readFileSync('prompts/assistant.txt', 'utf-8');

const ORIGINAL = "What the device should be if it's offline or disconnected?";
const REWORDED = 'What status does the platform show for an offline device?';

// Classifies on whether the response REFUSES (starts with the mandated
// phrase) vs. directly answers — not on whether some keyword appears
// anywhere in the text. Falsifiability check for this classifier itself:
// a refusal that explains what IS documented (and so mentions "interval")
// must still classify as REFUSED, and it does, because the check is the
// literal prefix the prompt mandates, not a keyword search.
function refused(text: string): boolean {
  return text.trim().startsWith('Not in the documentation');
}

async function ask(question: string): Promise<string> {
  const prompt = promptTemplate.replace('{{context}}', context).replace('{{question}}', question);
  const message = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function run(label: string, question: string, n: number) {
  let answered = 0;
  const lines: string[] = [];
  for (let i = 1; i <= n; i++) {
    const text = await ask(question);
    const isRefusal = refused(text);
    if (!isRefusal) answered++;
    lines.push(
      `  run ${i}: ${isRefusal ? 'REFUSED' : 'ANSWERED'} — "${text.slice(0, 60).replace(/\n/g, ' ')}..."`,
    );
  }
  console.log(`=== ${label} (answered ${answered}/${n}) ===`);
  console.log(lines.join('\n'));
  console.log('');
  return answered;
}

async function main() {
  const origAnswered = await run('original wording', ORIGINAL, 10);
  const rewordAnswered = await run('reworded', REWORDED, 10);
  console.log(`Original: ${origAnswered}/10 answered descriptively, Reworded: ${rewordAnswered}/10`);
  console.log('Pooled with the earlier n=4 round (1/4, 4/4): original 1/14, reworded 14/14.');
}

main();
