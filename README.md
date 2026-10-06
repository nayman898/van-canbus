# Van CAN bus

A build-in-progress engine monitoring system for a **1982 Ford E-350**.
This repository contains the STM32 firmware, a laptop dashboard, and wiring
notes so others can follow along with the build.

The native [Android dashboard](android-app/README.md) connects a BTT U2C
directly to a phone or head unit over USB Host, without requiring a laptop or
Raspberry Pi in the vehicle.

[GitHub Actions](docs/automation.md) tests the host tools and CAN encoders,
builds both firmware configurations and the Android APK, and publishes the
generated wiki after successful pushes to `main`. Build downloads are attached
to each workflow run.

The first node uses an ST NUCLEO-G0B1RE and an Adafruit CAN Pal transceiver.
A BTT U2C V2.1 connects the bus to either the Android app or laptop. This is a
custom telemetry network, not an OBD-II scanner or decoder for a factory
vehicle network.

The current bench firmware transmits a Classical CAN heartbeat and two TX3
coolant-temperature inputs (pre- and post-radiator) at 500 kbit/s.

The provisional vehicle wiring and connector allocation are documented in
[the engine-node harness plan](docs/engine-node-harness.md).
It does not control the engine, fuel system, cooling fans, or any other output.
The node actively transmits its own CAN messages; “read-only engine monitoring”
does not mean CAN listen-only mode.

## How it fits together

```mermaid
flowchart LR
    TX3[TX3 coolant sensor] -->|Analog voltage| MCU[NUCLEO-G0B1RE]
    MCU -->|CAN TX / RX| PAL[Adafruit CAN Pal]
    PAL <-->|CAN-H / CAN-L + ground| U2C[BTT U2C V2.1]
    U2C <-->|USB| HOST[Android app or laptop dashboard]
```

The Nucleo samples the sensor and encodes the messages. The CAN Pal provides
the physical CAN interface; the U2C bridges the bus to Android or the laptop.
The working bench setup uses USB power for the Nucleo and U2C.

## Current status

| Area | What exists today |
| --- | --- |
| CAN and coolant channel 1 | Working on the bench at 500 kbit/s |
| Android app | Native U2C dashboard, raw-frame view, and CSV logging |
| Laptop tools | Terminal monitor and live browser dashboard |
| Vehicle harness | Provisional 6-pin power/CAN and 12-pin sensor allocations |
| Vehicle power | Protection parts selected; assembly/vehicle validation still pending in the build notes |
| Coolant channel 2 | Two-channel firmware flashed/verified; phone operation confirmed and both readings received on PC |
| Additional sensors | Pressure inputs planned |
| Recording | Raw-frame CSV recording and export in the Android app |

## Follow the build

| Guide | What it covers |
| --- | --- |
| [Documentation index](docs/README.md) | Suggested reading and build order |
| [Build progress](docs/build-progress.md) | Completed milestones, design choices, and next steps |
| [Hardware](docs/hardware.md) | Bench parts, sensor circuit, and hardware references |
| [Bench setup](docs/bench-setup.md) | Wiring, first power-up, expected readings, and troubleshooting |
| [Harness and vehicle power](docs/engine-node-harness.md) | Connector assignments and staged power-input work |
| [Firmware](docs/firmware.md) | Build, programming, and source walkthrough |
| [CAN protocol](docs/can-protocol.md) | Message layouts, units, fault flags, and examples |
| [Laptop tools](tools/README.md) | Dashboard, terminal monitor, setup, and limitations |
| [Android app](android-app/README.md) | Direct U2C connection, phone setup, and logging |

## Bench wiring

| Nucleo / CAN Pal | Connection |
| --- | --- |
| Nucleo 3V3 | CAN Pal Vcc |
| Nucleo GND | CAN Pal GND |
| Nucleo PA12 / FDCAN1_TX | CAN Pal TX |
| Nucleo PA11 / FDCAN1_RX | CAN Pal RX |
| CAN Pal SLNT | GND |
| CAN Pal H | U2C H |
| CAN Pal L | U2C L |
| CAN Pal terminal GND | U2C GND |

