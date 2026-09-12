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

## json_field: does prose wrapping the JSON count as a response?

**12 Sep 2026.** D4 gives `json_field` its first real case (q21): D4's
error envelope is a verbatim JSON body, and the case asks what the API
returns for an unknown device EUI. Two ways that answer can go wrong that
aren't "wrong field": the response wraps the JSON in an explanatory
sentence or a fenced code block with commentary around it, or it never
produces JSON at all. `src/rung3.ts`'s `json_field` check calls
`JSON.parse` on the whole response text; either shape throws. Same
question as the near-miss rule above, on a different assertion type: is a
throw here `failed` or `unjudged`?

**Rule:** `unjudged`, not `failed`, whenever the response isn't parseable
as JSON standing on its own — prose wrapped around it, a code fence with
commentary, or no JSON at all. `failed` is reserved for a response that
*is* valid, standalone JSON but is missing the required field — the one
case where the check actually ran its comparison and the comparison came
back negative.

**Why the line sits there:** `prompts/assistant.txt` never instructs
"respond with JSON only" — it says answer from the documentation. A model
that reproduces D4's error envelope inside a sentence ("The API returns
`{"error": {"code": "device_not_found", ...}}` for an unknown EUI") has
conveyed the documented fact correctly; `JSON.parse` failing on that
response is the check being narrow about a format the model was never
told to honor on its own, not the model being wrong. Marking it `failed`
would punish a plausibly correct answer for a formatting choice the
assertion, not the model, is strict about. Marking it `unjudged` sends the
real question — did this response correctly convey the documented body,
prose and all? — to rung 7, the same deferral near-miss's undecidable
second clause already gets. A response that *is* clean, standalone JSON
and is still missing the field has attempted exactly what the check tests
and gotten it wrong; that one the check can honestly call `failed` on its
own.

This matches `src/rung3.ts`'s existing behaviour (any `JSON.parse` failure
already lands in the `catch` block as `unjudged` — see `runAssertion`'s
`json_field` case) — decided here, in writing, rather than left as an
accident of where the `try` happens to sit.

**Probed, not just theorised, 12 Sep 2026** (`scripts/probe-q21.ts`):
`claude-haiku-4-5-20251001` answered q21 with "According to the
documentation, the API returns a **404 Not Found**..." followed by the
correct error envelope in a fenced code block — exactly the shape this
rule exists for. `JSON.parse` on the full response throws (`Unexpected
token 'A', "According "... is not valid JSON`), so the case reports
`unjudged`, not `failed` — correctly: the model named the right status
code and reproduced the right body, and calling that a failure would have
punished a right answer for not being asked to omit its own explanation.
n=1, same flake-budget caveat as every other probe in this repo.
