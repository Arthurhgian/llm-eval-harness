# MQTT Topics & Messaging

This page describes the MQTT topics Qualimetrics uses to exchange data with
your devices: uplink and downlink message formats, connection status, and
delivery acknowledgment. It assumes you already have an MQTT client
connected to your Qualimetrics broker with a valid application credential.

Qualimetrics devices communicate over LoRaWAN.

## Topic reference

| Topic | Direction | Published by | Payload |
|---|---|---|---|
| `qualimetrics/{device_eui}/up/{port}` | Device → Qualimetrics | Network, on receipt | Raw payload, base64-encoded |
| `qualimetrics/{device_eui}/up/{port}/decoded` | Device → Qualimetrics | Qualimetrics | Decoded payload, JSON |
| `qualimetrics/{device_eui}/down/{port}` | You → Device | You (publish to queue) | Payload to deliver, base64-encoded |
| `qualimetrics/{device_eui}/down/{port}/ack` | Qualimetrics → You | Qualimetrics | Delivery confirmation (confirmed downlinks only) |
| `qualimetrics/{device_eui}/status` | Qualimetrics → You | Qualimetrics | JSON status object, retained — see Connection status |

- `{device_eui}` is the device's 16-character hex EUI, as registered on the
  device record.
- `{port}` is the application port the message was sent or received on — an
  integer from 1 to 223, set per message by the device or your integration.
  Ports let a single device separate independent data streams (for example,
  sensor readings on one port and configuration acks on another) onto
  distinct topics.

## Uplink

### Raw payload

`qualimetrics/{device_eui}/up/{port}` carries the payload exactly as
received from the device, base64-encoded, with no transformation applied.
It's published at QoS 1 and is not retained — a client that wasn't
subscribed at delivery time will not see it later. This is the topic to
subscribe to if you want to do your own decoding client-side, or to verify
what a device actually sent independent of any configured decoder.

### Decoded payload

`qualimetrics/{device_eui}/up/{port}/decoded` carries the output of the
payload decoder assigned to the device's profile, as JSON. Field names and
types come from the decoder itself — check your device profile's decoder
script for the exact schema it produces. A typical decoded message looks
like:

```json
{
  "temperature_c": 21.4,
  "battery_v": 3.6,
  "seq": 118
}
```

The decoded message is a separate MQTT publish from the raw payload, sent
after it.

### Troubleshooting: uplink arrives with no payload

If you're receiving uplink activity — the device shows as transmitting —
but `qualimetrics/{device_eui}/up/{port}` carries an empty payload, check
the following, roughly in order of likelihood:

1. **Join state.** A device that has fallen out of a joined session can
   still generate radio activity visible to the network without a payload
   reaching the application layer. Check the device's join status on its
   detail page.
2. **Sensor read failure.** Some devices transmit a zero-length frame when
   an onboard sensor read fails, rather than skipping the transmission
   entirely. This is device-firmware behavior, not something Qualimetrics
   controls — check the device vendor's documentation for how it handles
   read failures.
3. **Wrong port.** Confirm you're subscribed to the port the device is
   actually transmitting on. A device sending on a different port than
   expected will look like silence on the port you're watching.
4. **Coverage.** Marginal signal can produce frames that the network
   accepts at the radio layer but that fail integrity checks before the
   payload is forwarded. Check the device's recent RSSI/SNR history.

## Downlink

### Queuing a downlink

Publish to `qualimetrics/{device_eui}/down/{port}` to queue a message for
delivery. The payload must be base64-encoded. Qualimetrics holds the
message and delivers it on the device's next available receive window;
delivery is not immediate unless the device is configured for
continuously-open receive.

### Delivery acknowledgment

For confirmed downlinks, Qualimetrics publishes to
`qualimetrics/{device_eui}/down/{port}/ack` once the network confirms the
device received the message. An unconfirmed downlink — the default unless
your device profile requests confirmation — has no acknowledgment; queuing
it successfully only means Qualimetrics accepted it for delivery, not that
the device received it.

## Connection status

`qualimetrics/{device_eui}/status` is a retained topic. Qualimetrics
publishes a JSON object to it whenever a device's connection state changes,
so a client that subscribes after the fact immediately receives the last
known state rather than waiting for the next change.

Coming online publishes:

```json
{ "status": "online" }
```

A graceful disconnect publishes:

```json
{ "status": "offline", "reason": "graceful" }
```

### Last-Will message

Separately, each device's MQTT session on the network side is registered
with a Last-Will and Testament (LWT). If the connection drops without a
graceful disconnect — a lost gateway link, a power loss, a session timeout
— the broker publishes the LWT payload to the same `.../status` topic on
the device's behalf:

```json
{ "status": "offline", "reason": "lwt" }
```

The `reason` field is what distinguishes an expected disconnect from an
unexpected one; the `status` value alone does not.
