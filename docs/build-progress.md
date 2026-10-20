# Build progress

[Documentation index](README.md) · [Project home](../README.md)

This is a milestone record for readers following the build. It describes the
working prototype and the plans present in this repository, rather than a
finished vehicle installation.

## 1. Get two CAN endpoints talking — working on the bench

The engine node pairs a NUCLEO-G0B1RE with an Adafruit CAN Pal. A BTT U2C V2.1
connects the bus to the laptop. The first useful message is a heartbeat with
node identity, sequence, and uptime, making it possible to see that the node
is running and messages are arriving.

The link uses Classical CAN at 500 kbit/s. See [bench setup](bench-setup.md)
for the wiring and termination checks.

## 2. Read the first coolant sensor — working on the bench

A TX3 thermistor and nominal 2.47-kohm pull-up feed A0/PA0 through a 1-kohm
series resistor. Firmware averages the ADC samples, calculates temperature,
and transmits both the temperature and raw ADC reading. Open/short detection
makes a disconnected sensor distinguishable from a real temperature.

The first recorded bench check was 1.69 V with a sensor near 2.60 kohm. That
confirmed the initial circuit's behavior at that test point; it was not a full
temperature calibration or a vehicle-environment test. The intended location
for this channel is the thermostat outlet.

See [hardware](hardware.md) for the circuit and current calibration assumptions.

## 3. Make the data easy to see — working on the laptop

The terminal decoder grew into a local browser dashboard showing coolant,
sensor voltage, faults, node uptime, and connection state. The backend retries
when the USB CAN adapter is unavailable. It currently displays live data;
built-in persistent recording and playback are future work.

See [laptop tools](../tools/README.md) for setup and behavior.

## 4. Move toward an enclosure and harness — in progress

The intended split is a 6-pin power/CAN plug and a 12-pin sensor plug. Both
sizes are available for the build. Keeping these separate leaves room for
additional sensors and lets the sensor harness be serviced independently.

The older combined 12-pin arrangement is retained in the
[harness plan](engine-node-harness.md) as a temporary reference. Its pinout is
different from the sensor-only connector. Purchased housing part numbers and
contact sizes are now recorded in the harness plan; physical cavity orientation,
final assignments and cable exits still need verification. Printable holders
and cabin cases are now available; see [Printed cases and mounts](printing.md).

## 5. Prepare vehicle power — parts selected

