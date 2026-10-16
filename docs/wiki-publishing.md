# Publishing the GitHub wiki

The [public wiki](https://github.com/nayman898/van-canbus/wiki) is generated from
the build documentation in this repository. Make content changes here first,
then export and publish the wiki. Direct edits to generated wiki pages will
be replaced by the next export.

Successful pushes to `main` now publish automatically through the
[verification and build workflow](automation.md). It uses the built-in token
with write permission limited to the publishing job, or an optional `WIKI_TOKEN`
secret. Pull requests only generate a downloadable preview. The manual steps
below remain available.

The publishing job succeeded in [October 16 run 38910515542](https://github.com/nayman898/van-canbus/actions/runs/38910515542)
for commit `69a9859`. That confirms the existing publication path; each new
documentation update must still pass its own source workflow.

## Preview locally

From the repository root, using Python 3.10 or newer:

```powershell
py -3 tools/export_wiki.py --output .cache/wiki-preview
```

This generates every page in the exporter's `PAGES` mapping, plus `_Sidebar.md`
and `_Footer.md`. The set includes Getting started, printed cases, ESP32,
RPM, GlowShift, the Android guide and the original build guides. Links between guides
become wiki links; source-code links point back to the main repository.
Fenced code examples remain unchanged. The script does not commit or push.

Read `Home.md` and `Getting-Started.md` first, then check the sidebar and
`Printed-Cases.md`. Follow the first-setup route without assuming the owner's
local `.cache` files, COM port or Wi-Fi password exist on another computer.
The exporter validates local file targets; review heading links and the actual
instructions as well. Individual STL downloads are tracked assets; locally
generated print-pack ZIPs and private recovery files are not published.

## Publication readiness

Before publishing a documentation update:

1. Run the documentation tests and export a fresh preview:
   `python -m unittest discover -s tests -p test_wiki.py` and
   `python tools/export_wiki.py --output .cache/wiki-preview`.
2. Include every new guide in `PAGES`; navigation is generated from it.
   The tests check that all top-level build guides are mapped.
3. Include linked source assets such as STLs, instructions and diagrams in the
   source commit. A file existing only in `.cache` or an ignored ZIP is not a
   public download.
4. Commit/push the source documentation before updating the wiki, so wiki
   source links resolve to the same published material. Confirm all required
   Actions jobs pass and **Publish generated wiki** succeeds. A skipped wiki
   job does not update the live pages.

The local preview is a review artifact, not evidence of a published wiki.

## Publish

The wiki must already have an initial page saved on GitHub. Clone its separate
Git repository beside the project (only needed once):

```powershell
git clone https://github.com/nayman898/van-canbus.wiki.git ../van-canbus.wiki
```

Commit and publish the source documentation in the main repository first, so
the wiki's source links refer to the published build notes. Then, with a clean
wiki checkout:

```powershell
git -C ../van-canbus.wiki pull --ff-only
py -3 tools/export_wiki.py --output ../van-canbus.wiki
git -C ../van-canbus.wiki diff --check
git -C ../van-canbus.wiki status --short
git -C ../van-canbus.wiki diff
```

Review new files as well as the diff. Stage only the generated files:

```powershell
git -C ../van-canbus.wiki add Home.md Getting-Started.md Build-Guide.md Build-Progress.md Hardware.md Printed-Cases.md RPM-Input.md GlowShift-Inputs.md GlowShift-Circuit.md Bench-Setup.md Harness-and-Power.md Firmware.md CAN-Protocol.md ESP32-Logger.md Laptop-Tools.md Android-App.md Automation.md Wiki-Publishing.md _Sidebar.md _Footer.md
git -C ../van-canbus.wiki commit -m "Update build documentation"
git -C ../van-canbus.wiki push origin HEAD
```

The export replaces the named generated pages and navigation files. It does
not delete unrelated wiki pages. Use the wiki's existing default branch; do
not assume it has the same branch name as the source repository.

To add another generated page, extend `PAGES` in
[export_wiki.py](../tools/export_wiki.py) and the staging command above. The
sidebar is generated from that mapping. The exporter supports the inline
Markdown links and fenced blocks used by the current guides; extend its
handling before introducing other link formats.
