# Labelling rules

Decisions about what counts as a pass, written down before the rung 7 judge
is calibrated against them — so a disagreement between the judge and a human
label reads as judge miscalibration only when it actually is one, not when
the rule was never decided.

## Near-miss: does a clarifying question pass?

**11 Sep 2026.** Prompted by `scripts/probe-q2.ts` against D1: the model
said "Not in the documentation," correctly named the gap, and then asked a
clarifying question. §2 of `docs/sut-design.md` lists a clarifying question
as the correct response to *underspecified*, not to near-miss, which wants
"refusal or not documented" — so a response that does both isn't obviously
a pass or a fail from the table alone.

**Rule:** a near-miss case passes only if the response contains the refusal
— "Not in the documentation" or a clear equivalent — *and* nothing that
follows it asserts a specific cause. Three shapes:

- Refusal, nothing else → pass.
- Refusal, then a clarifying question → pass. The refusal already happened;
  asking a follow-up is extra helpfulness, not confabulation.
- Refusal, then a guessed cause ("...it's probably because no decoder is
  assigned to your profile") → **fail**. The hedge in front of it doesn't
  neutralise the guess behind it — a user reads the specific claim, not the
  disclaimer — and this is exactly the failure mode near-miss exists to
  catch, now wearing a refusal as camouflage.

No refusal anywhere, clarifying question only, also fails — indistinguishable
from the model mistaking a well-formed question for an underspecified one.

**Why the line sits there:** the failure mode a near-miss exists to catch
is confabulation — inventing a plausible, specific, wrong cause. Asking
"what decoder is assigned to your profile?" isn't that; it's not answering
without first saying it can't. The two categories differ in what makes the
question unanswerable (the question itself, for underspecified; the docs,
for near-miss), not in whether the model is allowed to ask something back.

**Applied to the probe result above:** pass — refusal first, then a
clarifying question, no guessed cause anywhere in it.
