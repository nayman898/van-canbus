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

## Next work

- Confirm connector part numbers/orientation and finalize the two-plug drawing.
- Assemble and measure the protected power stage before vehicle-power use.
- Add automotive transient protection to the sensor input.
- Build and implement the lower-radiator-hose coolant channel.
- Measure the GlowShift pressure interfaces before designing inputs that share
  those signals with the existing gauges.
- Finish enclosure support, strain relief, sealing, and the mounting tray.
- Add persistent data recording to make longer tests easier to compare.

There are no committed build photos, PCB files, or enclosure CAD files yet.
Those can accompany the relevant milestones as the physical build progresses.
