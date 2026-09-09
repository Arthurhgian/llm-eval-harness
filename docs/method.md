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
