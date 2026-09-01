# Engine node harness plan

This is the preparation plan for the first read-only engine node. The bench
network already works at 500 kbit/s. Vehicle power and sensor inputs are not
ready to connect yet.

## Connector strategy

Keep vehicle power/CAN separate from the sensor harness. This leaves enough
sensor cavities for later oil and fuel-pressure inputs and makes either side of
the installation serviceable without disturbing the other.

## C0: temporary combined 12-way

Use this allocation while the separate power/CAN connector is unavailable.
The molded cavity numbers on the connector are authoritative; do not assign
pins by apparent left/right position because the mating face and wire-entry
views are mirrored.

Typical cavity arrangement, viewed at the mating face and confirmed by the
molded numbers:

```text
  1    2    3    4    5    6
 12   11   10    9    8    7
```

| Cavity | Circuit | Suggested color | First van test |
| ---: | --- | --- | --- |
| 1 | Fused switched 12 V input | Red | **Leave unpopulated** |
| 2 | Coolant sensor 1 signal | Tan/white | TX3 at thermostat outlet |
| 3 | Coolant sensor 2 signal | Blue/white | Populate when channel 2 is built |
| 4 | Regulated 5 V sensor supply | Pink | Reserved; seal cavity |
| 5 | Ignition/wake input | Orange | Reserved; seal cavity |
| 6 | CAN-H | Yellow | Connect to U2C CAN-H |
| 7 | CAN-L | Green | Connect to U2C CAN-L |
| 8 | Spare analog/digital input | Violet | Reserved; seal cavity |
| 9 | Future active-sensor return | Gray/black | Reserved; seal cavity |
| 10 | Coolant sensor 2 return | Blue/black | Populate when channel 2 is built |
| 11 | Coolant sensor 1 return | Tan/black | Dedicated TX3 return to engine node |
| 12 | Module power/CAN reference ground | Black | Connect to U2C GND |

Pins 1/12, 2/11, 3/10, and 6/7 form vertically adjacent pairs. Keep the two
TX3 returns as dedicated conductors all the way to the module; join them to
circuit ground inside the enclosure, not at the engine or chassis. Twist pins
6 and 7 together. Carry pin 12 alongside the CAN pair as its reference.

For the first vehicle data test, power the Nucleo through USB and leave cavity
1 empty. The U2C `V+` terminal also remains disconnected. This makes the test
read-only and prevents raw vehicle power from reaching the prototype.

### Temporary harness preflight

1. Disconnect both USB cables and all vehicle connections.
2. Use continuity mode to prove every cavity end-to-end and prove that adjacent
   cavities are not shorted. Record the result by cavity number.
3. Confirm CAN-H reaches CAN-H, CAN-L reaches CAN-L, and pin 12 reaches the U2C
   ground terminal.
4. Enable one 120-ohm termination at the CAN Pal end and one at the U2C end.
   Measure approximately 60 ohms between cavities 6 and 7 with power removed.
5. Connect the two TX3 wires only to cavities 2 and 11. A TX3 thermistor is not
   polarized, but keep the assigned colors consistent at both ends.
6. Power the engine node by USB, start the dashboard, and verify heartbeat and
   room-temperature data before installing the harness in the van.

## Clean 12 V bench-supply test

This test validates the R-78K5.0 converter and external-power arrangement. It
does **not** validate an installation against reverse battery, alternator
transients, jump starts, or automotive load dump.

### Stage 1: converter by itself

1. Keep the Nucleo, CAN Pal, USB cables, and sensor board disconnected.
2. Verify the R-78K5.0 pin numbering against its datasheet before applying
   power. Do not rely on package orientation from memory.
3. Connect bench-supply positive through a small inline fuse to cavity 1 and
   supply negative to cavity 12. Use a 0.5 A fuse for this prototype test.
4. Set the supply to 12.0 V with a 0.10 A current limit, then switch it on.
5. Measure the converter input and output directly at its pins. Expect about
   12.0 V input and 5.0 V output. Switch off immediately for reversed polarity,
   current limiting, heat, odor, or an output outside 4.75--5.25 V.
6. Switch the supply off and wait for the output to fall before changing wiring.

### Stage 2: Nucleo from the converter

1. Configure Nucleo jumper JP2 to pins 5--6 for the `E5V` source, following the
   MB1360 board manual.
2. Connect converter 5 V output to the Nucleo `E5V` input and converter ground
   to Nucleo ground. Keep the ST-Link USB cable disconnected.
3. Set the bench supply to 12.0 V and a 0.25 A current limit. Power it on and
   verify 5 V and 3.3 V at the Nucleo headers before connecting the CAN Pal.
4. Connect the CAN Pal and confirm heartbeat through the independently powered
   U2C. Record steady-state input current for comparison after later changes.
5. If USB debugging is needed, apply external E5V power first and connect the
   ST-Link USB cable second, as required by the board manual.

The R-78K5.0-1.0 accepts 6.5--36 V and provides regulated 5 V at up to 1 A, but
it is not an automotive input-protection device. Do not proceed from this clean
bench test to van power until the fused reverse-polarity and transient/load-dump
stage has been selected, assembled, and tested.

### C1: final power and CAN (provisional 6-way)

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

### C2: final sensors (provisional 12-way)

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
