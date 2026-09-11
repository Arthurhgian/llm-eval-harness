# Daily Logs

## Day 1 (10 Sep 2026)

### Shipped
- `src/rung1.ts` — one hand-written call to Claude, with token usage, cost,
  and latency logged.
- `src/rung2.ts` + `src/lib/model.ts` — five categorised cases run in a loop,
  three separate pass/fail/errored counters, client/model id/prices
  extracted to a shared module instead of copied.
- `docs/method.md` — Findings 004 (latency tracks output length, not the
  model — a hypothesis, not yet confirmed) and 005 (rung1's price constants
  and model id can drift independently), the Reporting rule, and the
  shared-model-config decision.
- `docs/sut-design.md` — the Qualimetrics corpus design: platform, topic
  scheme, five planned documents, 20 seed questions tagged by category.

### Rung 1 — single call, cost and latency

Three questions were asked. Answers below.

**What is a token?**
The unit the model actually reads and is billed in — a chunk of text a
tokenizer produces, usually smaller than a word and larger than a character.
`usage.input_tokens` / `usage.output_tokens` count these, not words or
characters, and price (`$/MTok`) is quoted per token for the same reason.

**What did the call cost?**
$0.000755. Not "not even 0.1 cent" — the actual measured number.

**Why was the latency not the same twice?**
Wrong question answered the first time: why two *different models'*
latencies differ is a separate question, answered at rung 9. The question
here is why the *same* call to the *same* model varies run to run —
sampling, output length, and server-side load, none of which are held
constant by a single call. That's non-determinism, and it's what repeat-N
exists to measure (Flake budget, rung 5), not something rung 1 can answer
from one data point.

**Before the 50-case run:**
50 cases × repeat-10 × $0.000755 ≈ $0.38. That number has to exist before
the run happens, not after — rung 1 isn't done until it does.

### Rung 2 — three counters

**Why three counters, not two?**
Two buckets — pass/fail — can't distinguish "the answer was wrong" from
"the call never happened." Day 0 already showed why that matters: Finding
003's promptfoo run reported 3 passed, 0 failed, 3 errored on a six-row
matrix. Read as a pass rate, that's 50%. It isn't — every answer that
existed was correct; the other three rows never reached a model, because
Sonnet 5 rejects promptfoo's injected `temperature` parameter (HTTP 400,
Findings 001 and 003). A failure is information: the model answered, and
the answer was wrong. An error is the absence of information: nothing was
produced to judge. Collapsing the two erases exactly the distinction that
says whether to talk to a prompt engineer or a platform engineer — see the
Reporting rule in `method.md`.

**What rung 2 actually is:**
Five categorised cases in `src/rung2.ts`, pulled from the seed questions in
`sut-design.md` — one each for answerable, near-miss, depends-on-reader,
underspecified, out-of-scope. Haiku only, through the shared
`src/lib/model.ts` — no Sonnet, no promptfoo involved. `try`/`catch` wraps
only the API call, so a bug in the code that runs *after* a successful call
can't be misfiled as a platform error.

Verified by breaking it on purpose: a deliberately invalid API key produced
0 passed, 0 failed, 5 errored across all five cases. Restoring the real key
produced 0 passed, 5 failed, 0 errored. Counters moved correctly under both
a real failure and an uninteresting real result.
