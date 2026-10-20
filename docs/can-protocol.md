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

## Coolant temperatures — `0x110` and `0x111`

Nominal period: **250 ms per sensor**, each with an independent sequence counter.

| Location | Sensor ID | CAN ID | ADC input |
| --- | --- | --- | --- |
| Pre-radiator (engine outlet) | 1 | `0x110` | A0 / PA0 / ADC1_IN0 |
| Post-radiator (radiator outlet) | 2 | `0x111` | A1 / PA1 / ADC1_IN1 |

Both are TX3 thermistors with separate 2.47-kohm pull-ups. Sensor 1 retains
its existing wire format; adding sensor 2 does not change protocol version.

| Byte | Field | Encoding |
| --- | --- | --- |
| 0 | Protocol version | `1` |
| 1 | Sensor ID | `1` = pre-radiator; `2` = post-radiator |
| 2 | Sensor status | Flags below; zero means valid |
| 3 | Sequence | Unsigned eight-bit counter |
| 4–5 | ADC reading | Unsigned 16-bit field containing the averaged 12-bit count |
| 6–7 | Temperature | Signed 16-bit integer in tenths of a degree Celsius |

On a fault, the firmware sends `-32768` (`00 80` in wire byte order) as the
invalid temperature value. Consumers should check status before displaying
temperature. Both host decoders validate status, protocol version, matching
CAN/sensor identity, ADC range, and the invalid-temperature sentinel. Each UI
tracks freshness per sensor and hides temperatures after 1.5 seconds without
that sensor's message, or when disconnected.

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

For the same test reading on sensor 2, use `0x111` with payload
`01 02 00 07 32 08 0A 01`. An absent second sensor with its pull-up installed
reports an open-circuit fault; it does not suppress sensor 1.

## Fuel level — `0x120`

Nominal period: **500 ms**, with its own sequence counter. Input is
A5 / PB12 / ADC1_IN16 using the isolated 1k pull-up circuit in the
[fuel-level guide](fuel-level.md). The original dash gauge must be disconnected.
This additive message retains protocol version 1 and all existing coolant IDs.

| Byte | Field | Encoding |
| --- | --- | --- |
| 0 | Protocol version | `1` |
| 1 | Sensor identity | `1` = single fuel tank |
| 2 | Status | Flags below; zero means valid |
| 3 | Sequence | Unsigned eight-bit counter |
| 4–5 | ADC reading | Averaged 12-bit count, unsigned little-endian |
| 6–7 | Resistance | Unsigned little-endian tenths of an ohm; `65535` invalid |

| Status | Meaning | Firmware condition |
| --- | --- | --- |
| `0x00` | Valid | Resistance 5–100 ohms after conversion |
| `0x01` | Open circuit | ADC >= 4050 |
| `0x02` | Short circuit | ADC <= 4 |
| `0x04` | ADC error | Acquisition failed or raw count exceeds 4095 |
| `0x08` | Out of range | Other counts convert outside the 5–100-ohm diagnostic range |

The fuel short threshold is intentionally lower than coolant's: a normal full
sender produces only about 41 counts with the 1k pull-up. Status `0x08` means
OUT OF RANGE here, not coolant's CALC ERROR. A fault always carries the invalid
resistance sentinel; no fault should be interpreted as empty/full. Android
also rejects unsupported versions, sensor IDs, special CAN frames, invalid
counts, the sentinel, and out-of-range resistance before displaying level.

Golden vector: `01 01 00 07 1E 01 EF 02` = sequence 7, ADC 286, **75.1 ohms**.
Open vector: `01 01 01 FF FF 0F FF FF` = sequence 255, ADC 4095, invalid resistance.

Voltage is estimated as `ADC * 3.3 / 4095`, not measured independently.
Resistance is ratiometric when the pull-up uses the ADC reference supply.
Fuel percentage is not on the wire: Android's explicitly uncalibrated estimate
uses 75-ohm empty / 10-ohm full endpoints and five-second display damping.
The fuel card becomes stale after 1.5 seconds without its own frames and hides
level on USB disconnect. A current node sends about **12 frames/s** including
the existing heartbeat and two coolant channels. Hardware acceptance is pending.

## Planned expansion

RPM and pressure inputs have no implemented message definitions yet.
Allocate their IDs and payloads alongside the firmware and
host changes, then update this reference. There is currently no DBC file,
configuration protocol, or vehicle-control message set.
