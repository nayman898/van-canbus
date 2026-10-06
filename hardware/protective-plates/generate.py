"""Generate millimetre-scale, support-free bench guards; no printer-specific G-code.

Run with Python 3.12+ and requirements.txt from this directory installed.
STLs, a validation report, and a top-view SVG are generated beside this file.
Physical fit/clearances must be checked before powering the electronics.
"""
from pathlib import Path
import json
import struct

import manifold3d as m
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parent
FLOOR = 2.4
WALL = 2.0
SIDE_GAP = 0.6
PILOT = 2.7
BOSS_DIAMETER = 6.0
SEGMENTS = 48


def box(x, y, z, dx, dy, dz):
    return m.Manifold.cube((dx, dy, dz)).translate((x, y, z))


def cylinder(x, y, z, diameter, height):
    return m.Manifold.cylinder(height, diameter / 2,
                               circular_segments=SEGMENTS).translate((x, y, z))


def tray(board, coupon=False):
    width, length, clearance = board["width"], board["length"], board["clearance"]
    margin = WALL + SIDE_GAP
    outer_w, outer_l = width + margin * 2, length + margin * 2
    if coupon:
        # Thin rail checks hole spacing and screw fit only, NOT solder clearance.
        part = box(width / 2 + margin - 4, 0, 0, 8, outer_l, 1.2)
        for x, y in board["holes"]:
            part -= cylinder(x + margin, y + margin, -0.1, PILOT, 1.4)
        return part
    part = box(0, 0, 0, outer_w, outer_l, FLOOR)
    # Low perimeter guards stop 1 mm below the PCB underside. All four sides
    # have 12 mm open-top wire notches; no fixed-height cable holes to thread.
    rim_height = clearance - 1.0
    rim = box(0, 0, FLOOR, outer_w, outer_l, rim_height)
    rim -= box(WALL, WALL, FLOOR - 0.1, outer_w - 2 * WALL,
               outer_l - 2 * WALL, rim_height + 0.2)
    rim -= box(outer_w / 2 - 6, -0.1, FLOOR, 12, outer_l + 0.2, rim_height + 0.1)
    rim -= box(-0.1, outer_l / 2 - 6, FLOOR, outer_w + 0.2, 12, rim_height + 0.1)
    part += rim
    for x, y in board["holes"]:
        x, y = x + margin, y + margin
        part += cylinder(x, y, FLOOR - 0.1, BOSS_DIAMETER, clearance + 0.1)
        # Blind pilot, floor intact: M3 x 6 mm with nominal 1.6 mm PCB.
        part -= cylinder(x, y, FLOOR + 0.8, PILOT, clearance)
    return part


def nucleo_blank():
    # Deliberately no guessed Nucleo mounting coordinates. Transfer actual holes
    # to plastic with the board unpowered, then remove PCB before drilling.
    return box(0, 0, 0, 90, 100, FLOOR)


def spacer():
    # Print upright; use only at verified mechanical mounting holes/keepouts.
    return cylinder(3, 3, 0, 6, 12) - cylinder(3, 3, -0.1, 3.3, 12.2)


def nucleo_edge_tray(config):
    """USB at Y=0. PCB origin (9,4), underside at floor + pin clearance.

    Two separate removable front stops attach OUTSIDE the PCB using M3x6.
    All contact with the PCB is confined to its outer edge strips.
    """
    width, length = config['width'], config['length']
    clearance = config['pins_below_pcb'] + config['pin_margin']
    pcb_z = FLOOR + clearance
    channel = config['pcb_thickness'] + config['thickness_tolerance']
    gap, overlap = config['side_clearance'], config['edge_overlap']
    outer_w, outer_l = width + 18, length + 7
    board_left, board_right = 9, 9 + width
    left_inner, right_inner = board_left - gap, board_right + gap
    rail_left, rail_right = left_inner - 3, right_inner + 3
    tray_part = box(0, 0, 0, outer_w, outer_l, FLOOR)
    for start, end, inner_start, inner_end in (
        (rail_left, board_left + overlap, rail_left, left_inner),
        (board_right - overlap, rail_right, right_inner, rail_right),
    ):
        # Shelf holds board underside; wall locates edge; small top lip captures it.
        tray_part += box(start, 10, FLOOR - .1, end - start, length - 6, clearance + .1)
        tray_part += box(inner_start, 10, pcb_z - .1, inner_end - inner_start,
                         length - 6, channel + 1.3)
        tray_part += box(start, 10, pcb_z + channel, end - start, length - 6, 1.2)
    # Far-end stop leaves 0.5 mm beyond the nominal board outline.
    tray_part += box(rail_left, 4 + length + .5, FLOOR - .1,
                     rail_right - rail_left, 2.5, clearance + channel + .1)
    stops = []
    for right in (False, True):
        x = outer_w - 9.5 if right else 0
        screw_x = outer_w - 4 if right else 4
        tray_part += box(x, 0, FLOOR - .1, 9.5, 9, 6.1)
        tray_part -= cylinder(screw_x, 4, FLOOR + .8, PILOT, 6)
        # Export each stop on the bed. Its assembled underside is at Z=8.4.
        stop = box(.5 if right else 0, 0, 0, 9.5, 8, 2.4)
        inner_x = 0 if right else 8.5
        stop += box(inner_x, 0, 2.3, 1.5, 3.5,
                    pcb_z + channel - (FLOOR + 6) - 2.3)
        stop -= cylinder(6 if right else 4, 4, -.1, 3.3, 2.6)
        stops.append(stop)
    # A full-width slice to check BOTH rail spacing and PCB thickness cheaply.
    coupon = (tray_part ^ box(0, 40, 0, outer_w, 12, pcb_z + channel + 2)).translate((0, -40, 0))
    # Verify geometry stays out of a nominal PCB and central 8 mm pin envelope.
    pcb = box(board_left, 4, pcb_z + .01, width, length, config['pcb_thickness'] - .02)
    assert (tray_part ^ pcb).volume() < .001, 'Tray collides with nominal PCB'
    pins = box(board_left + overlap + .1, 4, pcb_z - config['pins_below_pcb'],
               width - 2 * overlap - .2, length, config['pins_below_pcb'] - .01)
    assert (tray_part ^ pins).volume() < .001, 'Tray collides with pin envelope'
    for x, stop in zip((0, outer_w - 10), stops):
        assembled = stop.translate((x, 0, FLOOR + 6))
        assert (assembled ^ pcb).volume() < .001, 'Stop collides with PCB'
        assert (assembled ^ pins).volume() < .001, 'Stop collides with pin envelope'
        assert (assembled ^ tray_part).volume() < .001, 'Stop collides with tray'
    return tray_part, coupon, stops


