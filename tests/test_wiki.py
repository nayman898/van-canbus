import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import export_wiki
import publish_wiki


class WikiTests(unittest.TestCase):
    def test_export_validates_all_pages_and_links(self):
        with tempfile.TemporaryDirectory() as temp:
            output = pathlib.Path(temp)
            export_wiki.export(output, "main")
            self.assertEqual(len(list(output.glob("*.md"))), len(export_wiki.PAGES) + 2)
            self.assertIn("/wiki/Android-App", (output / "Home.md").read_text())
            self.assertIn("/wiki/Automation", (output / "_Sidebar.md").read_text())

    def test_fenced_examples_are_not_rewritten(self):
        body = "```md\n[example](missing.md)\n```\n[firmware](docs/firmware.md)\n"
        result = export_wiki.rewrite_links(body, ROOT / "README.md", "main")
        self.assertIn("[example](missing.md)", result)
        self.assertIn("/wiki/Firmware", result)

    def test_missing_link_is_an_error(self):
        with self.assertRaisesRegex(ValueError, "Missing link target"):
            export_wiki.rewrite_links("[bad](missing.md)", ROOT / "README.md", "main")

    def test_export_cannot_overwrite_source_tree(self):
        with self.assertRaises(ValueError):
            export_wiki.export(ROOT, "main")

    def test_publish_preserves_manual_pages_and_skips_unchanged_content(self):
        # Entirely local Git repository: this test cannot publish to GitHub.
        with tempfile.TemporaryDirectory() as temp:
            checkout = pathlib.Path(temp)
            subprocess.run(["git", "init", "-q", str(checkout)], check=True)
            def git(*args):
                return publish_wiki.git(*args, cwd=checkout)
            git("config", "user.name", "Wiki test")
            git("config", "user.email", "wiki-test@example.invalid")
            (checkout / "Manual.md").write_text("Keep my manual notes\n")
            git("add", "Manual.md")
            git("commit", "-qm", "Existing wiki")
            self.assertTrue(publish_wiki.update_checkout(checkout, "a" * 40))
            first = git("rev-parse", "HEAD")
            self.assertEqual((checkout / "Manual.md").read_text(), "Keep my manual notes\n")
            self.assertFalse(publish_wiki.update_checkout(checkout, "b" * 40))
            self.assertEqual(git("rev-parse", "HEAD"), first)
            (checkout / "Manual.md").write_text("Unsaved local edits\n")
            with self.assertRaisesRegex(ValueError, "must be clean"):
                publish_wiki.update_checkout(checkout, "c" * 40)

    def test_stale_run_does_not_publish(self):
        with patch.object(publish_wiki, "git", return_value="b" * 40 + "\trefs/heads/main"):
            self.assertFalse(publish_wiki.is_current_main("a" * 40))
            self.assertTrue(publish_wiki.is_current_main("b" * 40))


if __name__ == "__main__":
    unittest.main()
