"""Rebuild the existing parametric geometry as analytic CAD solids, not STL facets.

STEP opens in Fusion/Onshape as editable imported bodies (no native timeline).
Default files preserve the original 2.7 mm pilots. --pilot-diameter 2.5 makes
a separate tap-size variant; this command never modifies existing print STLs.
"""
import argparse
from contextlib import contextmanager
import json
from pathlib import Path
import zipfile

import cadquery as cq
import generate as model

ROOT = Path(__file__).resolve().parent


class Solid:
    """The small CSG interface used by generate.py, backed by OpenCascade."""
    def __init__(self, shape):
        self.shape = shape

    def __add__(self, other):
        return Solid(self.shape.fuse(other.shape).clean())

    def __sub__(self, other):
        return Solid(self.shape.cut(other.shape).clean())

    def __xor__(self, other):
        return Solid(self.shape.intersect(other.shape).clean())

    def translate(self, vector):
        return Solid(self.shape.translate(vector))

    def volume(self):
        return self.shape.Volume()


def box(x, y, z, dx, dy, dz):
    return Solid(cq.Solid.makeBox(dx, dy, dz, cq.Vector(x, y, z)))


def cylinder(x, y, z, diameter, height):
    return Solid(cq.Solid.makeCylinder(diameter / 2, height, cq.Vector(x, y, z)))


@contextmanager
def cad_backend(pilot):
    original = model.box, model.cylinder, model.PILOT
    model.box, model.cylinder, model.PILOT = box, cylinder, pilot
    try:
        yield
    finally:
        model.box, model.cylinder, model.PILOT = original


def build_parts(pilot):
    boards = json.loads((ROOT / 'boards.json').read_text())
    nucleo_config = json.loads((ROOT / 'nucleo.json').read_text())
    parts = {}
    with cad_backend(pilot):
        for name, board in boards.items():
            parts[name + '_tray'] = model.tray(board)
            parts[name + '_fit_test'] = model.tray(board, coupon=True)
        tray, coupon, stops = model.nucleo_edge_tray(nucleo_config)
        parts['nucleo_edge_tray_8mm_pins'] = tray
        parts['nucleo_rail_fit_test'] = coupon
        parts['nucleo_stop_left'], parts['nucleo_stop_right'] = stops
    return parts, nucleo_config


def dimensions(shape):
    bounds = shape.BoundingBox()
    return [bounds.xlen, bounds.ylen, bounds.zlen]


def export_part(name, part, destination):
    shape = part.shape
    assert shape.isValid() and len(shape.Solids()) == 1, f'Invalid CAD solid: {name}'
    target = destination / (name + '.step')
    cq.exporters.export(shape, str(target), exportType='STEP')
    imported = cq.importers.importStep(str(target)).val()
    assert imported.isValid() and len(imported.Solids()) == 1, f'Invalid STEP: {name}'
    assert abs(imported.Volume() - shape.Volume()) < .001, f'Volume mismatch: {name}'
    assert all(abs(a - b) < .0001 for a, b in zip(dimensions(shape), dimensions(imported)))
    # Ensure the holes stayed analytical cylinders, not a tessellated conversion.
    cylindrical_faces = sum(face.geomType() == 'CYLINDER' for face in imported.Faces())
    if name != 'nucleo_rail_fit_test':
        assert cylindrical_faces > 0, f'Lost analytic holes: {name}'
    print(f'{name}: STEP round-trip valid, {cylindrical_faces} cylindrical faces')
    return {'size_mm': [round(n, 3) for n in dimensions(shape)],
            'volume_mm3': round(shape.Volume(), 3), 'solids': 1,
            'analytic_cylinder_faces': cylindrical_faces, 'step_round_trip': 'passed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pilot-diameter', type=float, default=model.PILOT)
    args = parser.parse_args()
    if not 2.0 <= args.pilot_diameter <= 3.0:
        parser.error('Pilot diameter must be between 2.0 and 3.0 mm for these M3 posts')
    tag = f'pilot_{args.pilot_diameter:.2f}mm'
    destination = ROOT / 'step' / tag
    destination.mkdir(parents=True, exist_ok=True)
    parts, nucleo_config = build_parts(args.pilot_diameter)
    report = {'units': 'mm', 'pilot_diameter_mm': args.pilot_diameter, 'parts': {}}
    for name, part in parts.items():
        report['parts'][name] = export_part(name, part, destination)

    assembly = cq.Assembly(name='Nucleo_edge_tray_with_stops')
    assembly.add(parts['nucleo_edge_tray_8mm_pins'].shape, name='Tray')
    for name, x in (('left', 0), ('right', nucleo_config['width'] + 8)):
        assembly.add(parts['nucleo_stop_' + name].shape, name='Stop_' + name,
                     loc=cq.Location(cq.Vector(x, 0, model.FLOOR + 6)))
    assembly_path = destination / 'nucleo_assembled.step'
    assembly.export(str(assembly_path), exportType='STEP', unit='MM')
    assembled = cq.importers.importStep(str(assembly_path)).val()
    assert assembled.isValid() and len(assembled.Solids()) == 3
    report['assembly_round_trip'] = 'passed: three separate solids'
    (destination / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    notes = (
        'Van CAN bottom guards - millimetres\n'
        f'Pilot diameter: {args.pilot_diameter:.2f} mm; clearance holes stay 3.3 mm.\n'
        'STEP contains analytic solids, not meshes; it does not contain Fusion/Onshape feature history.\n'
        'Import an individual STEP to edit one part, or nucleo_assembled.step for the three-part assembly.\n'
        'Use direct face edits or add new sketches/features. Source scripts and JSON are included for regeneration.\n'
        'Install requirements-step.txt in Python 3.12+, then run export_step.py.\n'
        'For 2.5 mm pilots: python export_step.py --pilot-diameter 2.5\n'
        'Existing STL files are not changed by STEP export. Export revised STLs from your CAD application.\n'
        'First-fit bench prototypes, not physically verified or sealed automotive enclosures.\n'
        'Read docs/hardware.md in the repository for printing, clearances and assembly precautions.\n'
    )
    (destination / 'READ-ME.txt').write_text(notes)
    bundle = ROOT / f'van-can-guards-{tag}-CAD.zip'
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(destination.iterdir()):
            archive.write(file, file.name)
        for name in ('generate.py', 'export_step.py', 'boards.json', 'nucleo.json',
                     'requirements.txt', 'requirements-step.txt'):
            archive.write(ROOT / name, 'source/' + name)
        archive.write(ROOT.parents[1] / 'docs' / 'hardware.md', 'hardware-guide.md')
    with zipfile.ZipFile(bundle) as archive:
        assert archive.testzip() is None
    print(f'Created {bundle.name}')


if __name__ == '__main__':
    main()
