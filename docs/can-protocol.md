# CAN protocol

[Documentation index](README.md) · [Firmware](firmware.md) · [Laptop tools](../tools/README.md)

This is the project's own telemetry format. The definitions are in
[can_protocol.h](../Inc/can_protocol.h) and the encoder in
[can_protocol.c](../Src/can_protocol.c).

## Bus and encoding

- Classical CAN at **500,000 bit/s**; CAN FD and bitrate switching disabled.
- Standard **11-bit** identifiers and eight-byte data payloads.
- Multi-byte integers are **little-endian**.
- Protocol version is `1`.
- Each message type has its own eight-bit sequence counter, wrapping after 255.
- Nominal periods assume normal operation; reception may be delayed or missing
  if transmission is blocked or the bus is unavailable.

## Engine heartbeat — `0x100`

Nominal period: **500 ms**.

| Byte | Field | Encoding |
| --- | --- | --- |
| 0 | Protocol version | `1` |
| 1 | Node type | `1` = engine node |
| 2 | Node status | `0x01` = bench-test firmware |
| 3 | Sequence | Unsigned eight-bit counter |
| 4–7 | Uptime | Unsigned 32-bit milliseconds since startup |

The uptime field wraps with the 32-bit tick counter. A restart resets the
uptime and sequence counters. The node status is a firmware-stage indicator,
not the coolant sensor's fault status.

Example from the decoder tests:

```text
ID 0x100    01 01 01 2A 78 56 34 12
Protocol 1, engine node 1, bench status 1, sequence 42
Uptime = 0x12345678 = 305419896 ms
```

## Coolant outlet — `0x110`

Nominal period: **250 ms**. This is the first TX3 channel on A0/PA0.

| Byte | Field | Encoding |
| --- | --- | --- |
| 0 | Protocol version | `1` |
| 1 | Sensor ID | `1` = thermostat-outlet coolant |
| 2 | Sensor status | Flags below; zero means valid |
| 3 | Sequence | Unsigned eight-bit counter |
| 4–5 | ADC reading | Unsigned 16-bit field containing the averaged 12-bit count |
| 6–7 | Temperature | Signed 16-bit integer in tenths of a degree Celsius |

On a fault, the firmware sends `-32768` (`00 80` in wire byte order) as the
invalid temperature value. Consumers should check status before displaying
temperature. The current Python decoder hides temperature whenever status is
nonzero; it does not independently validate protocol version or sensor ID.

| Status | Meaning | Current firmware condition |
| --- | --- | --- |
| `0x00` | Valid | Conversion completed without a fault |
| `0x01` | Open circuit | ADC count >= 4050 |
| `0x02` | Short circuit | ADC count <= 16 |
| `0x04` | ADC error | ADC acquisition failed |
| `0x08` | Calculation error | Invalid/non-finite or unrepresentable conversion result |

Flags occupy individual bits, although the present firmware returns one fault
at a time. The host maps these individual values to labels; combined/unknown
values are shown as unknown status and still suppress temperature.

Example from the decoder tests:

```text
ID 0x110    01 01 00 07 32 08 0A 01
Protocol 1, sensor 1, valid, sequence 7
ADC = 0x0832 = 2098
Temperature = 0x010A = 266 tenths = 26.6 °C = 79.88 °F
```

The host's displayed voltage is `adc_raw * 3.3 / 4095`, using a nominal 3.3 V
reference. It is an estimate derived from the count, not a separate voltage
measurement. Temperature comes from the firmware's transmitted value.

## Planned expansion

The second coolant channel and pressure inputs have no implemented message
definitions yet. Allocate their IDs and payloads alongside the firmware and
host changes, then update this reference. There is currently no DBC file,
configuration protocol, or vehicle-control message set.
