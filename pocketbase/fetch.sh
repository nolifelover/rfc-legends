#!/usr/bin/env bash
# Downloads the pinned PocketBase release for linux/amd64 (macOS: swap the asset name).
set -euo pipefail
cd "$(dirname "$0")"
VERSION=0.40.4
curl -sL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip"
unzip -o -q pb.zip pocketbase && rm pb.zip
./pocketbase --version
