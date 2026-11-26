#!/bin/sh
# Compiles VideoWriter.swift with its check for macOS and runs it.
set -e
cd "$(dirname "$0")/.."
out="${TMPDIR:-/tmp}/rollo-video-check"
xcrun swiftc -O -suppress-warnings -o "$out" ios/VideoWriter.swift check/main.swift
"$out"
