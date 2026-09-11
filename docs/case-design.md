# Case design

Moved out of `src/rung3.ts` verbatim, before cases move to JSON (rung 4) —
once that happens comments have nowhere to live in the data file, and
extracting after the JSON conversion is exactly when this reasoning gets
tempted away to save time. Nothing below is rewritten from the source
comments; only the container changed, from `//` to prose.

## Explain-back

Walking the cases before writing assertions for them (five from rung2,
q07/q12/q06 added once D2 existed, q08/q16 added and q15 unblocked once D5
existed, q13/q14/q18/q19 added and q10 skipped once D3 existed):

**q03 (answerable)** — deterministic. D1 states the downlink topic format
as literal text; a `contains` check on that literal string is a real
check, not a proxy.

**q02 (near-miss)** — half deterministic. docs/labelling-rules.md's rule
has two clauses: refusal present (checkable by `contains "Not in the
documentation."`), and no speculative cause after it (NOT checkable by any
substring — detecting "is this sentence a confabulated cause" is a
judgment call, not a pattern match). q02 gets one assertion, not two, and
the missing second half is the reason this case is where rung 7's judge
earns its place — found in this repo's own labelling rule, not invented
for this rung.

**q07 (answerable)** — deterministic, same shape as q03. D2 states the
removal endpoint as literal text.

**q06 (near-miss)** — half deterministic, same shape as q02 — the second
near-miss, checked against D2 with scripts/probe-q6.ts before being
trusted.

**q11 (depends-on-reader)** — half deterministic, same shape as q02/q06.
`contains "your plan"` checks that the response names what the answer
depends on, which the question text does not contain. It cannot catch the
actual failure mode this case exists to arm against — a response that
picks one tier and states it flat while still mentioning "your plan"
somewhere — because that's a judgment about content, not presence.
Deferred, not caught, same as q02/q06's speculative-cause clause.

