#!/bin/sh
# macOS / Linux: double-click this file (macOS) or run ./start.command in a terminal.
# The first time on macOS you may need to right-click it and choose Open.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 serve.py; fi
if command -v python >/dev/null 2>&1; then exec python serve.py; fi
echo "Python 3 was not found. Install it from https://www.python.org/downloads/ and run this file again."
read -r _
