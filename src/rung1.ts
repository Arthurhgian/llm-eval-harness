import Anthropic from '@anthropic-ai/sdk';

// The SDK's own README notes that `apiKey` "is the default and can be
// omitted" — the client picks up ANTHROPIC_API_KEY from the environment on
// its own, so there's nothing to pass explicitly here.
const client = new Anthropic();

// USD per million tokens for claude-haiku-4-5-20251001.
// Source: https://platform.claude.com/docs/en/pricing.md — checked 10 Sep 2026.
// Update these if the `model` below changes — pricing is per-model, not
// something the SDK reports (see Finding 005, docs/method.md).
const INPUT_PRICE_PER_MTOK = 1.0;
const OUTPUT_PRICE_PER_MTOK = 5.0;

console.log('ANTHROPIC_API_KEY length:', (process.env['ANTHROPIC_API_KEY'] ?? '').length);

async function main() {
  const start = Date.now();

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'How often does the TS-100 sensor report temperature, and in what unit?',
      },
    ],
  });

  const end = Date.now();

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const inputCost = (message.usage.input_tokens / 1_000_000) * INPUT_PRICE_PER_MTOK;
  const outputCost = (message.usage.output_tokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
  const totalCost = inputCost + outputCost;

  console.log('Response text:', text);
  console.log('Input tokens:', message.usage.input_tokens);
  console.log('Output tokens:', message.usage.output_tokens);
  console.log('Elapsed ms:', end - start);
  // Pinned to the dated snapshot (claude-haiku-4-5-20251001, not the
  // claude-haiku-4-5 alias) so results stay comparable run over run — log it
  // anyway so a future edit to `model` above can't drift silently.
  console.log('Model:', message.model);
  console.log('Input cost: $' + inputCost.toFixed(6));
  console.log('Output cost: $' + outputCost.toFixed(6));
  console.log('Total cost: $' + totalCost.toFixed(6));
}

main();
