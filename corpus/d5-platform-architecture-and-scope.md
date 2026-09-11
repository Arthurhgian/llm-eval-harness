# Platform Architecture & Scope

This page gives a high-level view of how Qualimetrics processes device
data, and states what the platform does and doesn't cover.

## How ingestion works

When a device transmits, the network forwards the raw frame to
Qualimetrics over a private link. Frames are queued for processing, then
validated, decoded, and stored in the device's bucket (see Data Lifecycle
& Retention) before being published as MQTT messages (see MQTT Topics &
Messaging for the raw and decoded topics).

Processing is asynchronous: MQTT delivery order is not guaranteed to match
arrival order under load. If your application needs strict ordering, sort
by the timestamp on each register instead of relying on message delivery
order.

## What's out of scope

Qualimetrics documents the platform: MQTT topics, the API, device
onboarding, and data lifecycle. It does not document or support
infrastructure you own — your own MQTT broker's configuration and limits,
message-queuing systems, or middleware you build between your application
and Qualimetrics's API and topics. For those, consult your own team's
documentation or the relevant vendor.
