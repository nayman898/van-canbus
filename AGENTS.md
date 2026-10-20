# Circuit assembly guides

The user set the existing pressure-board interactive guide as the minimum
standard for new or revised circuit assembly diagrams. Follow the interaction
and visual approach in `.cache/pressure-board/pressure-board-interactive.html`
and its generator when available; do not replace it with a simpler conceptual
block diagram or a disconnected list of wires.

- Provide a clear all-in-one assembly drawing, an illustrated top-side parts
  view, and a mirrored underside jumper/solder view when applicable.
- Show the actual board's complete labeled grid and confirmed copper groups.
  Mark any unverified mechanical dimensions or header-fit assumptions.
- Reuse known board and printed-holder geometry before assigning solder holes.
  Read `hardware/protective-plates/boards.json`, the applicable case/holder
  generator, and `docs/hardware.md`. Show PCB mounting holes, screw-head/washer
  and tool-access zones, underside post contacts, corner-clip contacts, and
  underside clearance where applicable. Check component bodies, header/solder
  pads, and on-board wire routes against these zones. Known EPLZON dimensions
  are 38.1 × 50.8 mm with central 3.2 mm holes at (19.05, 5.1) and
  (19.05, 45.7) mm, 40.6 mm apart. Its original tray uses 6 mm posts; the
  alternative corner holder contacts 5 × 5 mm at each corner. Do not treat
  mounting clearance as an unknown when its CAD is already in this repository.
- Give each component, actual jumper, and external lead a stable reference;
  provide a key naming every lead/pin hole and its purpose. Distinguish factory
  copper from wires the user must install.
- Support click and Find selection, dim unrelated items, and highlight the
  exact holes in both views. Keep original top-side hole names in the mirrored
  underside view. Include zoom, reset, and printing/offline SVG output.
- Show component bodies, orientation, top/bottom assembly side, and legible
  routes with bends. Validate occupied-hole collisions, copper/net joins, and
  mirrored coordinates; inspect the rendered result and test interactions.
- Clearly identify future/unavailable hardware, unassigned MCU pins, and
  parked leads. Preserve the user's existing connector assignments.

Keep local-only prototype drawings in `.cache` unless the user requests
tracked/public artifacts. Do not commit or publish merely to deliver a guide.
