#!/usr/bin/env bash
# Print the Homebrew formula for a released version. The sha256 values are
# read from a checksums.txt (dist/checksums.txt after build-release.sh, or
# the file attached to the GitHub release) so they are never typed by hand.
# The output replaces Formula/omnifocus-cli.rb in maxboettinger/homebrew-tap.
#
# usage: scripts/homebrew-formula.sh <version> <checksums.txt>
set -euo pipefail
version="${1:?version, e.g. 0.1.0}"
checksums="${2:?path to checksums.txt}"

sha() { awk -v file="$1" '$2 == file { print $1 }' "${checksums}"; }
arm="$(sha of-darwin-arm64.tar.gz)"
x64="$(sha of-darwin-x64.tar.gz)"
if [ -z "${arm}" ] || [ -z "${x64}" ]; then
	echo "missing of-darwin-arm64/x64 checksum in ${checksums}" >&2
	exit 1
fi
base="https://github.com/maxboettinger/omnifocus-cli/releases/download/v${version}"

cat <<FORMULA
class OmnifocusCli < Formula
  desc "Command-line interface for OmniFocus"
  homepage "https://github.com/maxboettinger/omnifocus-cli"
  license "MIT"

  depends_on :macos

  if Hardware::CPU.arm?
    url "${base}/of-darwin-arm64.tar.gz"
    sha256 "${arm}"
  else
    url "${base}/of-darwin-x64.tar.gz"
    sha256 "${x64}"
  end

  def install
    bin.install "of"
    generate_completions_from_executable(bin/"of", "completion")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/of --version")
  end
end
FORMULA
