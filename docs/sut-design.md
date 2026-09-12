# SUT design — the Qualimetrics corpus

10 Sep 2026, day 1. Corrected and consolidated 11 Sep 2026, day 2, once D1
existed to correct against.

Design notes for the golden-set corpus this harness runs against, written
before the documents themselves. The point of writing this first: which
questions are unanswerable, and *why*, is a design decision — if it's made
after the docs exist, it gets made by accident.

## 1. The platform

**Qualimetrics** — an IoT platform for LoRaWAN devices. Telemetry reaches
the platform over the network and is exposed to customers through MQTT
topics, a REST API, and dashboards.

Everything below references it by name. It goes first because nothing else
parses without it.

## 2. The unanswerable-case criterion

The test for whether an unanswerable case belongs in the golden set is not
"do I know the answer" — it's *what failure mode does this detect*. Four
kinds, not equally valuable:

| Kind | What it is | Correct answer | Signal |
|---|---|---|---|
| Out of scope | Docs cover nothing nearby | Refusal | Low — any system gets this right |
| Depends on the reader | Answer varies by account, plan, device model, operator | "Depends on X" | Medium |
| Underspecified | Can't be answered as asked | A clarifying question | Medium |
| Near-miss | Docs cover the neighbourhood, not this exact fact | Refusal or "not documented" | High — this is where hallucination actually happens |

Near-miss is the case that earns its keep: retrieval returns an 80%-relevant
chunk, and a model under pressure to be helpful confabulates the missing 20%.
Out-of-scope questions prove almost nothing by comparison — there's no
adjacent chunk to tempt the model into.

### The two accidental pairs

The question list below contains two near-miss pairs, each asking about two
closely related facts that live in the same section of the same document:

- **Payload pair** — Q1 (no payload) / Q2 (no decoded payload value)
- **Data-lifecycle pair** — Q6 (edit received data) / Q7 (remove received data)

For each pair, exactly one half is written into the corpus; the other is
deliberately left out. Retrieval will surface the documented sibling's chunk
for the undocumented question every time, because the two facts sit right
next to each other in the same section. If the model answers the
undocumented half anyway, that's the near-miss failure mode, caught on
purpose:

- **Payload pair** — Q1 documented (D1, uplink troubleshooting). Q2 left out.
- **Data-lifecycle pair** — Q7 documented (D2, removing data). Q6 left out.

Leaving a question out only works if nothing else in the corpus answers it by
implication. Two places this almost happened:

- This design's original topic-scheme section (a name index, since folded
  into D1 and removed once every document referencing it existed — see the
  12 Sep 2026 note under §3) described the `/decoded` topic. The natural
  sentence to write is "published when a decoder exists for the device's
  profile" — which *is* the answer to Q2 (no decoded value ⇒ no decoder
  configured). That section stated the topic exists and what it carries,
  and stopped there; the condition under which decoding does or doesn't
  happen was left unstated on purpose. Whoever drafted D1 from it needed to
  keep it that way, not fill the gap back in because it reads more
  complete. D1 as written names
  the dependency ("the payload decoder assigned to the device's profile")
  without the conditional — closer to the line than intended, so this got
  checked rather than assumed, **11 Sep 2026**, with `scripts/probe-q2.ts`
  (reproducible — re-run it for n>1): `claude-haiku-4-5-20251001` answered
  "Not in the documentation," named the exact gap (covers no-payload, not
  no-decoded-value), and asked a clarifying question instead of guessing a
  cause. Holds as a near-miss under the rule in `docs/labelling-rules.md`
  (refusal first, clarifying question after, passes) — n=1 so far, same
  flake-budget caveat as everywhere else in this repo.
