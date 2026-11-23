#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-$(cd "$PROJECT_DIR/.." && pwd)}"

mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/material"
cp "$SOURCE_DIR/Chicken LessFille Solo.txt" "$PROJECT_DIR/data/Chicken LessFille Solo.txt"
cp "$SOURCE_DIR/lessfilemenu.txt" "$PROJECT_DIR/data/lessfilemenu.txt"
cp "$SOURCE_DIR/material"/*.webp "$PROJECT_DIR/material/"

echo "Synced source files and menu images from $SOURCE_DIR to $PROJECT_DIR"
