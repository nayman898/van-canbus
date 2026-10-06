#!/usr/bin/env python3
"""Export the build docs to Markdown pages for the GitHub wiki; never push."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "https://github.com/nayman898/van-canbus"
WIKI = f"{REPOSITORY}/wiki"
PAGES = {
    "README.md": ("Home", "Project overview"),
    "docs/README.md": ("Build-Guide", "Start here"),
    "docs/build-progress.md": ("Build-Progress", "Build progress"),
    "docs/hardware.md": ("Hardware", "Hardware and parts"),
    "docs/bench-setup.md": ("Bench-Setup", "Bench setup"),
    "docs/engine-node-harness.md": ("Harness-and-Power", "Harness and vehicle power"),
    "docs/firmware.md": ("Firmware", "Firmware"),
    "docs/can-protocol.md": ("CAN-Protocol", "CAN protocol"),
    "tools/README.md": ("Laptop-Tools", "Dashboard and monitoring"),
    "android-app/README.md": ("Android-App", "Android dashboard"),
    "docs/automation.md": ("Automation", "Checks and build downloads"),
    "docs/wiki-publishing.md": ("Wiki-Publishing", "Wiki publishing"),
}
LINK = re.compile(r"(!?\[[^\]\n]*\]\()([^\s)]+)(\))")


def rewrite_links(body: str, source: Path, branch: str) -> str:
    """Rewrite this project's inline links, leaving fenced examples intact."""
    def replace(match: re.Match[str]) -> str:
        target = match[2]
        parts = urlsplit(target)
        if parts.scheme or parts.netloc or not parts.path:
            return match[0]
        resolved = (source.parent / unquote(parts.path)).resolve()
        relative = resolved.relative_to(ROOT).as_posix()
        if not resolved.is_file():
            raise ValueError(f"Missing link target in {source}: {target}")
        if relative in PAGES:
            url = f"{WIKI}/{PAGES[relative][0]}"
        elif resolved.suffix == ".md":
            raise ValueError(f"Add a wiki page mapping for {relative}")
        else:
            view = "raw" if match[1].startswith("!") else "blob"
            url = f"{REPOSITORY}/{view}/{quote(branch, safe='')}/{quote(relative)}"
        if parts.query:
            url += f"?{parts.query}"
        if parts.fragment:
            url += f"#{parts.fragment}"
        return f"{match[1]}{url}{match[3]}"

    output = []
    fence_char = None
    fence_length = 0
    for line in body.splitlines(keepends=True):
        fence = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence_char is None and fence:
            fence_char = fence[1][0]
            fence_length = len(fence[1])
            output.append(line)
        elif fence_char is not None:
            output.append(line)
            if (fence and fence[1][0] == fence_char
                    and len(fence[1]) >= fence_length and not fence[2].strip()):
                fence_char = None
        else:
            output.append(LINK.sub(replace, line))
    return "".join(output)


def export(output: Path, branch: str) -> None:
    output = output.resolve()
    if output == ROOT or ROOT in output.parents and ".cache" not in output.relative_to(ROOT).parts:
        raise ValueError("Use a separate wiki checkout or a directory under .cache")

    # Render and validate all sources before writing any pages.
    rendered = {}
    for relative, (page, _) in PAGES.items():
        source = ROOT / relative
        body = rewrite_links(source.read_text(encoding="utf-8"), source, branch)
        provenance = (
            f"\n\n---\n\nMaintained in [{relative}]"
            f"({REPOSITORY}/blob/{quote(branch, safe='')}/{quote(relative)}). "
            "Edit the repository documentation and re-export to update this page.\n"
        )
        rendered[f"{page}.md"] = body.rstrip() + provenance

    rendered["_Sidebar.md"] = "# Van CAN build\n\n" + "".join(
        f"- [{title}]({WIKI}/{page})\n" for page, title in PAGES.values()
    ) + f"\n[Source repository]({REPOSITORY})\n"
    rendered["_Footer.md"] = (
        f"[Project source]({REPOSITORY}) · "
        f"[Questions and build feedback]({REPOSITORY}/issues)\n\n"
        "Build in progress: bench-tested features and proposed vehicle work "
        "are identified on each page.\n"
    )
    output.mkdir(parents=True, exist_ok=True)
    for filename, content in rendered.items():
        (output / filename).write_text(content, encoding="utf-8")
    print(f"Exported {len(PAGES)} pages, sidebar, and footer to {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True,
                        help="Separate wiki checkout or .cache preview directory")
    parser.add_argument("--branch", default="main", help="Source branch for code links")
    args = parser.parse_args()
    export(args.output, args.branch)


if __name__ == "__main__":
    main()
