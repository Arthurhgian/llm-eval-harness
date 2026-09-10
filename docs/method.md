# Method notes

Written as decisions are made, not afterwards.

## Flake budget
TBD week 1 — repeat-N, then declare the variance a case may show before it is
treated as a broken test rather than a flaky model.

## Judge calibration
TBD week 1 — agreement between the judge and the hand labels, reported as a
number, with the threshold that fails the build.

## Why cost and latency are gates
An eval suite that is correct but takes 40 minutes and USD 5 per run stops
being run. Budgets keep it in CI.

## Findings from the first run (9 Sep 2026, day 0)

Three cases, two models, six rows, six errors — and no model output at all.
Both causes were in the harness, not the models, which is the normal result of
a first run and the reason a first run happens before any real cases exist.

### Finding 001 — one model under test cannot be pinned

`claude-sonnet-5` rejects the `temperature` parameter: HTTP 400,
`invalid_request_error`, "`temperature` is deprecated for this model".
`claude-haiku-4-5` accepts it. The three Sonnet rows failed at the API call;
the three Haiku rows reached the assertion stage.

This is not a config annoyance, it is a constraint on the method. Greedy
decoding is how you would normally hold sampling still while measuring
something else. On a model that refuses the parameter, you cannot, so
**repeat-N with declared variance is mandatory for that model** rather than a
nice-to-have. Any comparison between the two models has to account for one of
them being pinned and the other not.

### Finding 002 — the cost gate could not have worked, and said so

The built-in `cost` assertion threw `Cost assertion does not support providers
that do not return cost` on every Haiku row.

Root cause, read from `node_modules/promptfoo/dist/src/providers/`: the
Anthropic price table (`ANTHROPIC_MODELS` in `providers/anthropic/util.js`)
contains ids up to Claude 4.x only — nothing for `claude-sonnet-5` or
`claude-haiku-4-5-*`. `calculateCost()` in `providers/shared.js` does
`models.find(m => m.id === modelName)` and returns `undefined` when that
misses, **before** it reads `config.cost`. So an explicitly declared
per-provider cost cannot override an unknown model, which looks like a bug
rather than a design decision: the caller has stated the price and is ignored.
(`config.cost` is also a single number applied to both input and output
tokens, so it could not express asymmetric pricing even if it were reached.)

The good part: it **errored** instead of defaulting to zero. A cost gate that
silently treated unknown pricing as free would have passed every build forever
while measuring nothing — a green check with no signal behind it, which is
worse than a red one. Worth remembering when writing our own gates: an
assertion that cannot evaluate must fail loudly, never pass quietly.

Action: cost is gated by our own assertion computed from reported token usage
and a price table in this repo (week 1). The promptfoo precedence issue is a
candidate for the week 11 upstream pull request.

### Finding 003 — the tool cannot call the model, and the fix was not in my config

Correction to finding 001. Removing `temperature` from the provider config
changed nothing: the second run produced the identical 400 on all three
Sonnet 5 rows.

`node_modules/promptfoo/dist/src/providers/anthropic/messages.js`, lines
85-87, builds the request body as:

```js
temperature: config.thinking || thinking
  ? config.temperature
  : config.temperature || getEnvFloat('ANTHROPIC_TEMPERATURE', 0),
```

With `thinking` unset — the default — the parameter is **always** sent, and
falls back to `0` when the user did not ask for it. Sonnet 5 rejects
`temperature` entirely, so promptfoo 0.118.17 cannot call that model at all.
The only escape is the `thinking` branch, where `config.temperature` is
`undefined` and `JSON.stringify` drops the key — but extended thinking is a
different system under test (different cost, latency and output shape), so it
is a workaround, not a neutral fix.

Two things worth keeping from this:

**A default injected on your behalf is still your request.** I "removed"
temperature and the request still carried it. The parameter I could see in my
config was not the parameter being sent, and only reading the provider source
settled it. When a request fails on something you believe you did not send,
verify the wire, not the config file.

**Do not average errors with failures.** The run reported 3 successes,
0 failures, 3 errors — which surfaced as "50% pass rate". That number is
meaningless here: nothing the models produced was wrong. Every Haiku answer
passed every assertion, including the missing-parameter rubric. The other half
never reached a model. A single pass-rate percentage that blends "the answer
was wrong" with "the call never happened" hides exactly the distinction that
tells you whether to talk to a prompt engineer or a platform engineer. Our own
reporting keeps errors, failures and passes as three separate counts, always.

Action: Sonnet 5 is parked, Haiku 4.5 carries the matrix, and the second model
returns once this is patched locally or fixed upstream. Filed as the strongest
candidate for the week 11 pull request — it is reproducible in four lines and
it blocks every user of a current Anthropic model.
