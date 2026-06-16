#!/bin/bash
# Double-clickable launcher for macOS. Opens in Terminal and runs the analyzer
# from its own directory.
cd "$(dirname "$0")" || exit 1
./HDR-Video-Analyzer
