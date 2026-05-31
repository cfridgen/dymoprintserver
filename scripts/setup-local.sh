#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 fehlt. Bitte installieren und erneut ausfuehren."
  exit 1
fi

if ! command -v pip3 >/dev/null 2>&1; then
  echo "pip3 fehlt. Bitte installieren und erneut ausfuehren."
  exit 1
fi

python3 -m venv .venv
.venv/bin/pip install --upgrade pip >/dev/null
.venv/bin/pip install dymoprint Pillow qrcode pdf417gen pystrich

# dymoprint 2.5.0 zeigt Deprecation-Warnungen; 2.3.0 ist fuer den lokalen Flow stabil.
.venv/bin/pip install --upgrade --force-reinstall dymoprint==2.3.0
.venv/bin/pip install --force-reinstall 'Pillow<11,>=10.4.0'

echo "Lokales dymoprint ist bereit unter .venv/bin/dymoprint"
