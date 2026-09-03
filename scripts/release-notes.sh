#!/usr/bin/env bash
# Assemble the GitHub release body for a version: the matching CHANGELOG.md
# section, followed by install instructions and the archive checksums.
#
# usage: scripts/release-notes.sh <version> <checksums.txt>
set -euo pipefail
cd "$(dirname "$0")/.."
version="${1:?version, e.g. 0.1.0}"
checksums="${2:?path to checksums.txt}"

section="$(awk -v v="${version}" '
	$0 ~ "^## \\[" v "\\]" { on = 1; next }
	on && /^## \[/ { exit }
	on { print }
' CHANGELOG.md)"
if [ -z "$(printf '%s' "${section}" | tr -d '[:space:]')" ]; then
	echo "CHANGELOG.md has no '## [${version}]' section" >&2
	exit 1
fi

cat <<NOTES
${section}

## Install

\`\`\`bash
brew install maxboettinger/tap/omnifocus-cli
\`\`\`

Or download a prebuilt binary (Apple Silicon shown; use \`of-darwin-x64.tar.gz\` on Intel):

\`\`\`bash
curl -fsSL https://github.com/maxboettinger/omnifocus-cli/releases/download/v${version}/of-darwin-arm64.tar.gz | tar -xz
xattr -d com.apple.quarantine of
mv of ~/.local/bin/
\`\`\`

## Checksums (SHA-256)

\`\`\`
$(cat "${checksums}")
\`\`\`

**Full changelog:** [CHANGELOG.md](https://github.com/maxboettinger/omnifocus-cli/blob/v${version}/CHANGELOG.md)
NOTES
