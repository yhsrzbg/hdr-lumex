#!/bin/bash
# Launcher for Linux. Run from a terminal, or double-click if your file manager
# is configured to run executable text files (choose "Run in Terminal").
cd "$(dirname "$0")" || exit 1
./HDR-Video-Analyzer
