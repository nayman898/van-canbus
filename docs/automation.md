# Automated checks and builds

[Documentation index](README.md) · [Android dashboard](../android-app/README.md)

The [Verify, build, and publish wiki workflow](../.github/workflows/verify-build.yml)
runs on pushes to `main`, pull requests targeting `main`, and **Actions → Verify,
build, and publish wiki → Run workflow**. Pull requests run checks and builds;
only successful `main` runs in the original repository can publish the wiki.

## What runs

| Job | Checks and output |
| --- | --- |
| Host tools and documentation | Python decoder/dashboard/wiki tests, Python bug checks, dashboard JavaScript syntax and dual-temperature UI tests, Actions validation, generated wiki with local-link checks |
| Firmware (Debug / Release) | C encoder golden vectors; compile/link the STM32 firmware in both configurations; memory use and checksums |
| Android checks and APK | Gradle wrapper validation, Java decoder golden vectors, Android lint, Gradle unit tests, debug APK and reports |
| Publish generated wiki | Runs after every required job passes; updates only mapped pages and navigation; skips unchanged docs and stale main commits |

These are software checks, not a hardware certification. USB enumeration,
actual CAN timing/ACKs, sensor calibration, power protection, and display layout
still need bench/device tests. CI never flashes the Nucleo or sends CAN frames.

## Android SDK setup and Dependabot PRs

The Android job explicitly runs SHA-pinned `android-actions/setup-android`
before `sdkmanager`. This installs/configures command-line tools and places
`sdkmanager` on PATH rather than assuming the hosted runner exposes it.
The following step installs `platforms;android-36` and `build-tools;35.0.0`.
SDK setup runs for PRs too and does not require signing or wiki secrets.

If an older run fails with **`sdkmanager: command not found`**, ensure the
branch includes the SDK setup fix. After merging the fix into `main`, update
or rebase the Dependabot PR branch and run its checks again. Merely rerunning
the old failing commit does not add the missing workflow step. The fix was
validated locally; a hosted success must be checked in Actions.

## Download a build

Open the repository's **Actions** tab, select a completed run for the desired
commit, and scroll to **Artifacts**. Download and unzip:

- `android-debug-<commit>`: installable APK and SHA-256 checksum.
- `firmware-Debug-<commit>` / `firmware-Release-<commit>`: ELF, HEX, BIN,
  linker memory map, and checksums.
- `android-reports-<commit>`: lint and any Gradle test reports, including on failure.
- `wiki-preview-<commit>`: generated Markdown pages for review.

Artifacts expire after 14 days to limit storage use. Save builds you want to
keep. Overlapping runs for the same branch cancel older runs. Build dependencies
are cached, and Actions are pinned to commit hashes.

## Android signing for repeated phone updates

The APK is a debug/test build, not a Play Store release. A fresh hosted runner
normally generates a fresh debug signing key. Android cannot install it over
an app signed by a different key; uninstalling the old app also removes its
private logs, so export logs first.

For consistent signatures on builds from `main`, optionally add the repository
Actions secret `ANDROID_DEBUG_KEYSTORE_BASE64`, containing a base64-encoded
**debug keystore**. Use the same debug keystore as the local build if you want
to update that installation. Keep its standard alias `androiddebugkey` and
standard debug passwords `android`. Do not use a production signing key.
The secret is used only on `main`, never for pull requests. Local build tools
may place the key in the user's `.android` directory or a configured Android
user directory; confirm the path with Android Studio's signing report.

The workflow does not create or upload a signing key for you. Store secrets
under **Settings → Secrets and variables → Actions**, never in tracked files.

## Wiki publishing

The wiki is generated from the repository documentation, including the Android
guide and this page. It does not invent or rewrite technical instructions.
The publishing job uses the same-repository `GITHUB_TOKEN` with `contents: write`.
If repository policy requires a different credential, add an Actions secret
named `WIKI_TOKEN` with access to this repository's wiki; it takes precedence.

The wiki must be enabled and have at least one page saved on GitHub before its
Git backend can be cloned. Both were present when this workflow was prepared.
Publishing failures remain visible as failed jobs; the downloadable wiki preview
is still available. See [Wiki publishing](wiki-publishing.md) for manual export.

## Routine maintenance

[Dependabot configuration](../.github/dependabot.yml) proposes grouped weekly
updates to Actions, Python dependencies, and the Android Gradle plugin. It opens
pull requests; it does not merge them. Gradle wrapper/toolchain upgrades may
need to be coordinated with Android SDK versions. The workflow-linter version
and checksum in [check-workflows.sh](../tools/ci/check-workflows.sh) are maintained
manually.

[EditorConfig](../.editorconfig) and [Git attributes](../.gitattributes) provide
consistent whitespace and Windows/Linux line endings for future edits. Checks
report likely errors without automatically reformatting or committing code.
Android lint reports warnings, but errors fail the build. Physical tests remain
necessary before trusting a new build in the van.

## Run equivalent checks locally

```sh
python -m pip install -r requirements.txt -r requirements-ci.txt
python -m ruff check --select E9,F63,F7,F82 tools tests
python -m unittest discover -s tests -v
node --check tools/dashboard/app.js
node tests/test_dashboard.js
python tools/export_wiki.py --output .cache/wiki-preview
cmake --preset Debug
cmake --build --preset Debug
cmake --preset Release
cmake --build --preset Release
```

In `android-app`, use JDK 21 and run `gradlew.bat :app:lintDebug
:app:testDebugUnitTest :app:assembleDebug` on Windows, or the same tasks with
`bash gradlew` on Linux. The firmware commands require the Arm toolchain and
initialized STM32 submodules described in [Firmware](firmware.md).
