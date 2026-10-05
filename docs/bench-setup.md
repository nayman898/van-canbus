# Build the USB-powered bench network

[Documentation index](README.md) · [Hardware](hardware.md) · [Laptop tools](../tools/README.md)

This guide reproduces the current one-sensor bench setup. Keep vehicle power
disconnected throughout. Prepare the [firmware](firmware.md) and
[Python environment](../tools/README.md#install-on-windows) before bring-up.

## 1. Wire the Nucleo and CAN Pal

With power removed, connect:

| Nucleo | CAN Pal |
| --- | --- |
| 3V3 | Vcc |
| GND | GND |
| GND | SLNT |
| PA12 / FDCAN1_TX | TX |
| PA11 / FDCAN1_RX | RX |

Use the board labels and the [MB1360 manual](hardware.md#manufacturer-references)
to locate the pins. These are MCU port names, not connector cavity numbers.

## 2. Wire the CAN bus

| CAN Pal | U2C normal CAN OUT connection |
| --- | --- |
| H | H |
| L | L |
| GND | GND |

Keep H and L together as a twisted pair and carry the reference ground with
them. Leave U2C **V+ disconnected**. Enable one 120-ohm terminator at the CAN
Pal end and one at the U2C end using its `120R` jumper.

With both USB cables and all other power disconnected, measure H to L. The
two enabled terminations should measure approximately **60 ohms**. A reading
near 120 ohms suggests one termination is missing; a reading near zero calls
for a short-circuit check before powering up.

## 3. Add the coolant input

Build the [TX3 divider](hardware.md#first-coolant-input), with its output through
1 kohm to A0/PA0. Return the sensor's other wire to the Nucleo ground.

The first channel is the thermostat-outlet channel in the protocol. It can
be tested with the sensor on the bench before mechanical installation.
Only this first ADC channel is implemented today.

If using enclosure connectors, use one complete allocation from the
[harness plan](engine-node-harness.md). The old temporary combined 12-pin C0
and the proposed sensor-only 12-pin C2 have different assignments and are not
interchangeable.

## 4. Power and start the monitor

1. Check continuity, polarity, and for unintended shorts while unpowered.
2. Use the Nucleo's USB power configuration; disconnect external E5V/vehicle
   feeds. If the jumpers were changed for a converter test, restore the USB
   configuration using the board manual first.
3. Connect the Nucleo's ST-Link USB data cable and program the built firmware.
4. Connect the U2C to the laptop by USB.
5. Start `start_dashboard.bat`, or use the commands in the
   [laptop-tools guide](../tools/README.md).

Run one application against the U2C at a time. Stop the dashboard before using
the terminal monitor against the same adapter.

## 5. Check the result

| Observation | Expected behavior |
| --- | --- |
| Dashboard connection | Changes to `CAN live` when traffic arrives |
| Heartbeat | Node uptime increases; sequence changes about twice per second |
| Coolant | A plausible bench temperature, updated about four times per second |
| ADC | Count between the configured short/open thresholds for a connected sensor |
| Frame count | About six frames per second from this firmware on an otherwise quiet bus |
| Nucleo PA5 LED | Toggles when a heartbeat is queued; this alone does not prove bus reception |

The original bench notes recorded 1.69 V with a sensor near 2.60 kohm.
That is an example measurement, not a fixed voltage every sensor should show.
Temperature and actual pull-up resistance affect the reading.

To check open-circuit reporting, power down, disconnect one thermistor wire,
and power up again. The dashboard should show an open-circuit fault. Power down
again before restoring the connection.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| U2C disconnected | USB data cable, adapter firmware/backend, and whether another app owns the adapter |
| Adapter connected, no frames | Node power/firmware, H/L assignment, common ground, termination, and 500 kbit/s on both ends |
| Open-circuit fault | Sensor connection and dedicated return; ADC count at or above 4050 |
| Short-circuit fault | Signal-to-ground short or divider wiring; ADC count at or below 16 |
| Plausible but wrong temperature | Actual pull-up resistance and whether the sensor matches the assumed calibration |
| Temperature stops changing | Connection status and last-frame age; the dashboard retains its last reading |

For software errors, see [tool troubleshooting](../tools/README.md#troubleshooting).
For vehicle-power work, continue with the [harness plan](engine-node-harness.md)
only after the bench setup is working.
