"""Printable cabin ESP32 case, millimetres; run with requirements.txt installed.

Source dimensions: esp32_case.json. Generates STLs, PNG, validation and ZIP.
No printer-specific G-code. Physical fit is not established by mesh validation.
"""
import json
from pathlib import Path
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from generate import box, cylinder, export

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'esp32-case'


def build(c):
    f, wall = c['floor'], c['wall']
    bw, bl = c['board_width'], c['board_length']
    bx, by = c['board_side_margin'], c['board_front_margin']
    w = bw + 2 * bx
    length = by + bl + c['board_rear_margin']
    pcb_z = f + c['below_board_clearance']
    h = pcb_z + c['board_thickness'] + c['components_above_board'] + c['headroom']
    pilot = c['screw_pilot']
    assert bx >= 5 and by >= 10 and c['board_rear_margin'] >= 9
    assert c['below_board_clearance'] >= 5 and c['headroom'] >= 2
    assert 2.3 <= pilot <= 2.7
    screws = [(x, y) for x in (5, w-5) for y in (5, length-5)]
    all_board_holes = [(bx+x, by+y) for x, y in c['board_holes']]
    # Photo shows the USB-end hole hidden by the ESP32 daughterboard.
    board_mounts = [max(all_board_holes, key=lambda p: p[1])]
    keeper_top = pcb_z+c['board_thickness']+.4
    keepers = (bx, bx+bw-2)

    base = box(0, 0, 0, w, length, h)
    base -= box(wall, wall, f, w-2*wall, length-2*wall, h)
    # Mount ears: no metal mounting screws inside the PCB/antenna envelope.
    for x in (-8, w-1):
        base += box(x, length/2-9, 0, 9, 18, f)
        base -= cylinder(x+4.5, length/2, -.1, 4.2, f+.2)
    for x, y in screws:
        # Square corner towers are joined to both adjacent walls.
        base += box(x-3.8, y-3.8, f-.1, 7.6, 7.6, h-f+.1)
        base -= cylinder(x, y, h-9, pilot, 9.1)
    for x, y in board_mounts:
        base += cylinder(x, y, f-.1, 7, pcb_z-f+.1)
        base -= cylinder(x, y, f+.8, pilot, pcb_z-f)
    for x in keepers:
        # Small corner seats, an edge fence and a 1.2 mm retaining overhang.
        # Insert PCB front corners under these lips, lower rear, fit rear screw.
        base += box(x, by-2, f-.1, 2, 3.2, pcb_z-f+.1)
        base += box(x, by-2, pcb_z-.1, 2, 1.6, keeper_top-pcb_z+.2)
        base += box(x, by-2, keeper_top, 2, 3.2, 1.2)

    # Front face only: slide-in panel, trapped when the lid is installed.
    # Grooves have 0.3 mm clearance on each side of a 2.4 mm panel.
    base -= box(12, -.1, f, w-24, wall+.2, h)
    for x in (8, w-10):
        base += box(x, wall-.1, f-.1, 2, 5.5, h-f+.1)
    for x in (8, w-13):
        base += box(x, 5.4, f-.1, 5, 2.4, h-f+.1)

    # Lid exterior lies on the print bed; centering lip prints upward.
    t = c['lid_thickness']
    lid = box(0, 0, 0, w, length, t)
    lip = box(wall+.4, 8.5, t-.1, w-2*(wall+.4), length-8.5-wall-.4, 2.1)
    lip -= box(wall+1.6, 9.7, t-.2, w-2*(wall+1.6), length-9.7-wall-1.6, 2.3)
    for x, y in screws:
        lip -= box(x-4.2, y-4.2, t-.2, 8.4, 8.4, 2.4)
        lid -= cylinder(x, y, -.1, 3.3, t+.2)
    lid += lip
    # Roof vent slots print through the flat lid without supports.
    for x in (w/2-12, w/2-4, w/2+4, w/2+12):
        lid -= box(x-1, length/2-10, -.1, 2, 20, t+.2)
    # No metal grille or internal crossbars above the ESP32 antenna.

    # Panel geometry is first made in its installed orientation.
    px, py, pz = 10.3, 2.7, f
    panel = box(px, py, pz, w-2*px, 2.4, h-f-.3)
    usb_x = w/2+c['usb_window_offset_from_center']
    can_x = w/2+c['can_window_offset_from_center']
    usb_bottom = f+c['usb_window_bottom_above_floor']
    assert f+3 < usb_bottom < h-3
    for cx, width, bottom in (
        (usb_x, c['usb_window_width'], usb_bottom),
        (can_x, c['can_window_width'], h-c['can_window_depth']),
    ):
        assert px+2 < cx-width/2 and cx+width/2 < w-px-2
        panel -= box(cx-width/2, py-.1, bottom, width, 2.6, h)
    # Flat face on bed: original y thickness becomes print z.
    panel_print = panel.translate((-px, -py, -pz)).rotate((90, 0, 0))
    panel_print = panel_print.translate((0, h-f-.3, 0))

    # Low, open-centre frame uses actual PCB bosses and underside height.
    fit = base ^ box(-9, -1, 0, w+18, length+2, keeper_top+1.2)
    fit -= box(bx+5, by+10, -.1, bw-10, bl-20, keeper_top+1.4)

    # Hole-size coupon for the selected plastic screws, before a full print.
    gauge = box(0, 0, 0, 32, 12, 7)
    for x, d in ((6, 2.3), (16, 2.5), (26, 2.7)):
        gauge -= cylinder(x, 6, 1, d, 6.1)

    # Check actual assembled solids, including PCB and component envelopes.
    lid_installed = lid.rotate((0, 180, 0)).translate((w, 0, h+t))
    assembled = [base, lid_installed, panel]
    pcb = box(bx, by, pcb_z+.01, bw, bl, c['board_thickness']-.02)
    components = box(bx, by, pcb_z+c['board_thickness'], bw, bl,
                     c['components_above_board'])
    underside = box(bx, by, f+.01, bw, bl,
                    c['below_board_clearance']-.02)
    for x, y in board_mounts:
        underside -= cylinder(x, y, f, 7.2, c['below_board_clearance'])
    for x in keepers:
        # Explicit component/solder-free edge-contact zones, not blanket
        # exclusions across the populated USB end of the board.
        keepout = box(x-.01, by-.01, f, 2.02, 1.23, h)
        components -= keepout
        underside -= keepout
    for part in assembled:
        for envelope in (pcb, components, underside):
            assert (part ^ envelope).volume() < .001, 'Electronic envelope collision'
    for i, part in enumerate(assembled):
        for j, other in enumerate(assembled[i+1:], i+1):
            overlap = (part ^ other).volume()
            assert overlap < .001, f'Printed part collision: {i}, {j}: {overlap} mm3'
    # Include a small USB connector overhang beyond the proto-board outline.
    usb_connector = box(w/2-5, by-3, pcb_z+c['board_thickness']+.1, 10, 3.1, 4)
    for part in assembled:
        assert (part ^ usb_connector).volume() < .001, 'USB connector overhang collision'
    for cx, width, bottom in (
        (usb_x, c['usb_window_width'], usb_bottom),
        (can_x, c['can_window_width'], h-c['can_window_depth']),
    ):
        # Free path from outside to 3 mm before the board front edge.
        path = box(cx-width/2+.01, -.1, bottom+.01, width-.02, by-2.9, h-bottom-.02)
        for part in assembled:
            assert (part ^ path).volume() < .001, 'Cable path obstructed'
    report = {
        'units': 'mm', 'revision': c['revision'], 'physical_fit_verified': False,
        'underside_offset_user_confirmed': c['underside_offset_user_confirmed'],
        'height_above_pcb_mm': c['components_above_board'],
        'headroom_mm': c['headroom'],
        'case_body_mm': [w, length, h+t],
        'width_with_mount_ears_mm': w+16,
        'pcb_origin_mm': [bx, by, pcb_z], 'pcb_screw_centers_xy_mm': board_mounts,
        'pcb_mounting': 'rear screw plus two front corner retainers; covered front hole unused',
        'front_retainer_component_free_zones_mm': [[x, by, 2, 1.2] for x in keepers],
        'retainer_pcb_thickness_gap_mm': .4,
        'footprint_reduction_vs_v1_percent': round(100*(1-w*length/(74.8*111.28)), 1),
        'lid_screw_centers_xy_mm': screws,
        'lid_pilot_depth_mm': 9, 'pcb_pilot_depth_mm': pcb_z-f-.8,
        'usb_opening_mm': [c['usb_window_width'], h-usb_bottom],
        'can_opening_mm': [c['can_window_width'], c['can_window_depth']],
        'panel_groove_clearance_each_side_mm': .3,
        'nominal_electronics_assembly_and_cable_path_collision_checks': 'passed',
        'parts': {},
    }
    return {'base': base, 'lid': lid, 'cable_panel': panel_print,
            'board_fit_test': fit, 'screw_fit_test': gauge}, report


