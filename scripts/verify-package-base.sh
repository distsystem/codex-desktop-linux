#!/usr/bin/env bash
# Lightweight patch-drift check for the current PKGBUILD/flake base.
#
# Runs install.sh --inspect (asar extract + JS patcher writing a report; no
# native/rust/electron build) against the versioned arm64 zip pinned in
# flake.nix, then gates on validate-patch-report.js (required-upstream
# patches that must apply for a sound package).
#
# Fast (~30s) local feedback for patch drift before invoking makepkg's full
# ~10-minute build. Deps: node, 7zz, npx (asar), curl, git. Run inside
# `nix develop` or with those installed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

version="$(grep -m1 'codexVersion = ' flake.nix | sed 's/.*"\(.*\)".*/\1/')"
[ -n "$version" ] || { echo "could not read codexVersion from flake.nix" >&2; exit 1; }

cache="/tmp/codex-package-verify"
report_dir="$cache/report-${version}"
mkdir -p "$cache"

# Prefer the versioned zip already fetched into the nix store by `nix build`;
# otherwise download it (resumable + hash-checked against flake.nix's pin, so a
# network-truncated file is never reused as if complete).
expected_hash="$(grep -A2 'codexDmg = pkgs.fetchurl' flake.nix | grep -oE 'sha256-[A-Za-z0-9+/=]+')"
zip="$(find /nix/store -maxdepth 1 -name "*-Codex-darwin-arm64-${version}.zip" 2>/dev/null | head -1)"
if [ -z "$zip" ]; then
    zip="$cache/Codex-darwin-arm64-${version}.zip"
    if [ "$(nix hash file --sri --type sha256 "$zip" 2>/dev/null || true)" != "$expected_hash" ]; then
        echo "[verify] downloading versioned zip ${version} (resumable)"
        curl -fL --retry 5 --retry-all-errors --retry-delay 3 -C - -o "$zip" \
            "https://persistent.oaistatic.com/codex-app-prod/Codex-darwin-arm64-${version}.zip"
        if [ "$(nix hash file --sri --type sha256 "$zip" 2>/dev/null || true)" != "$expected_hash" ]; then
            echo "[verify] downloaded zip incomplete/corrupt (hash mismatch); removed" >&2
            rm -f "$zip"; exit 1
        fi
    fi
fi
echo "[verify] using payload zip: $zip"

echo "[verify] inspecting patch coverage on ${version} (no native/rust build)"
./install.sh --inspect --report-dir "$report_dir" "$zip" 2>&1 | tee "$cache/inspect.log"
report="$(grep -oE 'Patch report: .*' "$cache/inspect.log" | sed 's/.*Patch report: //' | tail -1)"
[ -s "$report" ] || { echo "[verify] no patch report produced" >&2; exit 1; }

echo "[verify] validating required-upstream patches"
if node scripts/ci/validate-patch-report.js "$report" --profile upstream-build; then
    echo "[verify] GOOD: ${version} @ $(git rev-parse --short HEAD)"
else
    echo "[verify] FAILED: required-upstream patches drifted on ${version}" >&2
    exit 1
fi
