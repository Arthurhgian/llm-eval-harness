import Anthropic from '@anthropic-ai/sdk';

// The SDK's own README notes that `apiKey` "is the default and can be
// omitted" — the client picks up ANTHROPIC_API_KEY from the environment on
// its own, so there's nothing to pass explicitly here.
export const client = new Anthropic();

// Pinned to the dated snapshot, not the alias — see docs/method.md Finding 005.
export const MODEL_ID = 'claude-haiku-4-5-20251001';

// USD per million tokens for MODEL_ID.
// Source: https://platform.claude.com/docs/en/pricing.md — checked 10 Sep 2026.
// Update these if MODEL_ID changes — pricing is per-model, not something the
// SDK reports. One export, used by every rung script — see docs/method.md,
// "Shared model config", for why this isn't copied into each one.
export const INPUT_PRICE_PER_MTOK = 1.0;
export const OUTPUT_PRICE_PER_MTOK = 5.0;
