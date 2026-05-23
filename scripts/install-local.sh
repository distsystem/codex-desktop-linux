#!/usr/bin/env bash
# Build and install the PKGBUILD locally from the current HEAD.
#
# End-to-end build + install + launch check for the dev loop: lets you verify
# a working-tree commit (even one not yet pushed to origin) before running
# release-to-aur.sh.
#
# Mirrors what ci.yml does: stages PKGBUILD into a tmpdir and rewrites the git
# source to git+file://<this repo> so makepkg builds from this checkout, not
# whatever origin/main points at. The pinned versioned zip is reused from
# /nix/store if present (sha matches PKGBUILD), otherwise makepkg downloads it.
#
# Run in a plain shell, not `nix develop` — install.sh's cargo / electron-
# rebuild step would otherwise link against /nix/store toolchain, producing a
# package that's not portable off this machine.

set -euo pipefail
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

if ! git diff --quiet -- \
        packaging/linux/PKGBUILD packaging/linux/codex-desktop-linux.install; then
    echo "warning: uncommitted PKGBUILD/install changes - git+file:// clones HEAD," >&2
    echo "         not your working tree. Commit first if you need them included." >&2
fi

PKG=codex-desktop-linux
appver=$(grep -m1 '^_appver=' packaging/linux/PKGBUILD | sed 's/_appver=//')

# Don't auto-delete: the .pkg.tar.zst takes ~10 min to rebuild, leave it
# recoverable if the final pacman -U trips (sudo expired, etc.). Cleaned only
# after a successful install below.
tmp=$(mktemp -d -t codex-pkgbuild-XXXX)

cp packaging/linux/PKGBUILD          "$tmp/PKGBUILD"
cp "packaging/linux/${PKG}.install"  "$tmp/${PKG}.install"

# Build from this checkout, not origin/main - same trick as ci.yml.
sed -i "s|git+https://github.com/distsystem/codex-desktop-linux\.git#branch=main|git+file://${REPO_ROOT}|" "$tmp/PKGBUILD"

# Reuse the pinned zip from nix store if present (sha matches PKGBUILD's pin);
# otherwise makepkg downloads it. Saves 330MB on the dev loop.
zip_in_store=$(find /nix/store -maxdepth 1 -name "*-Codex-darwin-arm64-${appver}.zip" 2>/dev/null | head -1)
if [ -n "$zip_in_store" ]; then
    cp "$zip_in_store" "$tmp/Codex-${appver}.zip"
    echo "[install-local] reusing nix store zip: $zip_in_store"
fi

cd "$tmp"
# makepkg -s (build only, no install), then sudo pacman -U separately: sudo is
# needed for ~10 seconds at the end, not held across the ~10-min build, so the
# timestamp cache doesn't have to last that long.
makepkg -s --noconfirm
pkg=$(find . -maxdepth 1 -name "${PKG}-*.pkg.tar.zst" -print -quit)
[ -n "$pkg" ] || { echo "[install-local] no .pkg.tar.zst produced" >&2; exit 1; }
echo "[install-local] built: $tmp/${pkg#./}"

sudo pacman -U --noconfirm "$pkg"
echo "[install-local] installed: $(pacman -Qi $PKG | awk -F': *' '/^版本|^Version/ {print $2}')"
rm -rf "$tmp"
