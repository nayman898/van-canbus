# Van CAN bus

Prototype CAN network for a 1982 Ford E-350. The first node is a read-only
engine-monitoring controller built on an ST NUCLEO-G0B1RE and an Adafruit CAN
Pal transceiver. A BTT U2C V2.1 provides the laptop/Pi CAN interface.

The current bench firmware transmits a Classical CAN heartbeat and the first
TX3 coolant-temperature input at 500 kbit/s.

The provisional vehicle wiring and connector allocation are documented in
[the engine-node harness plan](docs/engine-node-harness.md).
It does not control the engine, fuel system, cooling fans, or any other output.

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
- Coolant identifier: standard 11-bit ID `0x110`
- Coolant period: 250 ms
- Coolant input: Arduino A0 / PA0 / ADC1_IN0
- TX3 pull-up: nominal 2.47 kohm to 3.3 V

| Byte | Meaning |
| ---: | --- |
| 0 | Protocol version (`1`) |
| 1 | Node type (`1` = engine node) |
| 2 | Status (`0x01` = bench-test firmware) |
| 3 | Rolling sequence counter |
| 4-7 | Uptime in milliseconds, little-endian |

Coolant frame `0x110`:

| Byte | Meaning |
| ---: | --- |
| 0 | Protocol version (`1`) |
| 1 | Sensor (`1` = thermostat-outlet coolant) |
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
git clone <repository-url>
cd van-canbus
git submodule update --init --depth 1 third_party/STM32CubeG0
git -C third_party/STM32CubeG0 submodule update --init --depth 1 Drivers/STM32G0xx_HAL_Driver Drivers/CMSIS/Device/ST/STM32G0xx
```

From STM32CubeIDE for VS Code, select the `Debug` CMake preset and build. The
build creates `.elf`, `.hex`, and `.bin` images under `build/Debug`.

## Laptop monitor

Install Python 3, create a virtual environment, and install the monitor's
dependencies:

```powershell
py -m venv .venv
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

Run the host-side protocol decoder tests with:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

## Safety boundary

This is bench-test firmware. Do not connect the RECOM regulator directly to
vehicle power until fused input, reverse-polarity protection, and automotive
transient/load-dump protection have been added and verified.