The purchased input-stage parts and staged bench procedure are recorded in the
[power section](engine-node-harness.md#selected-protected-vehicle-input-stage).
The intention is a fused and protected input ahead of the 5 V converter.
The repository does not yet document completed automotive transient or
load-dump validation, and a clean 12 V bench test would not establish that.

## 6. Two coolant channels and phone dashboard — bench operation confirmed

### Evening session: October 5–6, 2026 (America/New_York)

- Added the second TX3 end-to-end: ADC acquisition, CAN encoding, laptop
  decoder/dashboard, and native Android dashboard.
- Sensor 1 is **pre-radiator**, A0/PA0, CAN `0x110`, sensor ID 1. Sensor 2
  is **post-radiator**, A1/PA1, CAN `0x111`, sensor ID 2. Both use separate
  nominal 2.47-kohm pull-ups and the same TX3 conversion.
- Each channel sends about four frames per second with independent sequence
  and fault state. Together with heartbeat, normal traffic is about ten frames/s.
- Both dashboards now show independent readings and suppress temperatures
  when their channel is stale (1.5 seconds), invalid, or disconnected.
  Android stacks the cards on phones and places them side-by-side in wide
  landscape; its existing raw CSV logger records both IDs.
- Built Debug/Release firmware and the Android APK. C encoder checks, Java
  decoder checks, browser UI checks, and 22 Python tests passed. Android lint
  passed with three warnings and no errors.
- Programmed the connected NUCLEO-G0B1RE, verified flash contents, and reset
  it to run. The user confirmed successful operation and phone reception.
- Restarted the PC's old dashboard backend, which was still running the
  previous single-channel code with stale data. The new backend received
  both valid channels: 65.3 °F pre-radiator and approximately 90.0 °F
  post-radiator in that bench snapshot. These are test readings, not evidence
  of radiator performance or calibrated accuracy.

See [second-channel bench wiring](bench-setup.md#second-coolant-channel) and
the [CAN contract](can-protocol.md). Independent warming/disconnection checks,
calibration, and installation checks remain separate from confirmed reception.

## 7. Automated verification and build maintenance

The repository workflow checks host tools/docs, builds both firmware variants,
builds/lints the Android APK, builds the ESP32 gateway, and generates the wiki. Pull requests do not
publish the wiki; successful `main` runs can. Two-temperature browser tests
are included in the workflow.

A Dependabot PR exposed `sdkmanager: command not found`. The workflow now
explicitly initializes Android command-line tools with a SHA-pinned setup
action before installing SDK packages. In
[October 16 run 38904599132](https://github.com/nayman898/van-canbus/actions/runs/38904599132),
the Android APK and both STM32 builds passed, as did the ESP32 build and all
22 then-current Python tests. The remaining failure was workflow lint:
ShellCheck SC2035 on the ESP32 checksum globs. The checksum command now uses
`sha256sum -- *.bin *.elf`; local actionlint validation with ShellCheck passes.
The wiki publish job was skipped in that run because lint failed. The later
[fix-build-issues run 38910515542](https://github.com/nayman898/van-canbus/actions/runs/38910515542)
at commit `69a9859` passed every job, including host/workflow validation and
the wiki publishing job. New documentation changes still need their own
successful source push/run to reach the live wiki.
See [automation](automation.md) for artifacts and troubleshooting.

## RPM and pressure interface decisions — October 15, 2026

- Ordered the prefab [CoilX RPM adapter](rpm-input.md), replacing the custom
  input circuit. The Adafruit 757 module is proposed for 5V-to-3.3V conversion;
  its purchase, timer-pin assignment, installation and RPM software remain pending.
- Recorded the preference for prefab parts when total build cost or complexity
  makes custom assembly impractical.
- Added a [GlowShift identification and input plan](glowshift-inputs.md).
  The owner confirmed all three senders have three wires and keep their gauges.
  The preferred route is now a small buffered board into the existing STM32 ADC
  through the [rev A circuit and assembly guide](glowshift-circuit.md).
  The DigiKey list totals $13.51 before shipping, tax and any tariffs, with
  spare parts and the owner's existing prototyping boards. AnalogX2 remains
  an optional fallback. Fuel measurements provide provisional calibration;
  oil calibration, assembly testing, pressure software and permanent power-off
  isolation remain pending.

## ESP32 logger — October 15, 2026

Added the [ESP32 CAN logger](esp32-logger.md) firmware and wiring plan for
recording on switched USB power, an external SPI microSD slot and local Wi-Fi downloads.
Firmware compilation and host checks do not replace flashing and bench tests;
the owner selected an existing regulated 5V USB-C converter. The default firmware
starts live monitoring on power-up without an ignition relay or power-delay module.
The web interface now works without an SD slot/card: independent coolant readings,
heartbeat, sampled trends, raw frames and the latest 256-frame CSV snapshot.
`EnableSd` defaults to false; long-term recording can be enabled when the card is added.
With SD recording enabled later, abrupt power loss can lose recent data or
corrupt the card; a physical stop button allows clean closure before deliberate
disconnection. Current live-only history is volatile RAM.

The first ESP32 (COM8, ESP32-D0WD-V3 rev 3.1, 4 MB flash) was flashed with the
live-only web build. All programmed regions passed verification, and normal
startup advertised VanCAN-1F8A3C. The October 16 photo shows the ESP32 and CAN
Pal assembled on the half-size proto board. Device browser/CAN acceptance
results and vehicle-power checks remain pending.

## Printed cases and measured ESP32 fit — October 16, 2026

- Added the [U2C two-piece case](hardware.md#printable-u2c-case--first-fit-prototype)
  with USB and CAN at opposite ends. The generic drawing's longitudinal hole
  inset is inferred; verify all four holes on the actual V2.1 with its fit frame.
- Reworked the [ESP32 case](esp32-logger.md#printed-cabin-enclosure) around the
  assembly photo: the ESP32 hides the front proto-board hole, so front retainers
  and one accessible rear screw hold the board.
- The owner confirmed the bottom offsets fit and corrected the component
  height to **13 mm above the PCB**. Compact V3 keeps the 6 mm underside offset,
  adds 3 mm headroom and measures **60.8 × 100.28 × 28.4 mm** excluding ears.
  V2's lid fits V3; the shorter base and panel must be V3.
- Mesh, nominal clearance and cable-path checks pass. Full case/plug fit,
  strain relief, heat and vibration still need physical checks. STL downloads,
  printing instructions and editable-source commands are in the
  [print guide](printing.md).

## Next work

- Verify physical connector cavity orientation and finalize the two-plug drawing;
  purchased part numbers and contact sizes are recorded in the harness plan.
- Assemble and measure the protected power stage before vehicle-power use.
- Add automotive transient protection to the sensor input.
- Verify channel identity by warming one sensor at a time, check fault recovery,
  and finalize the lower-radiator-hose sensor installation.
- Bench-test the GlowShift board, verify gauge readings are unaffected, and
  validate fuel scaling and oil calibration before implementing pressure support.
- Select the RPM timer pin and verify CoilX/level-converter pulses before
  implementing RPM capture and CAN reporting.
- Fit the ESP32 V3 case and U2C case, then finish mounting and strain relief.
  The cabin prints are unsealed; engine-node sealing remains separate work.
- Bench-test the assembled ESP32 gateway's cardless live page and CSV export
  against real CAN traffic. Add SD hardware later, then test manual safe stop
  and downloading while recording. Exercise Android CSV logging with both sensors;
  laptop persistent recording and playback remain future work.

Add installation photos and enclosure drawings as the physical build progresses;
bench operation does not establish vehicle-environment reliability.


## Fuel-level bench software — October 17, 2026

Added A5/PB12/ADC1_IN16 sampling for the isolated Spectra FG72A circuit with a
1k pull-up. CAN `0x120` reports resistance, raw count and independent faults
every 500 ms. Android adds raw diagnostics and a damped, explicitly uncalibrated
75-ohm-empty / 10-ohm-full estimate. Host conversion, wire-contract and Android
freshness/damping checks cover the new path. Hardware acceptance, installed
sender connection repair, multi-point tank calibration and vehicle input
protection remain pending. See [fuel-level testing](fuel-level.md).


## Fuel on the ESP32 Wi-Fi gateway — October 17, 2026

Added matching fuel-message validation, timestamp-based five-second level
damping, raw fuel diagnostics, a responsive uncalibrated fuel card and a fuel
raw-frame filter. Updated preview data includes `0x120`. No new ESP32 hardware,
SD card or sender wiring is required. ESP32 upload and end-to-end fuel hardware
verification remain pending; the October 15 flash predates this feature.


### Nucleo fuel firmware flashed — October 17, 2026

Programmed the connected NUCLEO-G0B1RE through ST-Link with the Release fuel
firmware. STM32CubeProgrammer completed a successful flash read-back verification
and reset the MCU. This establishes programming success; sender accuracy and
fuel hardware acceptance still require the documented resistor/sender checks.


## Customizable Android dashboard — October 17, 2026

App 0.3.0 makes both coolant channels, fuel, engine status and raw CAN separate
cards in a saved ordered selection. Edit layout provides add, remove, move
up/down and reset controls; an empty dashboard can always add cards back.
Wide landscape fills two columns in row order, and narrow windows use one.
Hiding cards affects display only; reception, fault/freshness processing and
CSV logging continue. Plain-JDK layout tests cover restart persistence,
all-hidden recovery, ordering boundaries and invalid saved IDs. Android lint
and the debug APK build pass; physical phone/head-unit UI acceptance remains
pending. See [dashboard customization](../android-app/README.md#customize-your-dashboard-app-030).


## Customizable Wi-Fi dashboard — October 17, 2026

The ESP32 page now supports add/remove, move up/down, reset and saved browser
layouts for both coolant cards, fuel, engine/capture status and raw frames.
Hidden cards remain connected to live data; CSV capture and fault/freshness
checks continue. Tests cover reload persistence, duplicates/unknown IDs,
empty-dashboard recovery and browser storage failures. Actual headless Chrome
checks exercised the controls and verified desktop/390px phone layouts with
simulated telemetry and no horizontal overflow. Browser and Android layouts
save independently. After the owner corrected the pull-down to P12/GPIO12,
the flash identified correctly as 4MB at 3.3V. The four firmware regions were
written and hash verified, preserving NVS. A subsequent reset and filtered
serial check confirmed normal application boot, the Wi-Fi hotspot and dashboard
address, with no fatal startup message. Live CAN/sensor acceptance awaits the
bench harness.

## Fuel ADC channel-selection correction — October 17, 2026

Investigating a fuel card stuck near 1.5V exposed a Nucleo firmware error:
the configurable ADC sequencer cannot address IN16, so the request selected
IN0 instead. The corrected firmware uses the fixed sequencer, replaces the
channel mask on each input change, and waits for configuration readiness.
A regression test using ST's actual register helpers reproduces the alias
and verifies independent IN0/IN1/IN16 selection. Fuel conversion and CAN
encoding tests pass, as does the Release build. The corrected image was flashed
to the NUCLEO-G0B1RE, read-back verified successfully by STM32CubeProgrammer,
and reset. The user confirmed the Nucleo is disconnected from the rest of the
system while awaiting bench-harness connectors, so live fuel acceptance and
the resistor/sender checks remain pending.


## RPM replaces high-pressure fuel acquisition — October 19, 2026

The owner deferred the high-pressure fuel channel while retaining its existing
gauge. Current C2 stacked pairs are coolant 1/12 and 2/11, oil 3/10, RPM 4/9,
low fuel pressure 5/8, and fuel level 6/7. The local interactive RPM guide and
connection list reflect C2.4 to B1 and C2.9 to logic ground. CoilX is still
shipping; its separate regulated 5V feed and any new enclosure connector await
photos/layout planning. RPM GPIO/firmware and pressure firmware remain pending.
