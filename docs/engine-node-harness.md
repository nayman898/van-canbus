# Engine node harness plan

[Documentation index](README.md) · [Bench setup](bench-setup.md) · [Hardware](hardware.md)

This is the preparation plan for the first read-only engine node. The bench
network already works at 500 kbit/s. Vehicle power and sensor inputs are not
ready to connect yet.

## Connector strategy

Keep vehicle power/CAN separate from the sensor harness. This leaves enough
sensor cavities for later oil and fuel-pressure inputs and makes either side of
the installation serviceable without disturbing the other.

Both the 6-pin and 12-pin plugs are now available for this build. The intended
allocation is [C1 for power/CAN](#c1-final-power-and-can-provisional-6-way) and
[C2 for sensors](#c2-final-sensors-provisional-12-way). Those cavity assignments
remain provisional until the housing part numbers and orientation are recorded.
The older C0 combined allocation below is retained as a temporary reference;
it is **not pin-compatible** with the sensor-only C2 allocation.

Connector names C1/C2 and capacitor references C1/C2 in the power schematic
belong to separate naming contexts in these prototype notes.

## C0: temporary combined 12-way

This was the interim allocation while the separate power/CAN connector was unavailable.
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

## Selected protected vehicle-input stage

The following parts were purchased for the engine-node power input:

| Ref. | Part | Function |
| --- | --- | --- |
| D1 | STMicroelectronics `STPS5H100BY-TR` | 100 V, 5 A automotive Schottky series diode for reverse-battery protection |
| R1 | Vishay `PR02000201009JR500` | 10 ohm, 2 W axial surge-current limiting resistor |
| D2 | Vishay `SM8S18CAHM3/I` | 18 V standoff, 29.2 V maximum-clamp, bidirectional automotive TVS |
| C1 | Panasonic `EEH-AZC1H470B` | 47 uF, 50 V polarized hybrid input capacitor |
| C2 | TDK `FA18X7R1H104KNU00` | 0.1 uF, 50 V X7R ceramic input bypass capacitor |
| U1 | RECOM `R-78K5.0-1.0` | 6.5--36 V input to regulated 5 V converter |
| C3 | TDK `FA18X7R1H104KNU00` | 0.1 uF, 50 V ceramic output bypass capacitor |

Wire the stage in this order:

```text
switched vehicle +12 V
        |
   external 0.5 A fuse, close to source
        |
        +---- D1 anode
              D1 cathode/tab ---- R1 10 ohm ---- PROTECTED_12V ---- U1 pin 1 (+VIN)
                                                   |               U1 pin 2 (GND) ---- GND
                                                   |               U1 pin 3 (+VOUT) -- +5V
                                                   |
                                                   +---- D2 TVS ---- GND
                                                   +---- C1 47 uF -- GND
                                                   +---- C2 0.1 uF - GND

                                                     +5V ---- C3 0.1 uF ---- GND

vehicle ground -------------------------------------------------------------- GND
```

Important assembly details:

- D1's anode faces the fused vehicle input. Its cathode and metal DPAK tab face
  R1 and the converter. Confirm the physical leads with diode mode before
  soldering; the unused DPAK lead is not connected.
- D2 has a `CA` bidirectional suffix and can be installed either direction. Keep
  both of its connections short and heavy, directly between `PROTECTED_12V` and
  the power ground bus.
- C1 is polarized: positive goes to `PROTECTED_12V`, negative goes to ground.
  C2 and C3 are not polarized.
- The 10-ohm resistor intentionally limits surge current into the TVS. It also
  prevents using the converter's full nominal 1 A output at low input voltage;
  this stage is sized for the low-current engine-monitor node, not cabin loads.
- Keep CAN/sensor returns connected to the same module reference ground, but do
  not route their normal current through the TVS or capacitor lead lengths.

### Protected-input staged test

1. Disconnect the Nucleo, U2C, CAN wiring, sensors, and all USB cables.
2. With power off, verify no hard short from `PROTECTED_12V` or +5 V to ground.
3. Feed 12 V through the fuse with a 0.10 A bench current limit. Measure voltage
   before D1, after D1, at `PROTECTED_12V`, and at U1 pin 3. Expect a small drop
   across D1, almost no drop across R1 with no load, and about 5.0 V output.
4. Switch off, connect the Nucleo at E5V/GND, raise the limit to 0.25 A, and
   verify the 5 V and 3.3 V rails before reconnecting CAN.
5. For a reverse-polarity check, disconnect every USB/CAN connection, set the
   bench limit to 0.01 A, reverse the 12 V input, and verify zero converter
   output and no heating. Correct polarity before reconnecting anything.
6. Do not attempt to force the TVS into avalanche with the bench supply. Final
   installation still requires the fuse at the vehicle-power takeoff and secure,
   vibration-resistant support for the two surface-mount power parts.

### C1: final power and CAN (provisional 6-way)

| Cavity | Circuit | Suggested color |
| --- | --- | --- |
| 1 | Protected switched vehicle power | Red |
| 2 | Power ground | Black |
| 3 | CAN-H | Yellow |
| 4 | CAN-L | Green |
| 5 | Ignition/wake input, reserved | Orange |
| 6 | Spare | Violet |

The R-78K5.0 regulator must not be connected directly to vehicle power. Parts
for the protection stage are selected above; assembly and validation must
precede vehicle-power use. The table's “protected” power label does not settle
which side of C1 houses the protection stage. Record that physical placement
in the final wiring drawing before wiring cavity 1.

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
