# SUT design — the Qualimetrics corpus

10 Sep 2026, day 1.

Design notes for the golden-set corpus this harness runs against, written
before the documents themselves. The point of writing this first: which
questions are unanswerable, and *why*, is a design decision — if it's made
after the docs exist, it gets made by accident.

## 1. The platform

**Qualimetrics** — an IoT platform that ingests device telemetry over MQTT,
decodes it against per-device payload parsers, and exposes the result
through topics, a REST API, and dashboards.

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

- The topic scheme below describes the `/decoded` topic. The natural sentence
  to write is "published when a decoder exists for the device's profile" —
  which *is* the answer to Q2 (no decoded value ⇒ no decoder configured).
  §3 states the topic exists and what it carries, and stops there; the
  condition under which decoding does or doesn't happen is left unstated on
  purpose. Whoever drafts D1 from this section needs to keep it that way, not
  fill the gap back in because it reads more complete.
- D2 hasn't been written yet, but the natural sentence for a data-lifecycle
  doc is "telemetry is append-only" or "immutable once ingested" — which
  answers Q6 (can't edit; only delete) by implication, the same way. D2's
  brief, decided here before it's drafted: document how removal works, say
  nothing about whether editing is possible in either direction. If mutability
  ever needs documenting for its own sake, Q6 stops being usable and a
  replacement near-miss has to be found — don't let it happen silently.

## 3. Topic scheme

Settled before any document is written, because the scheme is the schema
every document references — change it after three docs exist and all three
need rewriting.

**Uplink** (device → platform):
- `qualimetrics/{device_eui}/up/{port}` — raw payload, base64, published as received.
- `qualimetrics/{device_eui}/up/{port}/decoded` — JSON output of the configured
  payload decoder, published after the raw message.

**Downlink** (platform → device):
- `qualimetrics/{device_eui}/down/{port}` — publish here to queue a downlink for
  the device's next receive window.
- `qualimetrics/{device_eui}/down/{port}/ack` — platform publishes here once the
  network confirms delivery (confirmed downlinks only).

**Connection lifecycle:**
- `qualimetrics/{device_eui}/status` — retained; platform publishes
  `online`/`offline` as connection state changes, and this is where an MQTT
  Last-Will message is configured for ungraceful disconnects.

## 4. The five documents

| Doc | Title | Scope |
|---|---|---|
| D1 | MQTT Topics & Messaging | Uplink/downlink topic format, payload decoding, connection status, acknowledgment. Uplink troubleshooting ("no payload") lives here — decoded-value troubleshooting deliberately does not. |
| D2 | Data Lifecycle & Retention | Retention windows, removing received data, storage/partition limits. Editing/overwriting received data deliberately does not appear. |
| D3 | Device Onboarding & Connectivity | EUI registration, firmware updates, connectors, multi-network support, offline/status detection. |
| D4 | API Reference | Endpoints, status codes, the several distinct timeout concepts (join, downlink ack, HTTP), data export. |
| D5 | Platform Architecture & Scope | High-level internal architecture and an explicit statement of what Qualimetrics does not cover (customer-owned infrastructure). |

## 5. The 20 questions

★ marks the two near-miss pairs — same mark, one documented half, one not.

The "Doc" column names the document the question maps to, but that mapping
means something different per category, so it's split from what's actually
there:

| # | Question | Category | Doc | What's in that doc, for this question |
|---|---|---|---|---|
| 1 | Why is my uplink arriving with no payload? | Answerable ★ | D1 | Full answer, in the uplink troubleshooting section |
| 2 | Why is my uplink arriving with no decoded payload value? | Near-miss ★ (undocumented sibling of Q1) | D1 | Sibling only — the decoding-pipeline description, not this failure mode |
| 3 | What's the topic format for downlink? | Answerable | D1 | Full answer — downlink topic format |
| 4 | What's the message left when the connect is disconnected? | Underspecified — "message" and "connect" both need pinning down: the retained status message, the Last-Will payload, or something else | D1 | Describes several candidate concepts, none matching the question as asked |
| 5 | How do I tell if the device acknowledged? | Answerable | D1 | Full answer — the ack topic |
| 6 | How can the data received be edited/overwritten? | Near-miss ★ (undocumented sibling of Q7) | D2 | Sibling only — removal mechanics, nothing on editing (see note above) |
| 7 | How can the data can be removed? | Answerable ★ | D2 | Full answer — removal mechanics |
| 8 | How the uplinks are distributed on a queue? | Out of scope — internal ingestion mechanics, not documented for customers | D5 | High-level architecture mention only, no distribution detail |
| 9 | Whats is the timeout for receiving requests? | Underspecified — the docs name three different timeouts (join, downlink ack, HTTP); "requests" alone doesn't pick one | D4 | Names three distinct timeouts, none uniquely matching "requests" |
| 10 | What the device should be if it's offline or disconnected? | Depends on the reader — offline detection depends on the device's configured heartbeat/uplink interval | D3 | Full answer, conditioned on per-device heartbeat config |
| 11 | What's the retention on raw data? | Depends on the reader — retention window varies by plan | D2 | Full answer, conditioned on plan |
| 12 | What's the limitation(of data registers) for the bucket/database partition? | Depends on the reader — partition limits vary by plan | D2 | Full answer, conditioned on plan |
| 13 | How the real devices can be registered(EUI) into the platform? | Answerable | D3 | Full answer — EUI registration flow |
| 14 | How the devices can receive the firmwares updates? | Answerable | D3 | Full answer — firmware update flow |
| 15 | What are the client's MQTT broker limitations for the device's communication? | Out of scope — a client's own broker is their infrastructure, not Qualimetrics' | D5 | Explicit boundary statement: customer-owned infrastructure is out of scope |
| 16 | How the client's specific middleware can be integrated to the device and application? | Out of scope — unnamed third-party middleware isn't documented | D5 | Same boundary statement as Q15 |
| 17 | What are the main status code received by the API when fetching data(positive and negatives)? | Answerable | D4 | Full answer — status code table |
| 18 | How can I connect devices with different networks | Answerable | D3 | Full answer — connector / multi-network support |
| 19 | How can I set up a specific connector to device's creation | Answerable | D3 | Full answer — connector setup during device creation |
| 20 | How can the data received be manipulated via API to be used as data sheets and customizable analysis? | Underspecified — "data sheets" and "customizable analysis" aren't platform terms; needs a concrete export format or destination | D4 | Query/export endpoints described; not mapped to either named term |

**Distribution:** 9 answerable, 2 near-miss, 3 out-of-scope, 3 depends-on-reader,
3 underspecified. Answerable is the largest bucket here; the design effort
went into making sure the other eleven each detect a specific, named failure
mode instead of padding the count. (Not claiming this split matches real
corpora — haven't checked one.)

These 20 are a seed, not the golden set. Rung 6 grows this to 50 — more
per-category coverage, and likely more near-miss pairs once D1–D5 exist and
have more surface for facts to sit next to each other. This document stops at
20 because that's what's needed to start; it isn't the design ceiling.