- D2's brief was decided before it was drafted: document how removal works,
  say nothing about whether editing is possible in either direction — the
  natural sentence for a data-lifecycle doc is "telemetry is append-only" or
  "immutable once ingested," which answers Q6 (can't edit; only delete) by
  implication. D2 as written keeps to the brief: removal mechanics only, no
  sentence framing deletion as the only available mutation. Checked, not
  assumed, **11 Sep 2026**, with `scripts/probe-q6.ts`: `claude-haiku-4-5-20251001`
  answered "Not in the documentation," accurately described what the page
  does cover (retention, removal), and never asserted that editing is
  unsupported — a fact about document coverage, not a claim about the
  platform. Holds as a near-miss under the same rule as Q2 — n=1, same
  caveat. If mutability ever needs documenting for its own sake, Q6 stops
  being usable and a replacement near-miss has to be found — don't let it
  happen silently.

## 3. The five documents

**12 Sep 2026 — this section used to be preceded by a "Topic scheme"
section**, a name index for the MQTT topics (`.../up/{port}`,
`.../down/{port}`, `.../status`, and their variants), kept only so
D2/D3/D4/D5 drafting had something to point at before D1 existed to name
them properly. It said, when it existed, that it could go "once every
document referencing these names is written" — D2 has pointed at D1 by
title since D2 was drafted, and D4 (below) does the same rather than
repeating any topic name D1 already owns. With D4 written, that condition
is met for all five documents, so the section is gone rather than kept
as a name index nothing points at anymore.

The `Doc` id (D1–D5) is what `sourceDoc` will carry on every case from
rung 4 onward — it has to resolve to exactly one file, permanently. Filename
is picked at the same time the document is written, not after, so there's
never a window where the id is data pointing at nothing.

**11 Sep 2026 — the id-to-file mapping is now real code, not just this
table:** `src/lib/docs.ts` holds one map, D1/D2/D3/D5 to their paths, with
`DocId` typed as all five so a case can legally *name* D4 without the map
having to pretend it exists. Decided now, for the state that arrives the
day a case actually names D4: `loadDoc()` throws a dedicated
`DocNotWrittenError`, not a bare Node file-not-found, so a case runner can
catch specifically "not written yet" and skip — the same `skipped`
treatment already used for D2/D3/D5 before they existed — without also
swallowing a genuinely broken path (a typo in the map, a moved file),
which stays an uncaught crash because it's a bug, not a known gap.

**12 Sep 2026 — D4 written, closing the gap this section flagged above.**
`src/lib/docs.ts`'s map now has all five entries; `DocNotWrittenError`
stays in the module for the next doc that arrives the same way D4 did, but
nothing in `ALL_DOC_IDS` can trigger it today. D4's own scope stayed
narrower than "endpoints" might suggest, on purpose, to protect other
cases already in the golden set — see the exclusions noted per-question in
§4 below (q06, q07, q09, q11, q12, q13, q14, q20) and, in full, the
per-document design note that shipped with D4 in
`docs/case-design.md`.

| Doc | Title | File | Scope |
|---|---|---|---|
| D1 | MQTT Topics & Messaging | `corpus/d1-mqtt-topics-and-messaging.md` | Uplink/downlink topic format, payload decoding, connection status, acknowledgment. Uplink troubleshooting ("no payload") lives here — decoded-value troubleshooting deliberately does not. |
| D2 | Data Lifecycle & Retention | `corpus/d2-data-lifecycle-and-retention.md` | Retention windows and register/bucket capacity limits (both plan-tier tables, no universal number), removing received data. Editing/overwriting received data deliberately does not appear. |
| D3 | Device Onboarding & Connectivity | `corpus/d3-device-onboarding-and-connectivity.md` | EUI registration, firmware updates, connectors, multi-network support, offline/status detection (branches on per-device reporting interval, not plan). |
| D4 | API Reference | `corpus/d4-api-reference.md` | Querying stored telemetry over HTTP, status codes (including 429), three distinctly-named timeout concepts (join-accept window, downlink acknowledgment window, API call timeout — none of them called "request timeout"). Explicitly not a complete endpoint index; registration, firmware, and data removal are left to D3/D2 by title. No PATCH/PUT on data, no export format, no plan-agnostic numbers. |
| D5 | Platform Architecture & Scope | `corpus/d5-platform-architecture-and-scope.md` | The ingestion pipeline at a high level (queue, validate, decode, store, publish — no distribution detail), and an explicit statement of what Qualimetrics does not cover (customer-owned infrastructure). |

## 4. The 20 questions

★ marks the two near-miss pairs — same mark, one documented half, one not.
Q8 is a third near-miss, unpaired — no sibling question in this set asks
the fact D5 does document (see note below).

The "Doc" column names the document the question maps to, but that mapping
means something different per category, so it's split from what's actually
there:

| # | Question | Category | Doc | What's in that doc, for this question |
|---|---|---|---|---|
| 1 | Why is my uplink arriving with no payload? | Answerable ★ | D1 | Full answer, in the uplink troubleshooting section |
| 2 | Why is my uplink arriving with no decoded payload value? | Near-miss ★ (undocumented sibling of Q1) | D1 | Sibling only — the decoding-pipeline description, not this failure mode |
| 3 | What's the topic format for downlink? | Answerable | D1 | Full answer — downlink topic format |
| 4 | What's the message left when the connect is disconnected? | Answerable (recategorised — see note below) | D1 | Full answer — the Last-Will section: `{"status": "offline", "reason": "lwt"}`, distinguished from a graceful disconnect by `reason` |
| 5 | How do I tell if the device acknowledged? | Answerable | D1 | Full answer — the ack topic |
| 6 | How can the data received be edited/overwritten? | Near-miss ★ (undocumented sibling of Q7) | D2 | Sibling only — removal mechanics, nothing on editing (see note above); probed, holds |
| 7 | How can the data can be removed? | Answerable ★ | D2 | Full answer — the `DELETE /devices/{device_eui}/data` mechanics |
| 8 | How the uplinks are distributed on a queue? | Near-miss (recategorised — see note below) | D5 | Sibling-shaped, not sibling-paired: D5 documents that frames are queued and the pipeline stages, not how work is distributed within that queue; probed, holds |
| 9 | Whats is the timeout for receiving requests? | Underspecified — the docs name three different timeouts (join, downlink ack, HTTP); "requests" alone doesn't pick one | D4 | Names three distinct timeouts, none uniquely matching "requests" |
| 10 | What the device should be if it's offline or disconnected? | Depends on the reader — status thresholds scale with the device's own configured reporting interval | D3 | Answer exists and is correct, but the question's own phrasing is ambiguous enough that no single deterministic check is trustworthy against it (see note below) |
| 11 | What's the retention on raw data? | Depends on the reader — retention window varies by plan | D2 | Full answer — the plan-tier table (Starter/Growth/Enterprise), no single number stated |
| 12 | What's the limitation(of data registers) for the bucket/database partition? | Depends on the reader — register-per-bucket limit varies by plan | D2 | Full answer — same table; "register," "bucket," "partition" are now defined terms (see note below), not the question borrowing vocabulary the corpus doesn't have |
| 13 | How the real devices can be registered(EUI) into the platform? | Answerable | D3 | Full answer — the `POST /devices` registration flow |
| 14 | How the devices can receive the firmwares updates? | Answerable | D3 | Full answer — the firmware-over-the-air upload/scheduling flow (D3 never says "FUOTA" — matching its own wording, not a term the corpus doesn't have) |
| 15 | What are the client's MQTT broker limitations for the device's communication? | Out of scope — a client's own broker is their infrastructure, not Qualimetrics' | D5 | Full boundary statement — refusal, then an accurate, sourced explanation of why (customer-owned infrastructure), not a bare "not documented" |
| 16 | How the client's specific middleware can be integrated to the device and application? | Out of scope — unnamed third-party middleware isn't documented | D5 | Same boundary statement as Q15, same probed behaviour |
| 17 | What are the main status code received by the API when fetching data(positive and negatives)? | Answerable | D4 | Full answer — status code table |
| 18 | How can I connect devices with different networks | Answerable | D3 | Full answer — the `network` field, distinct mechanism from Q19 (see note below) |
| 19 | How can I set up a specific connector to device's creation | Answerable | D3 | Full answer — connectors as decoder/settings presets, distinct mechanism from Q18 (see note below) |
| 20 | How can the data received be manipulated via API to be used as data sheets and customizable analysis? | Underspecified — "data sheets" and "customizable analysis" aren't platform terms; needs a concrete export format or destination | D4 | A JSON query endpoint is described; no export format or destination exists to map either term onto (see 12 Sep 2026 note below) |

**Distribution:** 10 answerable, 3 near-miss, 2 out-of-scope, 3 depends-on-reader,
2 underspecified. Answerable is the largest bucket here; the design effort
went into making sure the other ten each detect a specific, named failure
mode instead of padding the count. (Not claiming this split matches real
corpora — haven't checked one.)

**11 Sep 2026 — Q4 was recategorised after D1 was drafted, not before.** The design called
for D1 to leave "message... disconnected" ambiguous between the retained
status message and the Last-Will payload. Writing D1 for real needed a
concrete Last-Will section to be a useful product page — a customer
integrating against this needs to know the LWT payload actually is — and
that section ended up naming the exact answer, `reason` field included. The
question stopped being underspecified the moment the document got specific,
and the alternative (deleting the LWT detail to preserve the label) would
have made D1 worse to keep Q4's category intact. Category lost, document
kept — that was the right trade. This is the drift the single-source-of-truth
rule in `method.md` exists to catch: this file is now the corrected record,
not the original design intent.

**11 Sep 2026 — D2 adopted "bucket," "register," and "partition" as defined
terms.** Q12's wording ("data registers," "bucket/database partition")
doesn't match anything in D1 — it's vocabulary carried over from a real
platform, not derived from this corpus. Left undefined, Q12 would degrade
into accidentally-out-of-scope (nothing in the corpus uses those words) as
opposed to the intended depends-on-reader. D2 defines them: one bucket per
device, telemetry stored as data registers, buckets partitioned
automatically and not user-configurable. Q11 and Q12 are both answered from
one plan-tier table (Starter/Growth/Enterprise) rather than a single number
— a flat "retention is 90 days" sentence would have collapsed Q11 into
answerable exactly the way Q4 collapsed yesterday, so every number in that
table is plan-conditioned on purpose, with no plan-agnostic figure stated
anywhere in D2.

**11 Sep 2026 — Q8 was recategorised from out-of-scope to near-miss before
D5 was drafted, not after.** The original reasoning ("internal ingestion
mechanics, not documented for customers") assumed D5 would stay thin enough
that nothing nearby existed. But D5 has to describe *something* about
ingestion to be worth writing at all, and the moment it does — queued,
validated, decoded, stored, published — that description sits right next to
the fact Q8 actually asks about (how work is distributed within the queue),
which is the definition of near-miss, not out-of-scope. Out-of-scope was
never really the right category; it was the category available before the
document existed to prove otherwise. Chosen deliberately over keeping D5
too thin to answer: near-miss is the high-signal category (§2's own table)
and this corpus started with only two. Checked, not assumed, with
`scripts/probe-q8.ts`: `claude-haiku-4-5-20251001` answered "Not in the
documentation," correctly named what D5 does say (frames are queued for
processing) against what it doesn't (the distribution mechanism), and
invented nothing. Holds as a near-miss under the same rule as Q2/Q6 — n=1,
same caveat. Unpaired, unlike Q1/Q2 and Q6/Q7: no other question in this
set asks the fact D5 documents, so there's no sibling to leave undocumented
— the near-miss comes from D5's own content sitting next to its own gap,
not from a sibling question's answer being withheld.

**11 Sep 2026 — D3 decided two things before being drafted, not after.**

*Q10's branch.* The forward note below (written before D3 existed) flagged
that Q11/Q12 both branch on plan and asked for a different axis. D3's
device-status section branches on each device's own *expected reporting
interval*, set per device profile — a sensor expected every 60 seconds
goes stale after 3 minutes, one expected daily doesn't go stale for three
days. Plan never enters into it. This satisfies the forward note's ask for
rung 6 one case early, deliberately, rather than by accident.

*Q18 vs Q19.* Both read close enough on a skim to risk being one fact
asked twice — the same critique accepted for Q11/Q12. Checked before
writing: Q18 is the `network` field (which LoRaWAN network a device joins
— Qualimetrics' shared network or, on Enterprise, a private one); Q19 is
`connector` (a decoder-and-settings preset for a device model, chosen at
creation). Two different fields, two different device-record properties,
written in separate sections with no shared sentence between them. Neither
depends on knowing the other to be answered.

**11 Sep 2026 — Q10's phrasing turned out to be the finding, not D3's
content — and the finding was checked, not assumed from four data points.**
Q10 was designed to answer descriptively — status thresholds conditioned
on a device's reporting interval — and D3 states that clearly. Probed
anyway: 1 pass in 4 samples ("Not in the documentation" three times,
reading "what the device *should be*" as asking for prescribed remediation
rather than the status value). 1-of-4 on an identical prompt against an
identical document is, on its own, exactly what plain run-to-run variance
predicts — nothing in that number distinguishes "the question is
ambiguous" from "the model is just noisy here." Writing the ambiguity
explanation down at that point would have been inventing a cause for an
observation that had at least two honest explanations, which is the
confabulation this corpus's own near-miss cases exist to catch, committed
in the design doc instead of by the model.

The test that separates the two hypotheses: run the candidate rewording —
"What status does the platform show for an offline device?" — the same
number of times, against the same document. 4 pass in 4. That alone was
still only suggestive: Fisher's exact test on the 1-of-4-vs-4-of-4 table
gives p ≈ 0.14 — a real, large-looking gap, but n=4 per arm doesn't clear
any conventional bar, and calling that result "decisive" was one word past
what the data licensed, caught on review. Reran both arms at n=10 to get
an answer instead of a hedge: **original wording, 0 of 10 answered
descriptively (10 of 10 refused); reworded, 10 of 10.** Pooled across both
rounds — original 1-of-14, reworded 14-of-14 — Fisher's exact gives
p ≈ 7.5×10⁻⁷. *That* is decisive. Ambiguity, not noise, confirmed by a
number that earns the word, not asserted from a shape that merely
suggested it. Q10 stays depends-on-reader — D3 is correct and complete —
and the *reworded* phrasing is the rung 6 fix (justified by evidence now,
not a hunch); `rung3.ts` still skips the *original* wording, since that's
the actual golden-set question and rewording it is rung 6's job, not
rung 3's.

This is also rung 5 arriving two rungs early by accident: a single case,
run N times, landing on a pass rate strictly between 0 and 1 — original
wording 1/14 (0.071), reworded 14/14 (1.0) — plus an account of what
varies between runs and a real significance test on the result, which is
rung 5's done-when condition plus the question rung 7 will ask about every
agreement number it reports. Keep this data point rather than let it
evaporate into "skipped": it's the first real evidence this repo has for
what repeat-N actually looks like, and it should feed rung 5's design
directly instead of being rediscovered there.

**12 Sep 2026 — D4 decided eight exclusions before being drafted, not
after, because each one protects a case that already exists.** D4's brief
(§3) reads "endpoints, status codes, timeouts, data export" — wide enough
to answer several other cases by accident if drafted carelessly. Decided
and held to, one exclusion per clause: (1) no PATCH/PUT on data — protects
Q6, since a mutation endpoint answers "can it be edited" outright; (2) no
"these are all the data operations" framing or complete endpoint index —
protects Q6 by omission, since a complete table with no PATCH in it is
itself the answer; (3) no CSV/XLSX/`format=` export — protects Q20, since
CSV is a data sheet and would collapse the question to answerable, and D3's
"CSV upload" is devices, not data, so D4 doesn't bridge to it; (4) no
conditional on decoder assignment — protects Q2; (5) no restated `DELETE
.../data` mechanics — protects Q7's provenance, D4 points at D2 by title
instead; (6) no restated `POST /devices` or firmware-upload mechanics —
protects Q13/Q14's provenance the same way, pointing at D3 by title; (7) no
plan-agnostic rate-limit number — protects Q11/Q12, so D4 has no rate-limit
section at all rather than one flat number breaking the plan-conditioned
discipline D2 established; (8) the phrase "request timeout" never appears
as a name for any one concept — protects Q9, with three timeouts named by
distinct qualifiers instead (join-accept window, downlink acknowledgment
window, API call timeout), none of them colliding with D1's already-distinct
"session timeout" (MQTT). This is the Q4 collapse (§4, dated note above) in
reverse: there, specificity a document needed for its own sake cost a
category by accident; here, the categories were checked against before the
specificity was written, not after.

Probed against the real document, not assumed, same day
(`scripts/probe-q9.ts`, `scripts/probe-q17.ts`, `scripts/probe-q20.ts`):
Q9 — first probe ever run against real D4 content (before today it only
ever hit `skipped` on category grounds) — named all three timeouts,
refused to pick one, and asked which was meant; holds as underspecified.
Q17 answered with the full status-code table, "positive" and "negative"
both represented, `429` present. Q20 refused, accurately described the
query endpoint D4 does have, and asked what export or analysis capability
was meant instead of treating the query endpoint as settling the question;
holds as underspecified. n=1 each, same flake-budget caveat as every
other probe in this repo.

D4 also gave `json_field` its first real case: Q21 asks what the API
returns for an unregistered device EUI, checked against D4's verbatim
error envelope. Probed (`scripts/probe-q21.ts`): the model named the
correct status code and reproduced the correct body, wrapped in an
explanatory sentence — `JSON.parse` on the full response throws, so the
case reports `unjudged`, not `failed`. That's the intended read, decided
in `docs/labelling-rules.md` before this result came in, not fitted to it
afterward: a structural check handed a correct answer in the wrong
shape is a fact about the check's reach, not about whether the model was
right.

**Forward note for rung 6:** Q11 and Q12 are both plan-conditioned — same
mechanism (which tier the account is on), tested twice. Growing to 50 should
add depends-on-reader cases that branch on something other than plan:
device model, account role, operator. Two cases proving the same branch
isn't two data points on depends-on-reader, it's one, asked twice.

These 20 are a seed, not the golden set. Rung 6 grows this to 50 — more
per-category coverage, and likely more near-miss pairs once D1–D5 exist and
have more surface for facts to sit next to each other. This document stops at
20 because that's what's needed to start; it isn't the design ceiling.