def export(name, solid, destination):
    assert solid.status() == m.Error.NoError, (name, solid.status())
    raw = solid.to_mesh()
    mesh = trimesh.Trimesh(vertices=np.array(raw.vert_properties[:, :3]),
                           faces=np.array(raw.tri_verts), process=True)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0, name
    assert len(solid.decompose()) == 1, f"{name}: disconnected pieces"
    assert abs(mesh.bounds[0, 2]) < 0.001, f"{name}: not on print bed"
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f"{name}.stl"
    mesh.export(target)
    # Round-trip STL validation without trimesh's optional scipy dependency.
    data = target.read_bytes()
    count = struct.unpack_from("<I", data, 80)[0]
    assert len(data) == 84 + count * 50
    print(f"{name}: watertight, {count} triangles, {mesh.extents.round(2)} mm")
    return mesh, {"size_mm": mesh.extents.round(3).tolist(),
                  "volume_mm3": round(float(mesh.volume), 2),
                  "watertight": True, "connected_parts": 1, "triangles": count}


def preview(meshes):
    # Top-view SVG of actual mesh geometry; no guessed perspective occlusion.
    items = ['<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="450" viewBox="0 0 1050 450">',
             '<rect width="1050" height="450" fill="#101c25"/>',
             '<text x="30" y="35" fill="white" font-family="sans-serif" font-size="21">Van CAN — top view of bottom guards (not fit-tested)</text>']
    labels = ["EPLZON: two central M3 mounts", "Perma-Proto half: two M3 mounts", "Nucleo: edge rails / USB end open"]
    for i, (mesh, label) in enumerate(zip(meshes, labels)):
        verts = mesh.vertices
        projected = np.column_stack((verts[:, 0], -verts[:, 1]))
        scale = min(290 / np.ptp(projected[:, 0]), 265 / np.ptp(projected[:, 1]))
        projected = (projected - projected.min(axis=0)) * scale + [30 + i * 345, 110]
        camera = np.array([0.0, 0.0, 1.0])
        depth = verts[:, 2]
        order = np.argsort(depth[mesh.faces].mean(axis=1))
        for face_id in order:
            normal = mesh.face_normals[face_id]
            if np.dot(normal, camera) <= 0:
                continue
            points = ' '.join(f'{x:.2f},{y:.2f}' for x, y in projected[mesh.faces[face_id]])
            light = float(verts[mesh.faces[face_id], 2].mean() / mesh.bounds[1, 2])
            color = f'rgb({int(38+30*light)},{int(106+80*light)},{int(124+80*light)})'
            items.append(f'<polygon points="{points}" fill="{color}" stroke="{color}" stroke-width="0.25"/>')
        items.append(f'<text x="{30+i*345}" y="410" fill="white" font-family="sans-serif" font-size="14">{label}</text>')
    items.append('</svg>')
    (ROOT / 'preview.svg').write_text('\n'.join(items), encoding='utf-8')


def main():
    boards = json.loads((ROOT / 'boards.json').read_text())
    report, display = {}, []
    for name, board in boards.items():
        mesh, report[name] = export(name + '_tray', tray(board), ROOT / 'stl')
        display.append(mesh)
        _, report[name + '_fit_test'] = export(name + '_fit_test', tray(board, True), ROOT / 'stl')
    _, report['nucleo_blank'] = export('nucleo_drill_to_fit_90x100', nucleo_blank(), ROOT / 'stl')
    _, report['spacer'] = export('m3_spacer_12mm', spacer(), ROOT / 'stl')
    config = json.loads((ROOT / 'nucleo.json').read_text())
    nucleo, coupon, stops = nucleo_edge_tray(config)
    mesh, report['nucleo_edge_tray'] = export('nucleo_edge_tray_8mm_pins', nucleo, ROOT / 'stl')
    report['nucleo_edge_tray']['nominal_pcb_and_pin_envelope_collision_checks'] = 'passed'
    report['nucleo_edge_tray']['pin_to_floor_clearance_mm'] = config['pin_margin']
    display.append(mesh)
    _, report['nucleo_rail_fit_test'] = export('nucleo_rail_fit_test', coupon, ROOT / 'stl')
    for side, stop in zip(('left', 'right'), stops):
        _, report['nucleo_stop_' + side] = export('nucleo_stop_' + side, stop, ROOT / 'stl')
    preview(display)
    (ROOT / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
