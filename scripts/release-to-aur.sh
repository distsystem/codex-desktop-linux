#!/usr/bin/env bash
# Publish packaging/linux/PKGBUILD to the AUR (codex-desktop-linux).
#
# Stateless: fresh-clones the AUR remote, overlays PKGBUILD + install file,
# regenerates .SRCINFO, then commits & pushes if anything changed.
# .gitignore is rewritten inline (makepkg artifacts + pinned arm64 zip).
#
# Prereqs:
#   - clean working tree (the AUR commit message references HEAD).
#   - SSH key registered with AUR (test: ssh aur@aur.archlinux.org help).
#   - makepkg available locally for --printsrcinfo.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

PKG=codex-desktop-linux
AUR_REMOTE="ssh://aur@aur.archlinux.org/${PKG}.git"
PKG_SRC="$REPO_ROOT/packaging/linux"

if ! git diff --quiet -- \
        "packaging/linux/PKGBUILD" "packaging/linux/${PKG}.install"; then
    echo "error: uncommitted PKGBUILD/install changes - commit first" >&2
    exit 1
fi

head_sha=$(git rev-parse --short HEAD)
head_msg=$(git log -1 --format=%s)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "==> cloning $AUR_REMOTE"
git clone --quiet "$AUR_REMOTE" "$tmp"

# Drop AUR's previously tracked files; we re-overlay from project below.
( cd "$tmp" && git ls-files -z | xargs -0 -r rm -f )

install -m 644 "$PKG_SRC/PKGBUILD"        "$tmp/PKGBUILD"
install -m 644 "$PKG_SRC/${PKG}.install"  "$tmp/${PKG}.install"

cat > "$tmp/.gitignore" <<'EOF'
# makepkg build artifacts
pkg/
src/
*.pkg.tar.zst
*.pkg.tar.xz

# downloaded macOS app payload (pinned arm64 zip)
Codex-*.zip

# makepkg VCS source mirror (bare clone the git+ source caches next to PKGBUILD)
/codex-desktop-linux/
EOF

cd "$tmp"
makepkg --printsrcinfo > .SRCINFO

git add -A
if git diff --cached --quiet; then
    echo "AUR already in sync with project ${head_sha} - nothing to push"
    exit 0
fi

git -c "user.name=$(git -C "$REPO_ROOT" config user.name)" \
    -c "user.email=$(git -C "$REPO_ROOT" config user.email)" \
    commit -m "release ${head_sha}: ${head_msg}"

git push origin HEAD:master
echo "==> pushed $PKG -> AUR @ ${head_sha}"
