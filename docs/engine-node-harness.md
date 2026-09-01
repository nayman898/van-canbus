# Engine node harness plan

This is the preparation plan for the first read-only engine node. The bench
network already works at 500 kbit/s. Vehicle power and sensor inputs are not
ready to connect yet.

## Connector strategy

Keep vehicle power/CAN separate from the sensor harness. This leaves enough
sensor cavities for later oil and fuel-pressure inputs and makes either side of
the installation serviceable without disturbing the other.

### C1: power and CAN (provisional 6-way)

| Cavity | Circuit | Suggested color |
| --- | --- | --- |
| 1 | Protected switched vehicle power | Red |
| 2 | Power ground | Black |
| 3 | CAN-H | Yellow |
| 4 | CAN-L | Green |
| 5 | Ignition/wake input, reserved | Orange |
| 6 | Spare | Violet |

The R-78K5.0 regulator must not be connected directly to vehicle power. The
reverse-polarity, fuse, surge, and load-dump protection stage must be designed
and installed first.

### C2: sensors (provisional 12-way)

| Cavity | Circuit | Initial use |
| --- | --- | --- |
| 1 | Coolant sensor 1 signal | TX3 at thermostat outlet |
| 2 | Coolant sensor 1 return | Dedicated return to engine node |
| 3 | Coolant sensor 2 signal | TX3 at lower radiator hose |
| 4 | Coolant sensor 2 return | Dedicated return to engine node |
| 5 | Regulated 5 V sensor supply | Reserved for future active sensors |
| 6 | Active-sensor return | Reserved for future active sensors |
| 7 | Oil-pressure signal | Reserved; GlowShift interface TBD |
| 8 | EFI fuel-pressure signal | Reserved; GlowShift interface TBD |
| 9 | Carburetor fuel-pressure signal | Reserved; GlowShift interface TBD |
| 10 | Spare analog input | Reserved |
| 11 | Spare digital/frequency input | Reserved |
| 12 | Spare | Reserved |

The three GlowShift signals must not be connected until their gauge supply,
signal range, and grounding have been measured. The engine node will need a
high-impedance protected input so it does not alter the gauge readings.

## Work that is safe now

- Label both halves of each connector and all loose wires before assembly.
- Practice open-barrel crimps on spare contacts and scrap 18--22 AWG wire.
- Prepare an uncut length of twisted CAN wire. Keep CAN-H and CAN-L together at
  approximately one twist per 25 mm (one inch).
- Lay out the Nucleo, CAN Pal, and Perma-Proto inside the enclosure and measure
  for a removable ASA mounting tray.
- Plan for the enclosure vent to face downward when installed.
- Keep a service loop at the enclosure rather than cutting the vehicle harness
  to its final length on the bench.

## Work to defer

- Do not solder Deutsch/AT-series crimp contacts. Crimp them only; solder can
  wick up the conductor and create a vibration failure point.
- The first TX3 bench channel uses a nominal 2.47-kohm pull-up to 3.3 V, a
  1-kohm series resistor into A0/PA0, and firmware open/short detection. Add
  automotive transient clamps before vehicle installation.
- Do not drill the enclosure until the connector housing part numbers,
  orientation, mounting tray, and cable-exit direction are confirmed.
- Do not connect the R-78K5.0 regulator or Nucleo directly to van power.
- Do not connect or tap the GlowShift pressure-sensor wiring yet.

## Bench wiring retained for the next test

| Nucleo | CAN Pal |
| --- | --- |
| 3V3 | Vcc |
| GND | GND and SLNT |
| PA12 / FDCAN1_TX | TX |
| PA11 / FDCAN1_RX | RX |

Continue powering the Nucleo by USB for bench testing. The first TX3 channel has
been verified at 1.69 V with a room-temperature sensor near 2.60 kohm. The
vehicle installation still requires the protected power-input stage and
automotive transient protection on the sensor input.
