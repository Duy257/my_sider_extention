#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 {patch|minor|major|<semver>}"
  echo "  patch  — bump x.y.Z (default)"
  echo "  minor  — bump x.Y.0"
  echo "  major  — bump X.0.0"
  echo "  0.2.0  — explicit version"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

ARG=$1
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_FILE="$ROOT_DIR/package.json"

# Read current version
CURRENT_VERSION=$(node -p "require('$PKG_FILE').version")

if [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$ARG"
else
  IFS='.' read -ra PARTS <<< "$CURRENT_VERSION"
  MAJOR="${PARTS[0]}"
  MINOR="${PARTS[1]}"
  PATCH="${PARTS[2]}"

  case "$ARG" in
    patch)
      PATCH=$((PATCH + 1))
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    *)
      usage
      ;;
  esac

  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

# Update package.json
node -e "
const pkg = require('$PKG_FILE');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('$PKG_FILE', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit and tag
git add "$PKG_FILE"
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"

echo ""
echo "Version bumped to $NEW_VERSION"
echo "Tag v$NEW_VERSION created"
echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md with the new release"
echo "  2. git push --follow-tags"
