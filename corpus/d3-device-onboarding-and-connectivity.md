# Device Onboarding & Connectivity

This page covers registering a device, updating its firmware, how its
status is determined, and the two separate choices you make when creating
it: which network it joins and which connector configures it.

## Registering a device

To register a device, provide its 16-character hex EUI — either one at a
time via `POST /devices` (`{"device_eui": "...", "network": "...",
"connector": "..."}`) or in bulk via a CSV upload on the dashboard's
Devices page. A device becomes active once it successfully joins its
network (see Networks, below).

## Firmware updates

Devices whose profile has firmware update support enabled can receive
firmware over the air. Upload the firmware image via `POST
/devices/{device_eui}/firmware` or the dashboard, and Qualimetrics
schedules delivery across the device's downlink windows (see MQTT Topics
& Messaging), fragmenting the image as needed. Devices without firmware
update support in their profile need a different update path — check with
the device vendor.

## Device status

Each device has an expected reporting interval, set on its device
profile. Status — shown on the dashboard and returned by `GET
/devices/{device_eui}` — is computed from it:

- **online** — an uplink arrived within one interval
- **stale** — no uplink for 1–3 intervals
- **offline** — no uplink for 3 or more intervals

A device expected to report every 60 seconds goes stale after 3 minutes; a
device expected to report daily doesn't go stale for three days — the
thresholds scale with what that specific device is configured to do, not
a fixed clock. This is a different signal from the connection status
topic in MQTT Topics & Messaging, which tracks the network session, not
application reporting cadence.

## Networks

Qualimetrics devices join one of several LoRaWAN networks, set on the
device record via the `network` field: Qualimetrics' own shared network
by default, or — on Enterprise plans — a private network you operate.
Move a device to a different network by updating this field; the device
rejoins on its next transmission.

## Connectors

A connector is a preset bundle — a decoder and default profile settings —
for a specific device model or vendor. Choose one during device creation
(`POST /devices` with `connector: "<connector-id>"`, or the dashboard's
device-creation wizard) to apply its preset instead of configuring each
setting individually. Browse available connectors at Settings →
Connectors, or build a custom one for a device model without a preset.
