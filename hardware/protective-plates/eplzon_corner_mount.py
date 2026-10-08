"""Revised 5 mm corner-contact EPLZON holder; no PCB holes used."""
import json
import zipfile

import cadquery as cq
import trimesh
from export_step import ROOT, Solid, box, cylinder, export_part

OUT = ROOT / 'eplzon-corners'
W, L, FLOOR, CLEARANCE = 38.1, 50.8, 2.4, 6.0
PCB_T, GAP, CONTACT = 1.6, .3, 5.0
Z = FLOOR + CLEARANCE
TOP = Z + PCB_T + GAP
SCREWS = [(-4, 0), (0, -4)]  # 5.66 mm apart; use heads <= 5.5 mm diameter.


def place(part, x, y, angle, z=0):
    return Solid(part.shape.rotate((0, 0, 0), (0, 0, 1), angle)
                 .translate((x, y, z)))


def build():
    tray = box(0, 0, 0, W+16, L+16, FLOOR)
    post = box(-6, -6, FLOOR-.1, 8, 8, TOP-FLOOR+.1)
    post -= box(-.5, -.5, FLOOR-.2, 4, 4, TOP+1)
    post += box(-1, -1, FLOOR-.1, CONTACT+1, CONTACT+1, Z-FLOOR+.1)
    clip = box(-6, -6, 0, 6+CONTACT, 6+CONTACT, 2.4)
    for x, y in SCREWS:
        post -= cylinder(x, y, FLOOR+.8, 2.5, TOP)
        clip -= cylinder(x, y, -.1, 3.3, 2.6)
    corners = [(8, 8, 0), (8+W, 8, 90), (8+W, 8+L, 180), (8, 8+L, 270)]
    clips = []
    for x, y, angle in corners:
        tray += place(post, x, y, angle)
        clips.append(place(clip, x, y, angle, TOP))
    pcb = box(8, 8, Z+.01, W, L, PCB_T-.02)
    solder_space = box(8, 8, FLOOR+.01, W, L, CLEARANCE-.02)
    for x, y, angle in corners:
        solder_space -= place(box(0, 0, 0, CONTACT, CONTACT, TOP), x, y, angle)
    for part in [tray, *clips]:
        assert (part ^ pcb).volume() < 1e-6
        assert (part ^ solder_space).volume() < 1e-6
    for clip_part in clips:
        assert (tray ^ clip_part).volume() < 1e-6
    # Same four corner seats and spacing, less floor plastic for initial fit.
    inset = CONTACT + 1
    fit = tray - box(8+inset, 8+inset, -.1, W-2*inset, L-2*inset, FLOOR+.2)
    return {'tray': tray, 'corner_clip_print_four': clip.translate((6, 6, 0)),
            'fit_test_frame': fit}, [tray, *clips]


def main():
    OUT.mkdir(exist_ok=True)
    parts, assembled = build()
    report = {'physical_fit_verified': False, 'corner_contact_mm': [CONTACT, CONTACT],
              'underside_clearance_mm': CLEARANCE, 'pcb_thickness_assumed_mm': PCB_T,
              'nominal_collision_checks': 'passed', 'parts': {}}
    for name, part in parts.items():
        report['parts'][name] = export_part(name, part, OUT)
    # STEP checks precede meshing: these solids share faces, and OCC's cached
    # triangulation can change approximate bounding boxes on shared geometry.
    for name, part in parts.items():
        path = OUT / (name+'.stl')
        cq.exporters.export(part.shape, str(path), exportType='STL', tolerance=.05)
        mesh = trimesh.load_mesh(path)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
        assert abs(mesh.bounds[0, 2]) < .001
        report['parts'][name]['watertight'] = True
    assembly = cq.Assembly(name='EPLZON_corner_holder')
    for i, part in enumerate(assembled):
        assembly.add(part.shape, name=f'part_{i}')
    assembly.export(str(OUT/'assembled.step'), exportType='STEP', unit='MM')
    imported = cq.importers.importStep(str(OUT/'assembled.step')).val()
    assert imported.isValid() and len(imported.Solids()) == 5
    cq.exporters.export(imported, str(OUT/'preview.svg'), exportType='SVG',
                        opt={'showHidden': False, 'projectionDir': (1, -1, 2)})
    (OUT/'validation.json').write_text(json.dumps(report, indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'eplzon-corner-holder.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.iterdir()):
            archive.write(path, path.name)
        for name in ('eplzon_corner_mount.py', 'export_step.py', 'generate.py',
                     'requirements-step.txt', 'requirements.txt'):
            archive.write(ROOT/name, 'source/'+name)
        archive.write(ROOT.parents[1]/'docs/hardware.md', 'hardware-guide.md')


if __name__ == '__main__':
    main()
