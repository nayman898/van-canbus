"""V2 drop-in Nucleo carrier for Hammond 1554UA2GY; all dimensions mm.

Run with requirements-step.txt installed. Keeps all V1 artifacts unchanged.
STEP files are analytic solids for direct editing in Fusion or Onshape.
"""
import json
from pathlib import Path
import zipfile

import cadquery as cq
import trimesh
from export_step import Solid, box, cylinder, export_part

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'hammond-v2'
# Carrier is centered over the four M3 brass inserts, NOT the lid screws.
WIDTH, LENGTH, FLOOR = 170.0, 104.0, 2.4
MOUNT_X, MOUNT_Y = 161.5, 90.0
# Left retainer reaches X=0; 80 mm of plate remains clear at the right end.
PCB_X, PCB_Y = 10.0, 10.75
PCB_W, PCB_L, PCB_T = 70.0, 82.5, 1.6
PIN_LENGTH, PIN_MARGIN = 8.0, 2.0
PCB_Z = FLOOR + PIN_LENGTH + PIN_MARGIN
CLAMP_Z = PCB_Z + PCB_T + .4
PILOT = 2.5  # M3 x 0.5 tap pilot; chase with a 2.5 mm drill before tapping.
MOUNTS = [(x, y) for x in ((WIDTH-MOUNT_X)/2, (WIDTH+MOUNT_X)/2)
          for y in ((LENGTH-MOUNT_Y)/2, (LENGTH+MOUNT_Y)/2)]


def base():
    part = box(0, 0, 0, WIDTH, LENGTH, FLOOR)
    for x, y in MOUNTS:
        part -= cylinder(x, y, -.1, 3.6, FLOOR+.2)
    return part


def build():
    carrier = base()
    # No upper lip: board drops vertically onto 0.8 mm edge-support strips.
    for x in (PCB_X-2, PCB_X+PCB_W-.8):
        carrier += box(x, PCB_Y, FLOOR-.1, 2.8, PCB_L, PCB_Z-FLOOR+.1)
    # Side guides have 0.5 mm clearance to the board. Stop short of its top.
    for x in (PCB_X-2.5, PCB_X+PCB_W+.5):
        carrier += box(x, PCB_Y, PCB_Z-.1, 2, PCB_L, 1.3)
    # Rear fence and two USB-end corner stops; center stays open for cable.
    carrier += box(PCB_X-2, 93.75, FLOOR-.1, PCB_W+4, 2, PCB_Z-FLOOR+1.3)
    for x in (PCB_X-2, PCB_X+PCB_W-3):
        carrier += box(x, 8.25, FLOOR-.1, 5, 2, PCB_Z-FLOOR+1.3)
    for x in (PCB_X-5, PCB_X+PCB_W+5):
        for y in (25, 79):
            carrier += box(x-4, y-6, FLOOR-.1, 8, 12, CLAMP_Z-FLOOR+.1)
            carrier -= cylinder(x, y, FLOOR+.8, PILOT, CLAMP_Z)

    clamp = box(0, 0, 0, 10.8, 66, 2.4)
    for y in (6, 60):
        clamp -= cylinder(5, y, -.1, 3.3, 2.6)
    left = clamp.translate((PCB_X-10, 19, CLAMP_Z))
    right = Solid(clamp.shape.rotate((0, 0, 0), (0, 0, 1), 180)
                  .translate((PCB_X+PCB_W+10, 85, CLAMP_Z)))
    assembled = [carrier, left, right]
    pcb = box(PCB_X, PCB_Y, PCB_Z+.01, PCB_W, PCB_L, PCB_T-.02)
    pins = box(PCB_X+.9, PCB_Y, PCB_Z-PIN_LENGTH,
               PCB_W-1.8, PCB_L, PIN_LENGTH-.01)
    for part in assembled:
        assert (part ^ pcb).volume() < 1e-6, 'PCB interference'
        assert (part ^ pins).volume() < 1e-6, 'Pin envelope interference'
        bounds = part.shape.BoundingBox()
        assert bounds.xmin >= -1e-6 and bounds.xmax <= WIDTH+1e-6
        assert bounds.ymin >= -1e-6 and bounds.ymax <= LENGTH+1e-6
        for x, y in MOUNTS:
            # Clear vertical access for up to 7 mm diameter screw heads/tools.
            access = cylinder(x, y, FLOOR+.01, 7, 30)
            assert (part ^ access).volume() < 1e-6, 'Case screw access blocked'
    for i, part in enumerate(assembled):
        for other in assembled[i+1:]:
            assert (part ^ other).volume() < 1e-6, 'Printed part interference'
    # Low-cost frame checks case bosses without printing tall PCB supports.
    fit = base() - box(10, 12, -.1, WIDTH-20, LENGTH-24, FLOOR+.2)
    return {'carrier': carrier, 'retainer_print_two': clamp,
            'case_mount_fit_test': fit}, assembled


def main():
    OUT.mkdir(exist_ok=True)
    parts, assembled = build()
    report = {'units': 'mm', 'case': '1554UA2GY',
              'case_insert_spacing_mm': [MOUNT_X, MOUNT_Y],
              'case_hole_centers_mm': MOUNTS,
              'pcb_origin_xy_mm': [PCB_X, PCB_Y],
              'clear_plate_length_at_right_mm': WIDTH-(PCB_X+PCB_W+10),
              'case_screw_access_diameter_mm': 7,
              'pcb_underside_z_mm': PCB_Z, 'pin_to_floor_clearance_mm': PIN_MARGIN,
              'retainer_vertical_clearance_mm': .4, 'tap_pilot_mm': PILOT,
              'nominal_pcb_pin_and_part_collision_checks': 'passed',
              'physical_fit_verified': False, 'parts': {}}
    for name, part in parts.items():
        report['parts'][name] = export_part(name, part, OUT)
        path = OUT / (name+'.stl')
        cq.exporters.export(part.shape, str(path), exportType='STL',
                            tolerance=.05, angularTolerance=.1)
        mesh = trimesh.load_mesh(path)
        assert mesh.is_watertight and mesh.is_winding_consistent
        assert mesh.volume > 0 and abs(mesh.bounds[0, 2]) < .001
        report['parts'][name]['stl_watertight'] = True
    assembly = cq.Assembly(name='Hammond_Nucleo_V2')
    for name, part in zip(('Carrier', 'Left_retainer', 'Right_retainer'), assembled):
        assembly.add(part.shape, name=name)
    assembly.export(str(OUT/'assembled.step'), exportType='STEP', unit='MM')
    imported = cq.importers.importStep(str(OUT/'assembled.step')).val()
    assert imported.isValid() and len(imported.Solids()) == 3
    cq.exporters.export(imported, str(OUT/'preview.svg'), exportType='SVG',
                        opt={'width': 1000, 'height': 650,
                             'projectionDir': (1, -1.5, 1.5),
                             'showHidden': False, 'strokeWidth': .5})
    report['assembly_step_round_trip'] = 'passed: three solids'
    (OUT/'validation.json').write_text(json.dumps(report, indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'hammond-nucleo-v2.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for path in sorted(OUT.iterdir()):
            z.write(path, path.name)
        for name in ('hammond_mount.py', 'export_step.py', 'generate.py',
                     'requirements-step.txt', 'requirements.txt'):
            z.write(ROOT/name, 'source/'+name)
        z.write(ROOT.parents[1]/'docs/hardware.md', 'hardware-guide.md')
    print('V2 STL, editable STEP, assembly, validation and ZIP complete.')


if __name__ == '__main__':
    main()
