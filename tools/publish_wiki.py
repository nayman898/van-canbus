#!/usr/bin/env python3
"""Publish generated wiki pages, preserving other pages and normal Git history."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import subprocess

from export_wiki import PAGES, REPOSITORY, ROOT, export


def git(*args: str, cwd: Path = ROOT) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, text=True, capture_output=True
    ).stdout.strip()


def update_checkout(checkout: Path, source_sha: str) -> bool:
    """Stage only our generated pages; return False when nothing changed."""
    if git("status", "--porcelain", cwd=checkout):
        raise ValueError("Wiki checkout must be clean before generating pages")
    export(checkout, "main")
    filenames = [f"{page}.md" for page, _ in PAGES.values()]
    git("add", "--", *filenames, "_Sidebar.md", "_Footer.md", cwd=checkout)
    if not git("diff", "--cached", "--name-only", cwd=checkout):
        return False
    git("diff", "--cached", "--check", cwd=checkout)
    git("config", "user.name", "github-actions[bot]", cwd=checkout)
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com", cwd=checkout)
    git("commit", "-m", f"Update generated documentation ({source_sha[:12]})", cwd=checkout)
    return True


def is_current_main(source_sha: str) -> bool:
    remote = git("ls-remote", f"{REPOSITORY}.git", "refs/heads/main")
    return bool(remote) and remote.split()[0] == source_sha


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.source_sha):
        raise ValueError("Expected a full source commit SHA")
    if git("rev-parse", "HEAD") != args.source_sha:
        raise ValueError("Source checkout does not match the tested commit")
    if not is_current_main(args.source_sha):
        print("Skipping wiki: a newer main commit exists.")
        return

    checkout = ROOT / ".cache" / "wiki-publish"
    if checkout.exists():
        raise ValueError("Use a fresh checkout; .cache/wiki-publish already exists")
    checkout.parent.mkdir(parents=True, exist_ok=True)
    git("clone", "--depth", "1", f"{REPOSITORY}.wiki.git", str(checkout))
    if not update_checkout(checkout, args.source_sha):
        print("Wiki already matches the repository; no commit needed.")
        return
    if not is_current_main(args.source_sha):
        print("Skipping wiki push: main advanced while generating pages.")
        return
    # Keep the wiki's actual default branch; never force-push or delete pages.
    git("push", "origin", "HEAD", cwd=checkout)
    print(f"Published {len(PAGES)} generated pages to {REPOSITORY}/wiki")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        # Git's URLs contain no tokens. Preserve useful authentication errors.
        raise SystemExit(exc.stderr.strip() or str(exc)) from exc
