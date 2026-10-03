#!/usr/bin/env python3
"""Bundles assets/lottie/*.json into assets/lottie-data.js.

Browsers refuse fetch() on file:// URLs, so the animations ship as one
script that sets window.NOTCHLY_LOTTIE; index.html then works when opened
straight from Finder. Re-run after adding or replacing a .json file.
"""
import json
import pathlib

root = pathlib.Path(__file__).parent
data = {p.stem: json.loads(p.read_text()) for p in sorted((root / "assets/lottie").glob("*.json"))}
out = root / "assets/lottie-data.js"
out.write_text("window.NOTCHLY_LOTTIE = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(f"Wrote {out.name}: {len(data)} animations, {out.stat().st_size // 1024} KB")
