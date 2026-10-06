#!/usr/bin/env bash
set -euo pipefail

# Official release with a fixed checksum; do not execute an unverified download.
lint_dir="$(mktemp -d)"
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz \
  --output "$lint_dir/actionlint.tar.gz"
printf '023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757  %s\n' \
  "$lint_dir/actionlint.tar.gz" | sha256sum --check
tar -xzf "$lint_dir/actionlint.tar.gz" -C "$lint_dir" actionlint
"$lint_dir/actionlint" -color
