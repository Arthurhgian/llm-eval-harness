# llm-eval-harness

An evaluation harness for a retrieval-augmented assistant over IoT device
documentation — built to answer one question that most AI test suites skip:

**when the model is wrong, how would you know?**

A wrong answer from an LLM does not arrive as an error. It arrives formatted,
fluent and confident. So this harness is built around three ideas:

1. **A golden set labelled by hand**, including questions the corpus cannot
   answer. Abstention is a tested behaviour, not a hope.
2. **A judge that is itself under test.** The LLM-as-judge is measured against
   the human labels, and the build fails when agreement drops.
3. **Non-determinism handled explicitly** — repeat-N, pinned sampling
   parameters, a declared flake budget — instead of retried until green.

Cost and p95 latency are quality gates alongside correctness.

## Layout

| Path | What's in it |
|---|---|
| `promptfooconfig.yaml` | Model/prompt matrix, deterministic + judged assertions |
| `tests/` | DeepEval pytest gates (build-failing assertions) |
| `fixtures/golden.jsonl` | Hand-labelled cases, `answerable: false` rows included |
| `prompts/` | Versioned prompts and judge rubrics |
| `docs/` | Method notes: flake budget, judge calibration, metric choices |
| `.github/workflows/evals.yml` | The gate |

## Running it

```bash
cp .env.example .env      # add one provider key
npm install
npx promptfoo eval        # matrix + judged assertions
uv sync && uv run pytest  # build-failing gates
```

## Status

Frozen at v0.1-corpus-complete. Days 1–3 were built with heavy AI assistance.
Kept as a study reference; work I author myself continues in the Playwright
repo.

MIT licensed.