def preview(meshes, output=OUT, title='ESP32 cabin case', placements=None,
            caption='Base + lid + removable USB/CAN panel (shown flat at right)'):
    # Orthographic mesh triangles, with per-pixel depth for correct occlusion.
    pieces = []
    if placements is None:
        placements = [('base', (0, 0, 0)), ('lid', (0, 0, 60)),
                      ('cable_panel', (90, 0, 0))]
    for name, offset in placements:
        mesh = meshes[name]
        vertices = mesh.vertices.copy()
        if name == 'lid':
            vertices[:, 0] = meshes['lid'].bounds[1, 0] - vertices[:, 0]
            vertices[:, 2] = -vertices[:, 2]
        vertices += offset
        for face in mesh.faces:
            points = vertices[face]
            view = np.array([.55, -1, .565])
            normal = np.cross(points[1]-points[0], points[2]-points[0])
            if normal @ view <= 0:
                continue
            normal /= np.linalg.norm(normal)
            shade = .58+.42*max(0, normal @ (view/np.linalg.norm(view)))
            projected = np.column_stack((points[:, 0]+.55*points[:, 1],
                                          .3*points[:, 0]-.4*points[:, 1]-points[:, 2]))
            pieces.append((name, projected, shade, points @ view))
    points = np.concatenate([p[1] for p in pieces])
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    scale = min(850/(maximum[0]-minimum[0]), 590/(maximum[1]-minimum[1]))
    pixels = np.empty((1184, 1600, 3), dtype=np.uint8)
    pixels[:] = (20, 33, 43)
    depth_buffer = np.full((1184, 1600), -np.inf)
    colors = {'base': '#68adbf', 'lid': '#b8d5df', 'cable_panel': '#e5b96e'}
    for name, projected, shade, depths in pieces:
        p = ((projected-minimum)*scale+[65, 100])*1.6
        rgb = tuple(int(int(colors[name][i:i+2], 16)*shade) for i in (1, 3, 5))
        lo = np.maximum(np.floor(p.min(axis=0)).astype(int), (0, 0))
        hi = np.minimum(np.ceil(p.max(axis=0)).astype(int), (1599, 1183))
        xx, yy = np.meshgrid(np.arange(lo[0], hi[0]+1)+.5,
                             np.arange(lo[1], hi[1]+1)+.5)
        a, b, d = p
        denominator = (b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1])
        if abs(denominator) < 1e-8:
            continue
        u = ((b[1]-d[1])*(xx-d[0])+(d[0]-b[0])*(yy-d[1]))/denominator
        v = ((d[1]-a[1])*(xx-d[0])+(a[0]-d[0])*(yy-d[1]))/denominator
        q = 1-u-v
        depth = u*depths[0]+v*depths[1]+q*depths[2]
        region = np.s_[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        visible = (u >= -1e-8) & (v >= -1e-8) & (q >= -1e-8) & (depth > depth_buffer[region])
        depth_buffer[region][visible] = depth[visible]
        pixels[region][visible] = rgb
    raster = Image.fromarray(pixels)
    draw = ImageDraw.Draw(raster)
    draw.text((30, 22), title+' - actual meshes, exploded view - fit not verified', fill='white', font_size=25)
    draw.text((30, 1140), caption, fill='white', font_size=23)
    raster.save(output/'preview.png')


def main():
    config = json.loads((ROOT/'esp32_case.json').read_text())
    parts, report = build(config)
    OUT.mkdir(exist_ok=True)
    meshes = {}
    for name, solid in parts.items():
        meshes[name], report['parts'][name] = export(name, solid, OUT)
    preview(meshes)
    (OUT/'validation.json').write_text(json.dumps(report, indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'esp32-case-print-pack.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for path in sorted(OUT.iterdir()):
            z.write(path, path.name)
        for filename in ('esp32_case.py', 'esp32_case.json', 'generate.py', 'requirements.txt',
                         'requirements-esp32-case.txt'):
            z.write(ROOT/filename, 'source/'+filename)
        guide = ROOT.parents[1]/'docs/esp32-logger.md'
        if not guide.is_file():
            guide = ROOT.parent/'assembly-guide.md'  # Extracted print pack.
        if guide.is_file():
            z.write(guide, 'assembly-guide.md')


if __name__ == '__main__':
    main()
