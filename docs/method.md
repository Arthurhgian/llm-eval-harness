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

## Reporting rule
Passes, failures and errors are reported as three separate counts, always —
never blended into one pass-rate percentage. Finding 003 (Run 2, day 0) is
why: that run reported "50% pass rate" when the real story was 3 passes,
0 failures, 3 errors — every model output that existed passed, and half the
rows never reached a model. A blended percentage cannot distinguish "the
answer was wrong" from "the call never happened," which is exactly the
distinction that tells you whether to talk to a prompt engineer or a platform
engineer.

This governs every counter downstream, including rung 2's: pass, fail and
error stay separate at every layer that reports them — per case, per model,
and in whatever the CI gate reads.

## Shared model config
Client construction, the pinned model id, and the per-token prices live in
`src/lib/model.ts`, imported by every rung script, instead of being retyped
into each one. Copying was the other option, and it was cheap with only two
files — but this repo already wrote up what copying costs as Finding 005
(day 1): two facts, nothing enforcing they stay in sync, found because it
happened once by accident. Writing it a second time on purpose, in the file
next to the one that names it as a defect, isn't defensible without saying
why not.

This is not Finding 005's Action item. Rung 11 still owes a price table keyed
by model id that fails loudly on an unknown model; `src/lib/model.ts` only
removes the duplication — an unknown or changed model id here still silently
keeps the old price rather than erroring. One problem fixed, one still open.

## Findings from day 0 (9 Sep 2026)

Three cases, two models — six rows when both are in the matrix. Day 0 took
three runs to reach a clean pass; both causes were in the harness, not the
models, which is the normal result of a first day and the reason a first day
happens before any real cases exist.

| Run | What changed | Successes | Failures | Errors |
|-----|---------------|----------:|---------:|-------:|
| 1   | Original config, both models in the matrix | 0 | 0 | 6 |
| 2   | `temperature` removed from Sonnet's provider config (Sonnet still in the matrix); built-in `cost` assertion removed | 3 | 0 | 3 |
| 3   | Sonnet 5 parked; Haiku 4.5 carries the matrix alone | 3 | 0 | 0 |

Run 2 changed two things at once — `temperature` removed from Sonnet's
config, the built-in `cost` assertion removed — so the counts alone can't
attribute which change moved what. It's only readable here because the two
effects landed on non-overlapping rows: Sonnet's errors trace to the first
change (Finding 003), Haiku's clean pass to the second (Finding 002's
action). That's luck of the row split, not a property of changing one
variable at a time — the next two-variable change may not separate so
cleanly.

Findings below cite the run each is drawn from.

### Finding 001 (Run 1) — one model under test cannot be pinned

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

### Finding 002 (Run 1) — the cost gate could not have worked, and said so

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

### Finding 003 (Run 2) — the tool cannot call the model, and the fix was not in my config

Correction to finding 001. Removing `temperature` from the provider config
changed nothing: Run 2 produced the identical 400 on all three Sonnet 5 rows.

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

One thing worth keeping from this:

**A default injected on your behalf is still your request.** I "removed"
temperature and the request still carried it. The parameter I could see in my
config was not the parameter being sent, and only reading the provider source
settled it. When a request fails on something you believe you did not send,
verify the wire, not the config file.

Run 2's counts — 3 successes, 0 failures, 3 errors, surfaced as a misleading
"50% pass rate" — are the evidence behind the Reporting rule above; the rule
lives there, not here.

Action: Sonnet 5 is parked, Haiku 4.5 carries the matrix (Run 3), and the
second model returns once this is patched locally or fixed upstream. Filed as
the strongest candidate for the week 11 pull request — it is reproducible in
four lines and it blocks every user of a current Anthropic model.

## Findings from day 1 (10 Sep 2026)

Different instrument, not a continuation of the table above: day 0 was
promptfoo running a matrix (multiple cases, two models, one command); day 1
is `src/rung1.ts`, a hand-written script that makes one API call and exits.
Nothing below shares a harness with Findings 001–003, so it gets its own
table with its own labels — letters, not run numbers, so the two schemes
can't be misread as one sequence.

| Invocation | Model | Output tokens | Elapsed ms |
|---|---|---:|---:|
| A | `claude-opus-5` | 623 | 10,649 |
| B | `claude-haiku-4-5-20251001` | 146 | 2,616 |

Finding 005 isn't drawn from either invocation — it came from reading
`rung1.ts`'s source, not from running it.

### Finding 004 (Invocations A, B) — the 4× elapsed-time gap matched the 4× output-length gap

From the invocation table above: elapsed time differed 4× (10,649ms vs
2,616ms), output length differed 4× (623 vs 146 tokens), and per-token
latency did not — 17.1 vs 17.9 ms/output token, within 5% of each other.
That's the finding, stated plainly: two measured numbers, no interpretation
attached.

**Hypothesis (untested): latency tracks output length, not the model.** If
that holds, an 8,000 ms threshold with unbounded `max_tokens` gates on how
much the model chose to say, not on how slow it was — a verbosity gate
wearing a latency gate's name. It doesn't hold yet: **n=1 per model, no
repeats, and two points cannot separate fixed per-request overhead from
per-token cost** — the ms/output-token figure above already assumes overhead
is zero, which nothing here verifies. The same shape shows up in the token
counts for an identical prompt string: 29 input tokens on Opus, 25 on Haiku.
Tokenizers are model-specific, so an assertion built on a fixed input-token
count is not portable across a matrix — one more place where a single number
stands in for something that needs a distribution.

Confirming the hypothesis means repeated runs at varying output lengths per
model, then fitting `latency = intercept + slope × output_tokens`: intercept
is fixed overhead, slope is real per-token cost. That's rung 5, not rung 1.

Action: latency stays logged, not gated, until rung 5 has enough points to
fit the line.

### Finding 005 (source read, not a run) — rung1.ts reproduced finding 002 in its own code

`src/rung1.ts` holds price constants (`INPUT_PRICE_PER_MTOK`,
`OUTPUT_PRICE_PER_MTOK`) and a model id (`claude-haiku-4-5-20251001`, in the
`messages.create` call) as two independent facts, with nothing
enforcing they stay in sync. A comment reading "update these if the model
below changes" is not a mechanism, it is a request. Change the model, forget
the constants, and the harness prints a confident, wrong cost — computing a
plausible number from stale pricing instead of refusing to compute one.

That is Finding 002's shape, not a new defect: promptfoo's price table went
stale against the models under test and returned wrong-by-omission instead of
failing. The only difference is authorship — that one was upstream's, this
one is ours, written the same week we wrote down the fix for the other one.

**A comment telling a human to keep two facts in sync is not a mechanism for
keeping two facts in sync.** The fix is structural: price keyed to the model
id it prices, so a model with no entry has no price.

Action: rung 11 replaces the two loose constants with a price table keyed by
model id — an unknown model id gets no price and the code fails loudly, the
same rule Finding 002 already established: an assertion that cannot evaluate
must fail, never pass quietly.

