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

## Preview locally

From the repository root, using Python 3.10 or newer:

```powershell
py -3 tools/export_wiki.py --output .cache/wiki-preview
```

This generates twelve pages, `_Sidebar.md`, and `_Footer.md`. Links between guides
become wiki links; source-code links point back to the main repository.
Fenced code examples remain unchanged. The script does not commit or push.

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
git -C ../van-canbus.wiki add Home.md Build-Guide.md Build-Progress.md Hardware.md Bench-Setup.md Harness-and-Power.md Firmware.md CAN-Protocol.md Laptop-Tools.md Android-App.md Automation.md Wiki-Publishing.md _Sidebar.md _Footer.md
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