Leave the U2C V+ terminal disconnected. Enable one 120-ohm terminator at each
end. With all USB cables unplugged, CAN-H to CAN-L should measure about 60 ohms.

## Firmware behavior

- Bus: Classical CAN, 500 kbit/s
- Heartbeat identifier: standard 11-bit ID `0x100`
- Period: 500 ms
- Payload: protocol, node, status, sequence, and 32-bit little-endian uptime
- Nucleo LED PA5 toggles whenever a heartbeat is successfully queued
- Coolant identifiers: `0x110` pre-radiator, `0x111` post-radiator (standard 11-bit)
- Coolant period: 250 ms per sensor
- Coolant inputs: pre-radiator A0 / PA0 / ADC1_IN0; post-radiator A1 / PA1 / ADC1_IN1
- TX3 pull-up: nominal 2.47 kohm to 3.3 V

| Byte | Meaning |
| ---: | --- |
| 0 | Protocol version (`1`) |
| 1 | Node type (`1` = engine node) |
| 2 | Status (`0x01` = bench-test firmware) |
| 3 | Rolling sequence counter |
| 4-7 | Uptime in milliseconds, little-endian |

Coolant frames `0x110` and `0x111`:

| Byte | Meaning |
| ---: | --- |
| 0 | Protocol version (`1`) |
| 1 | Sensor (`1` = pre-radiator, `2` = post-radiator) |
| 2 | Status (`0` valid, bit 0 open, bit 1 short, bit 2 ADC, bit 3 calculation) |
| 3 | Rolling sequence counter |
| 4-5 | Averaged 12-bit ADC count, little-endian |
| 6-7 | Signed temperature in 0.1 degrees C, little-endian; `-32768` if invalid |

The temperature conversion uses a three-point Steinhart-Hart fit for the TX3:
9335 ohms at 0 C, 3500 ohms at 20 C, and 336 ohms at 80 C. Update
`TX3_PULLUP_OHMS` in `Inc/tx3_sensor.h` if the measured pull-up differs from
2470 ohms.

## Clone and build

Clone the repository, then initialize the pinned STM32CubeG0 dependency and
only the two nested ST driver modules this firmware uses:

```powershell
git clone https://github.com/nayman898/van-canbus.git
cd van-canbus
git submodule update --init --depth 1 third_party/STM32CubeG0
git -C third_party/STM32CubeG0 submodule update --init --depth 1 Drivers/STM32G0xx_HAL_Driver Drivers/CMSIS/Device/ST/STM32G0xx
```

From STM32CubeIDE for VS Code, select the `Debug` CMake preset and build. The
build creates `.elf`, `.hex`, and `.bin` images under `build/Debug`.

## Laptop monitor

Install Python 3.10 or newer, create a virtual environment, and install the monitor's
dependencies:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python tools\monitor_can.py
```

The U2C must use its normal `CAN OUT` H/L/GND connection and its `120R` jumper.

For a graphical dashboard, run:

```powershell
.\.venv\Scripts\python tools\can_dashboard.py
```

The dashboard opens at `http://127.0.0.1:8765` and displays live coolant
temperature, ADC voltage, sensor faults, node uptime, and CAN connection state.
It automatically retries if the USB CAN adapter is temporarily disconnected.
On Windows, `start_dashboard.bat` provides a one-click launcher after the Python
environment has been installed.

The dashboard displays live readings and retains the latest values in memory;
it does not save recordings. See the [tools guide](tools/README.md) for options,
troubleshooting, and a way to capture a basic terminal transcript.

Run the host-side protocol decoder tests with:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

## Safety boundary

This is bench-test firmware. Do not connect the RECOM regulator directly to
vehicle power until fused input, reverse-polarity protection, and automotive
transient/load-dump protection have been added and verified.
Sensor-input transient protection and a secured harness/enclosure are also
still needed before vehicle installation.

## Questions and build feedback

Questions and observations are welcome in
[GitHub Issues](https://github.com/nayman898/van-canbus/issues). Include the board
and adapter versions, firmware commit, wiring, and observed behavior so your
setup can be compared with this one.
