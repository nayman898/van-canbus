# Printed cases and mounts

[Getting started](getting-started.md) · [Hardware](hardware.md) · [ESP32 gateway](esp32-logger.md)

STLs are in **millimetres**, already oriented on the bed. Download the actual
file using GitHub's **Download raw file** control, rather than saving the HTML
preview. Slice at **100% scale**. No printer-specific G-code is supplied.

## Pick the matching design

| Assembly | Current design | Fit and assembly details |
| --- | --- | --- |
| ESP32 + CAN Pal on Adafruit half-size Perma-Proto | **Compact V3**; body 60.8 × 100.28 × 28.4 mm, width 76.8 mm with ears | [ESP32 enclosure](esp32-logger.md#printed-cabin-enclosure) |
| BTT U2C V2.1 | Two-piece first-fit case; body 109.45 × 45.35 × 32.4 mm, depth 61.35 mm with ears | [U2C enclosure](hardware.md#printable-u2c-case--first-fit-prototype) |
| NUCLEO-G0B1RE inside Hammond 1554UA2GY | V2 carrier and two retainers, not a replacement outer case | [Hammond carrier](hardware.md#hammond-1554ua2gy-nucleo-carrier--v2) |
| Loose prototype boards | Bottom guards and corner holder; open top/sides | [Bench guards](hardware.md#printable-bottom-guards--first-fit-prototypes) |

Check the board, connectors, mounting holes, underside pins and actual screw
type before printing. Mesh validation establishes printable geometry and
nominal clearances; it does not establish physical fit or vehicle qualification.

## ESP32 compact V3

Print one each: [base](../hardware/protective-plates/esp32-case/base.stl),
[lid](../hardware/protective-plates/esp32-case/lid.stl), and
[cable panel](../hardware/protective-plates/esp32-case/cable_panel.stl).
Start with the [board fit frame](../hardware/protective-plates/esp32-case/board_fit_test.stl)
and [screw coupon](../hardware/protective-plates/esp32-case/screw_fit_test.stl).
An already fitting V2 frame and V2 lid can be reused; V3 needs the shorter
base and panel. V1 uses a different footprint.

The owner's assembly is on a **50.8 × 81.28 mm** board. The bottom offsets
fit; the corrected height is **13 mm from PCB top to the CAN terminals**.
V3 keeps 6 mm underneath and adds 3 mm above that measured height.
For another assembly, measure these clearances yourself before printing.
The front PCB hole is covered by the ESP32: use two front corner retainers
and **one accessible rear screw**. USB and CAN wires exit the same end.
The current case does not include an SD-module mount or card-access slot.

See the [print instructions](../hardware/protective-plates/esp32-case/PRINT-ME.txt)
for screw sizes, corner keepouts and assembly order, and the
[preview](../hardware/protective-plates/esp32-case/preview.png) for orientation.

## U2C case

Print one [base](../hardware/protective-plates/u2c-case/base.stl) and one
[lid](../hardware/protective-plates/u2c-case/lid.stl). Print the
[board fit frame](../hardware/protective-plates/u2c-case/board_fit_test.stl) and
[screw coupon](../hardware/protective-plates/u2c-case/screw_fit_test.stl) first.
USB and CAN leave opposite short ends. Remove the lid for terminal screws,
BOOT and termination-jumper access.

The generic manufacturer drawing depicts an earlier U2C revision. One hole
inset is inferred; the four mounts still require confirmation against an
actual V2.1. Do not force the board to align. Full instructions and the
drawing sources are in [PRINT-ME.txt](../hardware/protective-plates/u2c-case/PRINT-ME.txt).

## Slice and fit

For the ESP32/U2C parts, start with 0.2 mm layers, four walls, 30–40% infill,
no supports, and ordinary non-conductive PETG for initial fitting. Use a
calibrated profile for the actual printer/material. Choose a final material
for the measured mounting-location temperature and secure cable strain relief.
These vented cases are unsealed; do not treat them as underhood/weatherproof
enclosures. The other holders have their own orientation and fastener notes
in the hardware guide.

## Editable dimensions and local print packs

Use Python **3.12** in a separate CAD environment. From the repository root
in PowerShell:

```powershell
py -3.12 -m venv .cache/cad-venv
.\.cache\cad-venv\Scripts\python -m pip install -r hardware/protective-plates/requirements-esp32-case.txt
.\.cache\cad-venv\Scripts\python hardware/protective-plates/esp32_case.py
.\.cache\cad-venv\Scripts\python hardware/protective-plates/u2c_case.py
```

On Linux, create the environment with `python3.12 -m venv .cache/cad-venv`
and use `.cache/cad-venv/bin/python` for the same install/generator commands.
If the distribution packages venv support separately, install its Python venv
package first.

Edit [esp32_case.json](../hardware/protective-plates/esp32_case.json) or
[u2c_case.json](../hardware/protective-plates/u2c_case.json), then regenerate.
Each generator checks the meshes and nominal assembly clearances and writes
a validation report, preview and `*-case-print-pack.zip` beside the source.
The ZIPs contain STLs, instructions and editable source; they are generated,
Git-ignored conveniences. The tracked individual STLs are the public downloads.
CAD packages are separate from the laptop-monitor requirements, and Actions
does not currently build or upload CAD print packs.
