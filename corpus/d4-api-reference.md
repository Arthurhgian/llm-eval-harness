# API Reference

This page documents querying stored telemetry over HTTP, the status codes
the API returns, and the timeout behaviors that apply at different stages
of the platform. It is not a complete index of every API operation —
registering a device and delivering firmware are covered on their own page
(see Device Onboarding & Connectivity), and removing data is covered on
its own page (see Data Lifecycle & Retention).

Every endpoint on this page requires an API token in the `Authorization`
header, scoped to the operation being performed.

## Querying telemetry

To retrieve previously stored data for a device, send `GET
/devices/{device_eui}/data` with a time range (`start`, `end`, both ISO
8601) and optional pagination (`limit`, `cursor`). The response is a JSON
array of register objects, each carrying the register's timestamp, value,
and the port it was received on (see MQTT Topics & Messaging for where
these values come from).

```json
{
  "data": [
    { "timestamp": "2026-09-01T00:00:00Z", "port": 1, "value": 21.4 },
    { "timestamp": "2026-09-01T00:05:00Z", "port": 1, "value": 21.6 }
  ],
  "next_cursor": "eyJvZmZzZXQiOjJ9"
}
```

`next_cursor` is present whenever more data matches the query than fit in
one response; pass it back as `cursor` to fetch the next page.

## Status codes

| Code | Meaning | When it happens |
|---|---|---|
| 200 | OK | Request succeeded; response body attached |
| 400 | Bad Request | Malformed query — an invalid time range, an unparseable cursor |
| 401 | Unauthorized | Missing or invalid API token |
| 404 | Not Found | The device EUI in the path doesn't match a registered device |
| 429 | Too Many Requests | Caller is being throttled — retry after the interval named in the `Retry-After` header |
| 500 | Internal Server Error | Unexpected failure on Qualimetrics' side |

Every non-2xx response carries a JSON error body:

```json
{
  "error": {
    "code": "device_not_found",
    "message": "No device is registered for this EUI."
  }
}
```

`code` is a stable, machine-readable identifier. `message` is for humans
and its wording can change without notice — match error handling against
`code`, not `message`.

## Timeouts

Three unrelated timing limits apply at different stages of a request's
path through the platform. None of them share a name, and none of them is
"the" timeout for requests in general:

- **Join-accept window** — after a device sends a join-request, the
  network has a fixed window to deliver a join-accept before the device
  gives up and retries the join procedure on its own schedule. This is
  LoRaWAN join timing, not an API concept — it happens before a device has
  transmitted to any topic or endpoint.
- **Downlink acknowledgment window** — for a confirmed downlink (see MQTT
  Topics & Messaging), the network waits a fixed window for the device to
  confirm receipt before Qualimetrics considers the delivery attempt
  unacknowledged and eligible to be requeued.
- **API call timeout** — an HTTP request to this API that doesn't complete
  within Qualimetrics' server-side limit is dropped without a response.
  Set your own HTTP client's timeout at least this long, so a slow
  response isn't mistaken for a dropped connection.

Each bounds a different wait, at a different layer — device-to-network,
network-to-device, client-to-API. (For the unrelated MQTT session timeout
that triggers a Last-Will publish, see MQTT Topics & Messaging.)
