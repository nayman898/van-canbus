# Firmware build and source guide

[Documentation index](README.md) · [CAN protocol](can-protocol.md)

The firmware targets the STM32G0B1RET6 on the NUCLEO-G0B1RE. It uses ST's HAL,
a polling main loop, ADC1, and FDCAN1 operating in Classical CAN mode.

## Clone and dependencies

```powershell
git clone https://github.com/nayman898/van-canbus.git
cd van-canbus
git submodule update --init --depth 1 third_party/STM32CubeG0
git -C third_party/STM32CubeG0 submodule update --init --depth 1 Drivers/STM32G0xx_HAL_Driver Drivers/CMSIS/Device/ST/STM32G0xx
```

The repository pins STM32CubeG0 as a submodule. Initialize the two nested
driver modules shown above rather than downloading every example dependency.
GitHub source ZIPs do not include the initialized submodule contents.

## Build

The project is set up for STM32CubeIDE for VS Code. Open the repository, select
the `Debug` CMake preset, and build using the IDE's Arm toolchain environment.

For a command-line build, provide Git, CMake **3.21 or newer** (for the version-3
preset file; see [CMake's version table](https://cmake.org/cmake/help/latest/manual/cmake-presets.7.html#versions)),
Ninja, and the Arm GNU tools on `PATH`: `arm-none-eabi-gcc`,
`arm-none-eabi-g++`, and `arm-none-eabi-objcopy`.

```powershell
cmake --preset Debug
cmake --build --preset Debug
```

For an optimized build, use `Release` in both commands. The presets write to
separate `build/Debug` and `build/Release` directories.

| Debug output | Purpose |
| --- | --- |
| `build/Debug/van-canbus.elf` | Firmware with symbols for programming/debugging |
| `build/Debug/van-canbus.hex` | Intel HEX image with addresses |
| `build/Debug/van-canbus.bin` | Raw binary image |
| `build/Debug/van-canbus.map` | Linker memory map |

The HEX and BIN files are generated automatically after a successful link.
If configuring outside the IDE, use a shell with the toolchain available;
the repository does not bundle the compiler, CMake, or Ninja.

## Program the board

Connect the Nucleo through its onboard ST-Link USB connection. Use the IDE's
ST-Link programming/debug workflow for the `van-canbus.elf` artifact, or open
the generated HEX in STM32CubeProgrammer and program through ST-Link/SWD.
Start/reset the target after programming, then verify reception using the
[bench guide](bench-setup.md). Building an image alone does not program it.

## What the code does

At startup the firmware configures its clock, PA5 status LED, ADC1, and FDCAN1,
including ADC calibration before starting CAN. The main loop schedules the
heartbeat every 500 ms and coolant sampling/transmission every 250 ms.

Each coolant reading averages 32 ADC conversions, checks fault thresholds,
and converts thermistor resistance to temperature with a Steinhart-Hart fit.
Failed ADC reads produce a fault payload instead of a valid temperature.

The two sequence counters advance independently when frames are successfully
queued. PA5 toggles on a queued heartbeat, not on confirmation that the laptop
received it. The CAN controller uses automatic retransmission. Incoming frames
are rejected by the configured global filter; there is no command handler.

| File | Responsibility |
| --- | --- |
| [Src/main.c](../Src/main.c) | Peripheral configuration, scheduling, ADC averaging, CAN transmission |
| [Src/stm32g0xx_hal_msp.c](../Src/stm32g0xx_hal_msp.c) | Peripheral clocks and PA0/PA11/PA12 pin setup |
| [Inc/can_protocol.h](../Inc/can_protocol.h) | Message IDs, periods, protocol constants |
| [Src/can_protocol.c](../Src/can_protocol.c) | Byte-level payload encoding |
| [Inc/tx3_sensor.h](../Inc/tx3_sensor.h) | Pull-up value, thresholds, status flags |
| [Src/tx3_sensor.c](../Src/tx3_sensor.c) | Thermistor conversion and range/fault handling |
| [CMakeLists.txt](../CMakeLists.txt) | Target sources, HAL dependencies, HEX/BIN generation |

## Changing the prototype

- **Different measured pull-up:** update `TX3_PULLUP_OHMS` and check against an
  independent temperature measurement.
- **Different CAN bitrate:** change the actual FDCAN timing in `FDCAN1_Init`
  and the host tool's `--bitrate`. Editing `CAN_BUS_BITRATE` alone does not
  reconfigure the peripheral; its timing fields are currently set explicitly.
- **Second sensor:** add its input circuit, ADC configuration, firmware
  sampling, protocol definition, and host decoding/UI. A reserved harness
  cavity does not enable it.

## Checks

With the Python dependencies installed, run the existing host decoder tests:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

These tests exercise heartbeat/coolant parsing, malformed payload lengths, and
fault presentation. They do not validate MCU timing, physical wiring, sensor
calibration, or vehicle-input protection. Those need the documented bench and
hardware checks.
