# Build documentation

[Project home](../README.md)

These notes describe the engine-monitoring system as it is being built. A
working bench circuit, a proposed vehicle circuit, and a reserved connector pin
are different stages of the project; each guide identifies which it describes.

**For a first build, follow [Getting started](getting-started.md).** It covers
receiver choice, minimum parts, software downloads, wiring and expected results.

## If you want to see how it is being built

Start with [build progress](build-progress.md), then read the
[hardware guide](hardware.md) and [harness plan](engine-node-harness.md).
They cover the parts, the first sensor circuit, the two-plug layout, and the
work still needed before installation.

## If you want to reproduce the bench setup

1. Gather the [bench hardware](hardware.md#bench-parts).
2. Clone and build the [firmware](firmware.md).
3. Follow the [bench wiring and bring-up](bench-setup.md).
4. Install and start the [laptop tools](../tools/README.md).
5. Compare the readings with the [CAN protocol](can-protocol.md).

For direct phone viewing without a PC or Pi, use the
[Android app guide](../android-app/README.md): APK installation, U2C connection,
two-temperature display, CSV logging/export, and troubleshooting. In the wiki,
this is the **Android dashboard** sidebar entry (`Android-App`).

Vehicle-power tests are a later stage in the [harness plan](engine-node-harness.md),
not a prerequisite for reproducing the USB-powered bench network.

## Where to find each kind of information

| Information | Maintained in |
| --- | --- |
| First setup and choice of display | [Getting started](getting-started.md) |
| Parts and sensor circuit | [Hardware](hardware.md) |
| Ford 400M CoilX RPM input | [RPM circuit](rpm-input.md) |
| GlowShift senders and calibration | [GlowShift inputs](glowshift-inputs.md) |
| Three-channel pressure input board | [Circuit and assembly](glowshift-circuit.md) |
| Board-to-board bench wiring | [Bench setup](bench-setup.md) |
| External connector cavity assignments | [Harness plan](engine-node-harness.md) |
| Firmware build and source organization | [Firmware](firmware.md) |
| CAN IDs and byte layouts | [CAN protocol](can-protocol.md) |
| Python commands and dashboard behavior | [Laptop tools](../tools/README.md) |
| Completed work and open design decisions | [Build progress](build-progress.md) |
| Phone dashboard and CSV recording | [Android app](../android-app/README.md) |
| ESP32 Wi-Fi viewing, RAM CSV snapshots and optional SD | [ESP32 logger](esp32-logger.md) |
| Current case STLs, fit tests and editable dimensions | [Printed cases](printing.md) |
| Automated tests, build downloads, and maintenance | [Automation](automation.md) |
| Generated GitHub wiki | [Wiki publishing](wiki-publishing.md) |
