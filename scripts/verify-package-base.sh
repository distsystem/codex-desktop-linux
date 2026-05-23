#!/usr/bin/env bash
# Lightweight patch-drift check for the current PKGBUILD/flake base.
#
# Runs install.sh --inspect (asar extract + JS patcher writing a report; no
# native/rust/electron build) against the official Linux package pinned in
# nix/upstream-linux-packages.json, then gates on validate-patch-report.js
# (required-upstream patches that must apply for a sound package).
#
# Fast (~30s) local feedback for patch drift before invoking makepkg's full
# ~10-minute build. Deps: node, dpkg-deb, npx (asar), curl, git. Run inside
# `nix develop` or with those installed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pins=nix/upstream-linux-packages.json
version="$(node -p "require('./$pins').version")"
[ -n "$version" ] || { echo "could not read version from $pins" >&2; exit 1; }

cache="/tmp/codex-package-verify"
report_dir="$cache/report-${version}"
mkdir -p "$cache"

# Prefer the package already fetched into the nix store by `nix build`;
# otherwise download it (resumable + hash-checked against the pin, so a
# network-truncated file is never reused as if complete).
expected_hash="$(node -p "require('./$pins').amd64.sri")"
deb_name="chatgpt_${version}_amd64.deb"
deb="$(find /nix/store -maxdepth 1 -name "*-${deb_name}" 2>/dev/null | head -1)"
if [ -z "$deb" ]; then
    deb="$cache/$deb_name"
    if [ "$(nix hash file --sri --type sha256 "$deb" 2>/dev/null || true)" != "$expected_hash" ]; then
        echo "[verify] downloading official Linux package ${version} (resumable)"
        curl -fL --retry 5 --retry-all-errors --retry-delay 3 -C - -o "$deb" \
            "https://persistent.oaistatic.com/codex-app-prod/linux/deb/$(node -p "require('./$pins').amd64.repositoryPath")"
        if [ "$(nix hash file --sri --type sha256 "$deb" 2>/dev/null || true)" != "$expected_hash" ]; then
            echo "[verify] downloaded package incomplete/corrupt (hash mismatch); removed" >&2
            rm -f "$deb"; exit 1
        fi
    fi
fi
echo "[verify] using payload package: $deb"

echo "[verify] inspecting patch coverage on ${version} (no native/rust build)"
./install.sh --inspect --report-dir "$report_dir" "$deb" 2>&1 | tee "$cache/inspect.log"
report="$report_dir/patch-report.json"
[ -s "$report" ] || { echo "[verify] no patch report at $report" >&2; exit 1; }

echo "[verify] validating required-upstream patches"
if node scripts/ci/validate-patch-report.js "$report" --profile upstream-build; then
    echo "[verify] GOOD: ${version} @ $(git rev-parse --short HEAD)"
else
    echo "[verify] FAILED: required-upstream patches drifted on ${version}" >&2
    exit 1
fi