**q12 (depends-on-reader)** — half deterministic, same table and same gap
as q11. Two presence checks (`contains "your plan"`, `contains "100,000"`
— the Starter tier's real number, which the question's own "data
registers" wording does not contain) confirm the response pulled real,
plan-tiered content instead of echoing the question. Neither check can
confirm the tiers were used correctly rather than decoratively — same
deferral as q11.

**q09 (underspecified)** — undecidable by category, not by missing corpus.
The correct behaviour is a clarifying question, and unlike near-miss's
mandated exact phrase, nothing requires a specific form for one —
prompts/assistant.txt just says "ask for it." There is no honest substring
for "asked about the right ambiguity." This is the one case no
deterministic assertion can ever judge, full stop — confirmed, not
assumed.

**q08 (near-miss)** — half deterministic, same shape as q02/q06 —
recategorised from out-of-scope before D5 was drafted (docs/sut-design.md,
dated note): writing a real ingestion-pipeline section put an
80%-relevant chunk next to the undocumented distribution mechanism, which
is near-miss by definition. Checked with scripts/probe-q8.ts, not assumed
from the recategorisation alone.

**q16 (out-of-scope)** — half deterministic, same code shape as
q02/q06/q08: the assertion checks for the refusal and nothing else, so a
speculative addition after it would pass exactly the way it would on a
near-miss case — the check does not verify "accurate, sourced reason,"
only "refused." The real difference is what's at stake, not what's
checked: D5 has no adjacent technical content for the model to confabulate
FROM here (unlike q08's ingestion-pipeline section), so the risk this case
is exposed to is closer to out-of-scope's "Low" signal (§2's table) even
though the code's blind spot is identical to a near-miss case's. Lower
risk isn't zero risk, and it isn't checked either way — worth not
overclaiming past what the assertion actually verifies.

**q15 (out-of-scope)** — same shape and same reasoning as q16, now that D5
exists — unblocked, not newly written.

**q13 (answerable)** — deterministic, same shape as q03/q07: D3 states the
registration endpoint (`POST /devices`) as literal text the question
doesn't contain.

**q14 (answerable)** — deterministic, same shape: D3 states the firmware
upload endpoint as literal text.

**q10 (depends-on-reader)** — skipped, and the reason is checked, not
assumed, at a sample size that actually earns the word "confirmed". D3
answers this correctly and completely (status thresholds scale with a
device's own reporting interval, not plan) — the doc isn't the problem.
Original wording scored 1-of-4 against the real doc on the first pass —
suggestive, not proof: Fisher's exact on 1-of-4 vs. the reworded
candidate's 4-of-4 gives p ~ 0.14, which doesn't clear a conventional bar,
and the first draft of this comment called that gap "decisive" anyway —
caught on review, one word ahead of the evidence. Reran both arms at n=10:
original 0/10, reworded 10/10. Pooled across both rounds — original 1/14,
reworded 14/14 — Fisher's exact gives p ~ 7.5e-7. *That* is decisive.
Category stays depends-on-reader; rung 3 still skips the *original*
wording, since that's the actual golden-set question and swapping it is
rung 6's job. Full numbers in docs/sut-design.md, dated note — also rung
5's done-when condition (one case, repeat-N, pass rate strictly between 0
and 1, with a significance test on the result — the same question rung 7
will ask about every judge-vs-human agreement number it reports), arrived
two rungs early; don't rediscover it there, it's already recorded.

**q18 (answerable)** — half deterministic. `contains "rejoin"` (not
"rejoins" — the model paraphrased D3's "rejoins" as "will rejoin" in the
probe run that decided this value) confirms the response used the
`network`-field mechanism, which the question's own "different networks"
wording doesn't supply on its own; doesn't confirm the network/connector
distinction was drawn correctly.

**q19 (answerable)** — half deterministic. `contains "preset"` — not
`contains "connector"`, which the question already contains and could
never fail on, the same trap q12's first draft fell into.

Four cases fully deterministic (q03, q07, q13, q14 — a literal fact with
nothing deferred); nine half-deterministic (q02, q06, q08, q11, q12, q15,
q16, q18, q19 — each checks presence of one required element, none checks
that what follows it is accurate rather than confabulated); one skipped
for a question-wording defect discovered by probing, not assumed (q10);
one that no deterministic check can ever honestly judge (q09). Ten cases
on the list a judge needs to see, not two — this is the list rung 7 reads,
so it says so here.

## Design decisions

Three design decisions made after the first version of this file, not
before, because the first version is what exposed the need for them:

1. "No assertion attached" and "an assertion existed but couldn't evaluate
   the response" were both landing in one `unjudged` counter. Those are
   different states discovered at different times — the first is known
   before a case ever runs (q09, q11, q15 above); the second is a runtime
   discovery about a response that was actually produced. The first
   version also paid for three API calls before finding out their results
   were unusable. Both problems share one fix: check `expected.length ===
   0` before calling the model, not after. A case skipped for want of an
   assertion never reaches `client.messages.create` — it costs nothing and
   lands in its own `skipped` bucket. `unjudged` now means only "the model
   answered, and the check on that answer broke" — a defect in this file,
   not a known gap going in.

2. evaluateCase returned on the first non-pass, so a case with one failing
   assertion and one unjudged one reported whichever was listed first —
   the verdict depended on list order, not on the responses. Precedence,
   decided once, here: unjudged beats failed beats passed. All assertions
   in a case's list are evaluated regardless of earlier results; if any of
   them couldn't be evaluated, the whole case is unjudged — you cannot
   honestly call a response failed (or passed) on the strength of a check
   you only partly ran. Only once nothing is unjudged does a single
   failure make the case failed.

3. Prefer identifiers over prose in `contains` values, learned from q18 vs
   q13/q14/q07/q03. `POST /devices` is robust: it's a literal identifier
   the model can only reproduce by quoting the doc, not by paraphrasing
   correctly. `rejoin` is fragile: it's prose, picked because one observed
   run happened to say "will rejoin" — a different run could as easily say
   "reconnects" or "joins again" and mean exactly the same correct thing
   while failing the check. Both are checked against real output before
   being trusted (see q18's comment), but checking a fragile value doesn't
   make it robust, only honestly rated. At rung 6's fifty assertions,
   default to identifiers, numbers, and literal formats (endpoints,
   topics, field names, exact figures); treat any prose-word check as
   half-deterministic even when nothing else about the case calls for that
   label.

4. A malformed `fixtures/cases.json` crashes the loader (`src/lib/cases.ts`,
   `loadCases()`). It does not become `unjudged`. `unjudged` is a fact
   about one case — it ran, produced a real response, and the check on
   that response broke. A cases.json that won't parse or won't validate
   isn't a fact about any case; there are no cases yet, so there's nothing
   to bucket. Reporting it as `unjudged` would print "some cases had
   judging trouble" over a report whose true state is "the run never
   started" — the passed/failed/errored conflation recurring one layer up,
   at the file instead of the case. `JSON.parse` and `validateCases` are
   both left to throw uncaught, on purpose: a fixture defect should crash
   loud and non-zero, not be absorbed into a report about the thing the
   fixture is testing.

## Per-case assertion notes

These are the comments that lived next to each case's `expected` array —
the specific reasoning for the value chosen, as distinct from the
category-level reasoning in the explain-back above.

**q02** — Deterministic half only, on purpose — see the explain-back above
and docs/labelling-rules.md. The "no speculative cause after the refusal"
clause has no assertion here; it isn't missing, it's deferred.
Case-sensitive and with the period: prompts/assistant.txt mandates this
exact literal phrase, not a paraphrase of it — checking it
case-insensitively would pass a response that violates the prompt.

**q06** — Deterministic half only, same shape and same reason as q02 — see
docs/labelling-rules.md. Checked with scripts/probe-q6.ts before this
assertion was trusted, not just before D2 was.

**q11** — "your plan", not bare "plan" — "explanation" contains "plan" as
a substring, so the bare word passes on any hedge that happens to use the
word "explanation" without ever naming what the answer actually depends
on. Still only presence, not correctness: a response stating one tier's
figure flat still says "your plan" if it explains why it picked that
tier, and this can't catch "the answer picked one tier and stated it as
the only one" — that clause is deferred, same shape as q02/q06's deferred
clause, not caught here. See the header.

**q12** — NOT `contains "register"` — the question text itself says "data
registers", so the model echoes that word in any response, right or
wrong, and the check could never fail. "100,000" is the Starter tier's
actual number from D2's table, which the question does not contain —
earning this means the answer actually pulled a real number from the doc,
not just echoed the question's own vocabulary back. Same
deferred-correctness caveat as q11: presence, not "used the tiers
correctly."

**q08** — Recategorised from out-of-scope to near-miss before D5 was
drafted — see docs/sut-design.md. Deterministic half only, same shape and
same reason as q02/q06: checks the refusal, not that nothing speculative
about the distribution mechanism follows it.

**q18** — "rejoin", not "rejoins" — the probe run that picked this value
paraphrased D3's "rejoins" as "will rejoin".

**q19** — NOT `contains "connector"` — the question already says
"connector", same trap as q12's first draft. "preset" is D3's own
distinguishing word for what a connector actually is, which the question
lacks.

## Why a percentage over these cases should never be reported

11 Sep 2026. `src/rung3.ts` now loads from `fixtures/cases.json` instead of
an inline array — a pure refactor, checked by rerunning the real suite and
requiring the exact same numbers back: 13 passed, 0 failed, 0 errored, 0
unjudged, 2 skipped, out of 15. It came back exactly that. Then, rerunning
it again with no change at all — same code, same fixture, same model —
one run out of nine came back 12 passed, 1 failed. The other eight came
back 13/0. Nothing was edited between any of these runs.

That number — 13-of-15, or 12-of-13, depending which run you happened to
catch — is exactly the shape of thing this file keeps warning against
reporting as a percentage, for reasons that stack:

**It's a small sample pretending to be a rate.** One re-run moved the
count by a full case. If that's the size of the swing at n=15, a
"pass rate" computed from any single run is measuring which run you
happened to catch at least as much as it's measuring anything about the
system. This is rung 5's problem, arrived the same way Q10's did: not by
plan, by running the suite enough times to notice the number wasn't
staying put.

**The denominator is a modelling choice, not a fact.** 13-of-15 counts
the two skipped cases against the total. 13-of-13 doesn't. Both are
defensible; neither is *the* number, and picking one silently is picking
an answer to "does a case with no assertion count as a miss" without ever
writing the question down.

**A pass doesn't mean one thing.** Of the 13, four (q03, q07, q13, q14)
are fully deterministic — the check verifies the whole claim. Nine are
half-deterministic (q02, q06, q08, q11, q12, q15, q16, q18, q19) — the
check verifies presence of one required element and is structurally blind
to whatever follows it, documented case by case above. A percentage adds
these together as if a presence check and a full-correctness check were
the same unit. They're closer to two different metrics wearing the same
number.

**Categories aren't commensurable.** Near-miss "passing" means the model
resisted confabulating an adjacent, tempting, wrong fact. Answerable
"passing" means it recalled a literal fact correctly. Depends-on-reader
"passing" means it named the right dependency without necessarily using
it correctly. Averaging these into one rate is the Reporting rule
(docs/method.md) recurring one layer up: that rule was written because
"50% pass rate" blended "the answer was wrong" with "the call never
happened." A single pass rate over five categories blends "resisted
confabulation," "recalled a fact," and "named a dependency" the same way,
for the same reason it's a bad idea the second time.

None of this means don't count — it means report the breakdown
(`Passed: 13`, `Failed: 0`, `Errored: 0`, `Unjudged: 0`, `Skipped: 2`, out
of 15) and stop there, the way `src/rung3.ts` already prints it. A rate
belongs to rung 5 and later, computed per category, per repeat-N, with the
instability itself as a reported number — not folded silently into a
single percentage that looks more precise than a fifteen-case, one-run
sample can support.
