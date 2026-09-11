# Data Lifecycle & Retention

This page covers how long Qualimetrics keeps device telemetry, the
capacity limits on a device's stored data, and how to remove device data.
For MQTT topic formats, see MQTT Topics & Messaging.

## Storage

Each device has one bucket, holding both raw and decoded telemetry (see
MQTT Topics & Messaging for where these values come from) as individual
data registers — one register per stored value, per timestamp. Buckets are
partitioned automatically once they grow past an internal size threshold;
partitioning is not user-configurable.

Retention windows and the number of registers a bucket can hold before the
oldest are dropped are both set by your plan:

| Plan | Raw data retention | Registers per bucket |
|---|---|---|
| Starter | 30 days | 100,000 |
| Growth | 180 days | 1,000,000 |
| Enterprise | 2 years | Negotiated per contract |

Check your account's plan page to confirm which tier applies.

## Removing data

To remove previously received data, send `DELETE /devices/{device_eui}/data`
with a JSON body specifying either a time range (`start`, `end`, both ISO
8601) or a list of register IDs. The request requires a token scoped for
data deletion. Deletion takes effect immediately; there is no undo.
