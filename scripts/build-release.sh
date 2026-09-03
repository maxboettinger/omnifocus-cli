#!/usr/bin/env bash
# Build the standalone `of` binaries for both Mac architectures into dist/
# and package them exactly as the GitHub release and the Homebrew formula
# consume them: of-darwin-{arm64,x64}.tar.gz plus checksums.txt.
# Used by .github/workflows/release.yml and runnable locally.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
for target in arm64 x64; do
	bun build --compile --target="bun-darwin-${target}" src/index.ts --outfile "dist/${target}/of"
	tar -C "dist/${target}" -czf "dist/of-darwin-${target}.tar.gz" of
done
(cd dist && shasum -a 256 of-darwin-arm64.tar.gz of-darwin-x64.tar.gz > checksums.txt)
cat dist/checksums.txt
