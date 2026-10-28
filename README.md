# Copito: snowball demo

A small WebXR scene (A-Frame 1.7.0, no build step) of a snowman named Copito
standing in a snowy field, built for Meta Quest 2 and desktop Chrome. Learning
project — see `PROGRESS.md` for the full build log, what's done, and what's
next.

**Current status:** scene setup is done (vendored A-Frame, photo sky, matched
ground, Copito's model placed and lit). Gameplay (throwing snowballs, hit
reactions, explosion, sound, HUD) is not built yet — see `PROGRESS.md` for
the step-by-step plan. This README will grow with controls and `CONFIG`
tuning notes as those steps land.

## Run it on desktop (Chrome)

```bash
cd ~/Documents/Code/GitHub/hello-quest-dev
python3 -m http.server 8080
```

Open `http://localhost:8080`. On desktop, move the mouse to look around,
use W/S or Up/Down to move forward/back, and use Left/Right or A/D to turn.

## Run it on Meta Quest 2 (over USB)

```bash
adb devices                       # headset should show as "device"
adb reverse tcp:8080 tcp:8080
```

Then in the Quest browser, open `http://localhost:8080` (this exact
hostname — `localhost` counts as a secure origin for WebXR, a plain IP
address does not) and press **Enter VR**.

Debug: Chrome on Linux, `chrome://inspect/#devices`, inspect the Quest tab
for console errors and FPS.

## Tuning

All tunable numbers (sizes, speeds, colors, timing) live in the `CONFIG`
object near the top of `index.html`'s script block. All visible text (once
the HUD exists) will live in the `I18N` object right after it.

## Credits

Copito's 3D model: "Snowman" by [alixor22](https://sketchfab.com/alixor22),
licensed [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). See
`ASSETS.md` for this and every other asset's source and license.

## History

This repo originally held a simpler A-Frame test page (a clickable
color-cycling cube). That version is preserved as git tag `cube-demo-v1`;
everything from here on is the snowman demo.
