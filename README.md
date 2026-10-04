# Notchly website

Static marketing site for Notchly. There's no build step and no framework: plain HTML, CSS and JS, plus Lottie for the mascots.

## Run it

Double-click `index.html`, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Every "Download" button links to `downloads/Notchly.dmg`.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page. The notch's panes live in the `<template id="notch-panes">` at the bottom. |
| `styles.css` | All styling. Notch sizes per state are under "The notch" and mirror `NotchViewModel.width/height` in the app. |
| `main.js` | Hero intro, hover, scroll story, reveal-on-scroll, and Lottie play/pause. |
| `assets/lottie/*.json` | Animations copied from `Notchly/Resources/`. |
| `assets/lottie-data.js` | The animations bundled into one script. It's generated; don't edit it by hand. |
| `assets/sounds/*.m4a` | The app's mascot sounds, converted from WAV to AAC to keep them small. They only play when a visitor clicks something. |
| `assets/vendor/lottie.min.js` | lottie-web 5.12.2, vendored so the page works offline. |
| `downloads/Notchly.dmg` | The app download. |

## Common tasks

**Add or replace an animation:** put the `.json` in `assets/lottie/`, then run:

```sh
python3 build-lottie-data.py
```

Reference it from any element with `data-lottie="<file name without .json>"`. These attributes are optional:
- `data-loop="false"` plays it once.
- `data-speed="1.5"` changes the playback speed.
- `data-replay="2600"` re-runs a one-shot animation every 2.6 s while it's on screen.

**Refresh animations and sounds from the app** after it gains new ones:

```sh
R=~/Desktop/Notchly/Notchly/Resources
find "$R" -name "*.json" -exec cp {} assets/lottie/ \;
for f in $(find "$R" -name "*.wav"); do afconvert -f m4af -d aac -b 64000 "$f" "assets/sounds/$(basename "${f%.wav}").m4a"; done
python3 build-lottie-data.py
```

**Rebuild the DMG** after changing the app:

```sh
./build-dmg.sh                                  # uses ~/Desktop/Notchly
NOTCHLY_PROJECT=/path/to/Notchly ./build-dmg.sh
```

The DMG is not notarized, so on other Macs Gatekeeper warns the first time it's opened (right-click → Open). The current build is arm64 only, so the site says "Apple silicon". Update the fine print if you ship a universal build.

**Add a scroll-story step:**
1. Add a `.story-caption` with a `data-state` in `index.html`.
2. Add the matching `.pane` to the template.
3. Add a size rule in `styles.css` (`.notch[data-state="…"]`) and include the state in the pane-visibility selector list.
4. Add a dot in `.story-progress`, and raise `.story { height }` by 100vh.
