"""Generate a BTT U2C V2.1 first-fit case; all dimensions mm.

Install requirements-esp32-case.txt, then run python u2c_case.py.
Hole X inset and component envelope require a physical fit check.
"""
import json
from pathlib import Path
import zipfile

from generate import box, cylinder, export
from esp32_case import preview

ROOT = Path(__file__).resolve().parent
OUT = ROOT/'u2c-case'


def build(c):
    bx, by = c['board_margin_x'], c['board_margin_y']
    bl, bw = c['board_length_x'], c['board_width_y']
    w, d = bl+2*bx, bw+2*by
    f, wall, t = c['floor'], c['wall'], c['lid_thickness']
    pcb_z = f+c['underside_clearance']
    h = pcb_z+c['board_thickness']+c['component_height_above_pcb']+c['headroom']
    pilot = c['screw_pilot']
    assert bx >= 12 and by >= 10 and c['underside_clearance'] >= 5
    assert c['component_height_above_pcb'] >= 16 and c['headroom'] >= 3
    assert 2.3 <= pilot <= 2.7
    hx, hy = c['hole_inset_x'], (bw-c['hole_spacing_y'])/2
    assert 2.8 <= hx <= 3.5 and hy >= 3
    mounts = [(bx+x, by+y) for x in (hx, bl-hx) for y in (hy, bw-hy)]
    screws = [(x, y) for x in (5, w-5) for y in (5, d-5)]

    base = box(0, 0, 0, w, d, h)
    base -= box(wall, wall, f, w-2*wall, d-2*wall, h)
    for y in (-8, d-1):
        base += box(w/2-9, y, 0, 18, 9, f)
        base -= cylinder(w/2, y+4.5, -.1, 4.2, f+.2)
    for x, y in screws:
        base += box(x-3.8, y-3.8, f-.1, 7.6, 7.6, h-f+.1)
        base -= cylinder(x, y, h-9, pilot, 9.1)
    for x, y in mounts:
        base += cylinder(x, y, f-.1, 6, pcb_z-f+.1)
        base -= cylinder(x, y, f+.8, pilot, pcb_z-f)

    # Open-top end notches avoid support bridges and fixed connector heights.
    usb_bottom = pcb_z-.4
    can_bottom = pcb_z+c['board_thickness']
    for x, opening, bottom in ((-.1, c['usb_opening_width_y'], usb_bottom),
                                (w-wall-.1, c['can_opening_width_y'], can_bottom)):
        assert 0 < opening < d-18
        base -= box(x, d/2-opening/2, bottom, wall+.2, opening, h)

    lid = box(0, 0, 0, w, d, t)
    lip = box(wall+.4, wall+.4, t-.1, w-2*(wall+.4), d-2*(wall+.4), 2.1)
    lip -= box(wall+1.6, wall+1.6, t-.2, w-2*(wall+1.6), d-2*(wall+1.6), 2.3)
    for x, y in screws:
        lip -= box(x-4.2, y-4.2, t-.2, 8.4, 8.4, 2.4)
        lid -= cylinder(x, y, -.1, 3.3, t+.2)
    # Leave cable notches unobstructed right up to the lid underside.
    # The print orientation flips X when installed lip-down.
    lip -= box(0, d/2-c['can_opening_width_y']/2-.4, t-.2,
               5, c['can_opening_width_y']+.8, 2.4)
    lip -= box(w-5, d/2-c['usb_opening_width_y']/2-.4, t-.2,
               5, c['usb_opening_width_y']+.8, 2.4)
    lid += lip
    for x in (w/2-15, w/2-5, w/2+5, w/2+15):
        lid -= box(x-1, d/2-6, -.1, 2, 12, t+.2)

    frame = base ^ box(-1, -9, 0, w+2, d+18, pcb_z)
    frame -= box(bx+8, by+4, -.1, bl-16, bw-8, pcb_z+.2)
    gauge = box(0, 0, 0, 32, 12, 7)
    for x, diameter in ((6, 2.3), (16, 2.5), (26, 2.7)):
        gauge -= cylinder(x, 6, 1, diameter, 6.1)

    installed_lid = lid.rotate((0, 180, 0)).translate((w, 0, h+t))
    pcb = box(bx, by, pcb_z+.01, bl, bw, c['board_thickness']-.02)
    components = box(bx, by, pcb_z+c['board_thickness'], bl, bw,
                     c['component_height_above_pcb'])
    underneath = box(bx, by, f+.01, bl, bw, c['underside_clearance']-.02)
    for x, y in mounts:
        # Only the four assumed mounting-pad circles may contact the PCB.
        underneath -= cylinder(x, y, f, 6.4, c['underside_clearance'])
    for part in (base, installed_lid):
        for envelope in (pcb, components, underneath):
            assert (part ^ envelope).volume() < .001, 'Electronics envelope collision'
    assert (base ^ installed_lid).volume() < .001, 'Lid/base collision'
    # Check an unobstructed straight connector/cable path through each wall.
    for x, width, bottom in ((-.2, c['usb_opening_width_y'], usb_bottom),
                              (bx+bl+.01, c['can_opening_width_y'], can_bottom)):
        path = box(x, d/2-width/2+.01, bottom+.01, bx+.19, width-.02, h-bottom-.02)
        for part in (base, installed_lid):
            assert (part ^ path).volume() < .001, 'Cable exit obstructed'
    report = {
        'units': 'mm', 'target_board': 'BTT U2C V2.1',
        'physical_fit_verified': False, 'source': c['source'],
        'source_revision_matches_target_verified': False,
        'case_body_mm': [w, d, h+t], 'depth_with_mounting_ears_mm': d+16,
        'pcb_origin_mm': [bx, by, pcb_z], 'pcb_hole_centers_xy_mm': mounts,
        'hole_x_inset_inferred_mm': hx, 'hole_y_pitch_dimensioned_mm': c['hole_spacing_y'],
        'screw_pilot_mm': pilot, 'underside_clearance_mm': c['underside_clearance'],
        'component_height_allowance_mm': c['component_height_above_pcb'],
        'usb_window_mm': [c['usb_opening_width_y'], h-usb_bottom],
        'can_window_mm': [c['can_opening_width_y'], h-can_bottom],
        'nominal_part_electronics_and_cable_path_collision_checks': 'passed', 'parts': {},
    }
    return {'base': base, 'lid': lid, 'board_fit_test': frame, 'screw_fit_test': gauge}, report


def main():
    c = json.loads((ROOT/'u2c_case.json').read_text())
    parts, report = build(c)
    OUT.mkdir(exist_ok=True)
    meshes = {}
    for name, solid in parts.items():
        meshes[name], report['parts'][name] = export(name, solid, OUT)
    preview(meshes, output=OUT, title='BTT U2C V2.1 case',
            placements=[('base', (0, 0, 0)), ('lid', (0, 0, 53))],
            caption='USB-C at left; normal CAN screw-terminal cables at right. Print base + lid.')
    (OUT/'validation.json').write_text(json.dumps(report, indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'u2c-case-print-pack.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for path in sorted(OUT.iterdir()):
            z.write(path, path.name)
        for filename in ('u2c_case.py', 'u2c_case.json', 'generate.py', 'esp32_case.py',
                         'requirements.txt', 'requirements-esp32-case.txt'):
            z.write(ROOT/filename, 'source/'+filename)


if __name__ == '__main__':
    main()
