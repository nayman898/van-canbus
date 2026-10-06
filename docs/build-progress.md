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
different from the sensor-only connector. The final housing part numbers,
orientation, contact sizes, cable exits, and mounting tray are still open.

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
builds/lints the Android APK, and generates the wiki. Pull requests do not
publish the wiki; successful `main` runs can. Two-temperature browser tests
are included in the workflow.

A Dependabot PR exposed `sdkmanager: command not found`. The workflow now
explicitly initializes Android command-line tools with a SHA-pinned setup
action before installing SDK packages. Local workflow validation passed;
a successful hosted rerun of that fix has not yet been confirmed here.
See [automation](automation.md) for artifacts and troubleshooting.

## Next work

- Confirm connector part numbers/orientation and finalize the two-plug drawing.
- Assemble and measure the protected power stage before vehicle-power use.
- Add automotive transient protection to the sensor input.
- Verify channel identity by warming one sensor at a time, check fault recovery,
  and finalize the lower-radiator-hose sensor installation.
- Measure the GlowShift pressure interfaces before designing inputs that share
  those signals with the existing gauges.
- Finish enclosure support, strain relief, sealing, and the mounting tray.
- Exercise Android CSV logging with both sensors; laptop persistent recording
  and playback remain future work.

Add installation photos and enclosure drawings as the physical build progresses;
bench operation does not establish vehicle-environment reliability.
