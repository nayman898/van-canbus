# Getting started

[Guide index](README.md) · [Hardware](hardware.md) · [Build progress](build-progress.md)

Start with a **USB-powered, two-temperature bench setup**. This project is a
custom 500 kbit/s CAN network for an older van, not an OBD-II adapter. It
monitors the engine; it does not control ignition, fuel, fans or other outputs.

## 1. Choose a display

| Route | Required receiver | What you get | Setup |
| --- | --- | --- | --- |
| Windows laptop | BTT U2C V2.1, USB data cable | Live two-temperature dashboard; optional console transcript | [Laptop tools](../tools/README.md) |
| Android 8.0 or newer | BTT U2C V2.1, USB Host/OTG connection | Live dashboard and persistent raw-frame CSV logging/export | [Android dashboard](../android-app/README.md) |
| Phone/browser over Wi-Fi | Classic ESP32-WROOM-32 development board plus its own CAN Pal | Live dashboard and latest 256-frame CSV snapshot; no SD card needed | [ESP32 gateway](esp32-logger.md) |

The Nucleo engine node and its CAN Pal are required for all three routes.
The ESP32 replaces the U2C for Wi-Fi viewing; it does not replace the Nucleo or
the sensor circuits. One U2C can be connected to one USB host/application at
a time. Start with one receiver; additional receivers can be added later.

## 2. Gather the bench hardware

Use the [bench parts table](hardware.md#bench-parts): NUCLEO-G0B1RE, engine-node
CAN Pal, two TX3 thermistors, two independent input/filter circuits, CAN wiring,
USB power/data cables, a multimeter, and your selected receiver above.
Each TX3 needs a nominal 2.47-kohm pull-up to 3.3V, a 1-kohm series resistor
to its ADC input, and a 100nF capacitor from that ADC pin to ground.
An ESP32 receiver needs a **second** CAN transceiver; its Wi-Fi module cannot
connect directly to CAN-H/L.

Before buying substitute sensors or boards, compare their exact pinouts and
electrical specifications with the relevant guide. The pressure and CoilX
hardware are not required to get coolant readings working.

## 3. Get the software

From a terminal with Git installed:

```sh
git clone https://github.com/nayman898/van-canbus.git
cd van-canbus
```

For ready-built firmware/APKs, use the [Actions download instructions](automation.md#download-a-build).
Choose artifacts for the same source commit. A job's artifact can be usable
even if another job in that run failed; check that the **producing job** passed.
Artifacts expire after 14 days and downloading may require a GitHub sign-in.
If there is no matching artifact, build from source using the guides below.

- **Nucleo:** download `firmware-Debug-<commit>`, then program its
  `van-canbus.hex` through the onboard ST-Link using STM32CubeProgrammer.
  Alternatively, initialize the submodules and [build the firmware](firmware.md).
  Start/reset the target after programming.
- **Laptop:** install Python and the pinned dependencies using
  [Install on Windows](../tools/README.md#install-on-windows).
- **Android:** install `app-debug.apk` from `android-debug-<commit>` using
  the [APK instructions](../android-app/README.md#install-a-built-apk).
- **ESP32:** follow [Build and flash](esp32-logger.md#build-and-flash);
  its firmware and flashing process are separate from the Nucleo's.

Do not expect a GitHub source ZIP to contain STM32 submodule dependencies,
Python environments, private Wi-Fi credentials or local recovery files.

To try the ESP32 interface before wiring hardware, run
`python tools/preview_esp32_logger.py` and open `http://127.0.0.1:8766`.
Its banner identifies **simulated data**; this preview does not open the U2C
or connect to the van. Stop it with Ctrl+C when finished.

## 4. Wire and power the bench network

Follow [Bench setup](bench-setup.md) with all power removed while wiring:

1. Connect Nucleo PA12/TX and PA11/RX to its CAN Pal, powered from 3.3V.
2. Connect H to H, L to L and reference ground to your receiver. Use a twisted
   H/L pair. Ground CAN Pal SLNT. Leave the U2C V+ terminal disconnected.
3. Fit **two 120-ohm terminations total**, one at each physical bus end.
   With all supplies/USB cables disconnected, expect about 60 ohms H-to-L.
   Adding a receiver does not mean adding a third terminator.
4. Wire the two independent TX3 circuits: pre-radiator to A0/PA0,
   post-radiator to A1/PA1. Keep vehicle power and ignition signals disconnected.
5. Power the Nucleo through ST-Link USB and start your chosen receiver.
   Use the [ESP32 wiring table](esp32-logger.md#board-wiring) for the Wi-Fi route.

If you have only one sensor, the other channel reports OPEN when its pull-up
is fitted. That does not stop the connected sensor from reporting.

## 5. Confirm it works

| Check | Expected result |
| --- | --- |
| CAN traffic | `0x100` heartbeat twice/second; `0x110` and `0x111` four times/second each |
| Connected TX3 sensors | Two plausible, independently updating temperatures |
| Warm one sensor | Only the corresponding temperature changes |
| Disconnect one sensor while unpowered, then restart | That channel reports OPEN; the other still updates |
| Stop engine-node transmission | Both temperature cards clear after about 1.5 seconds |
| Android logging | START LOG, STOP LOG, EXPORT produce a saved CSV |
| ESP32 without SD | Live only; Export recent CSV works; history clears at power-off |

These checks establish reception and channel identity, not temperature
calibration. Use an independent temperature reference for calibration.
Troubleshoot with [Bench setup](bench-setup.md#troubleshooting),
[Laptop tools](../tools/README.md#troubleshooting), or the
[ESP32 guide](esp32-logger.md#troubleshooting).

## 6. Print and expand after the bench test

Use [Printed cases and mounts](printing.md) for ESP32 compact V3, the U2C
case and the engine-node carrier. Print fit tests before full parts.
The [harness and power plan](engine-node-harness.md) covers the separate stage
of preparing vehicle power; the engine node's protected power system is not
yet a validated vehicle installation.

RPM capture and pressure acquisition/messages/displays are **not implemented**.
[CoilX RPM](rpm-input.md) and the [GlowShift board](glowshift-circuit.md) are
documented expansion work; reserved connector cavities do not enable them.
ESP32 continuous SD recording is optional firmware functionality requiring
additional hardware and its own bench tests. The current live build does not
retain a whole trip through a power cycle.

When asking for help, include the source commit/artifact, exact board models,
receiver route, wiring/termination checks, error text and observed CAN IDs.
Keep device Wi-Fi passwords and other credentials out of public reports.
