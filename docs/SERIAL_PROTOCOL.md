# Serial Protocol v1

Transport is USB serial at 921600 baud. Messages are newline-delimited UTF-8 JSON objects. Human-readable commands are newline-terminated ASCII strings.

## Matrix frame

```json
{
  "protocolVersion": 1,
  "type": "matrix_frame",
  "sequence": 143,
  "deviceUptimeMs": 81234,
  "rows": 25,
  "columns": 25,
  "scanDurationMs": 84,
  "minimum": 0,
  "maximum": 2871,
  "values": []
}
```

For a 25×25 scan, `values` must contain exactly 625 nonnegative integers. Values are flattened in row-major order:

```text
index = row * columns + column
row = floor(index / columns)
column = index % columns
```

The dashboard rejects malformed JSON and frames whose dimensions do not match the array length. Sequence gaps are available for future dropped-frame reporting.

## Commands

- `PING`: request a `pong` message.
- `START_STREAM`: enable continuous frames.
- `STOP_STREAM`: suspend continuous frames.
- `CALIBRATE_BASELINE`: average 20 unloaded scans into a per-cell baseline.
- `GET_CONFIG`: return protocol and matrix dimensions.

## Calibration acknowledgment

```json
{"protocolVersion":1,"type":"command_ack","command":"CALIBRATE_BASELINE","ok":true}
```

## Status

At boot, firmware sends a `status` message reporting readiness and the compiled matrix dimensions.

## Compatibility

Any breaking field or framing change requires a new `protocolVersion`. Adding optional fields does not require a version change when older clients can ignore them safely.
