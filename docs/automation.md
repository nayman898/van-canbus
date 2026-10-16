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
| ESP32 logger | Pinned Espressif 3.3.6 core build for classic ESP32; ignition sequencing, log encoding and filename checks run in the host job |
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
the old failing commit does not add the missing workflow step. The Android
job succeeded in [October 16 run 38904599132](https://github.com/nayman898/van-canbus/actions/runs/38904599132).

## Workflow lint failure and current fix

That run also built the STM32 Debug/Release images and ESP32 firmware and
passed the application tests, but the host job failed **Validate workflow
syntax and expressions**. ShellCheck SC2035 flagged unprotected globs in
`sha256sum *.bin *.elf`. The workflow now uses `sha256sum -- *.bin *.elf`;
actionlint passes locally with ShellCheck enabled. The wiki job was skipped
because its required host job failed. The subsequent
[run 38910515542](https://github.com/nayman898/van-canbus/actions/runs/38910515542)
at commit `69a9859` passed **every job**, including workflow validation and
the wiki publishing job. Rerunning the earlier commit alone does not apply
the fix; use a source revision containing it.

## Download a build

Open the repository's **Actions** tab, select a completed run for the desired
commit, and scroll to **Artifacts**. Download and unzip:

- `android-debug-<commit>`: installable APK and SHA-256 checksum.
- `esp32-logger-<commit>`: classic ESP32 firmware binaries, ELF and checksums;
  flashing instructions are in the [logger guide](esp32-logger.md).
- `firmware-Debug-<commit>` / `firmware-Release-<commit>`: ELF, HEX, BIN,
  linker memory map, and checksums.
- `android-reports-<commit>`: lint and any Gradle test reports, including on failure.
- `wiki-preview-<commit>`: generated Markdown pages for review.

Downloading artifacts may require signing in to GitHub. Use the intended
commit and verify the job that produced the artifact succeeded; other jobs
can fail without invalidating an already completed build. See
[Getting started](getting-started.md#3-get-the-software) for which image to use.

Compare a downloaded file with its SHA256SUMS entry before programming it.
In PowerShell, from the extracted STM32 artifact folder, run
`Get-FileHash .\van-canbus.hex -Algorithm SHA256`; use `app-debug.apk` for
an Android artifact, or the matching `.bin` filename for an ESP32 artifact.
With a SHA-256 utility in Bash, `sha256sum --check SHA256SUMS` verifies all
listed files from the artifact folder.

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

Use a Python environment with the monitor requirements installed, Node.js 22
and, for the Bash checks, a host C/C++ compiler and **ShellCheck**. Install
ShellCheck before actionlint so embedded shell scripts are checked too;
actionlint can otherwise skip those checks. These are developer checks, not
prerequisites for opening an already flashed dashboard.

```sh
python -m pip install -r requirements.txt -r requirements-ci.txt
python -m ruff check --select E9,F63,F7,F82 tools tests
python -m unittest discover -s tests -v
node --check tools/dashboard/app.js
node tests/test_dashboard.js
node tests/test_logger_web.js
python tools/export_wiki.py --output .cache/wiki-preview
```

From Bash on Linux/WSL, run the same native host checks as CI:

```sh
mkdir -p .cache/ci
cc -std=c11 -Wall -Wextra -Werror -I Inc Src/can_protocol.c tests/test_can_protocol.c -o .cache/ci/test_can_protocol
.cache/ci/test_can_protocol
g++ -std=c++17 -Wall -Wextra -Werror tests/test_logger_format.cpp -o .cache/ci/test_logger_format
.cache/ci/test_logger_format
g++ -std=c++17 -Wall -Wextra -Werror tests/test_logger_live.cpp -o .cache/ci/test_logger_live
.cache/ci/test_logger_live
bash tools/ci/check-workflows.sh
```

Build the STM32 separately once its toolchain/submodules are installed:

```sh
cmake --preset Debug
cmake --build --preset Debug
cmake --preset Release
cmake --build --preset Release
```

In `android-app`, use JDK 21 and run `gradlew.bat :app:lintDebug
:app:testDebugUnitTest :app:assembleDebug` on Windows, or the same tasks with
`bash gradlew` on Linux. The firmware commands require the Arm toolchain and
initialized STM32 submodules described in [Firmware](firmware.md).
For the separate Arduino core and ESP32 build/upload commands, follow
[ESP32 Build and flash](esp32-logger.md#build-and-flash).
