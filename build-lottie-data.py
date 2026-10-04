#!/usr/bin/env python3
"""Bundles assets/lottie/*.json into assets/lottie-data.js.

Browsers refuse fetch() on file:// URLs, so the animations ship as one
script that sets window.NOTCHLY_LOTTIE; index.html then works when opened
straight from Finder. Re-run after adding or replacing a .json file.

Only animations whose name appears in index.html or main.js are bundled,
so assets/lottie/ can hold the app's full set without bloating the page.
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).parent
source = (root / "index.html").read_text() + (root / "main.js").read_text()
used = set(re.findall(r"[A-Za-z0-9_]+", source))

data, skipped = {}, []
for path in sorted((root / "assets/lottie").glob("*.json")):
    if path.stem in used:
        data[path.stem] = json.loads(path.read_text())
    else:
        skipped.append(path.stem)

out = root / "assets/lottie-data.js"
out.write_text("window.NOTCHLY_LOTTIE = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(f"Wrote {out.name}: {len(data)} animations, {out.stat().st_size // 1024} KB")
if skipped:
    print(f"Not referenced, left out ({len(skipped)}): {', '.join(skipped)}")
