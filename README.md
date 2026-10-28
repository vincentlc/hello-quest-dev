# Copito: snowball demo

A small WebXR scene (A-Frame 1.7.0, no build step) of a snowman named Copito
standing in a snowy field, built for Meta Quest 2 and desktop Chrome. Learning
project — see `PROGRESS.md` for the full build log, what's done, and what's
next.

**Current status:** core gameplay is implemented: snowball throwing, hit
reactions, explosions, waves, and HUD. Snowman toughness is signaled by
bright hat colors with the required hit count painted directly onto each
hat; type 7 is twice the normal size. Tougher snowmen can also appear in the
fog, and kills show their point award above the snowman. Sound and the
remaining planned steps are tracked in `PROGRESS.md`.

## Run it on desktop (Chrome)

```bash
cd ~/Documents/Code/GitHub/hello-quest-dev
python3 -m http.server 8080
```

Open `http://localhost:8080`. The game can be played with mouse/keyboard;
the same scene also supports Quest controllers in VR.

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

Tunable values live in `js/config.js`; visible text lives in `js/i18n.js`.
Each snowman type uses a bright hat and a white hit-count number painted
upright and mirror-corrected on the front of the hat, twice its previous
size; the original source texture remains unchanged. Type 7 is scaled to
2x. Type-5/7 snowmen have a 60% chance of spawning in the outer fog band.
Three throws start a run; five throws restart after the credits screen.

## Credits

Copito's 3D model: "Snowman" by [alixor22](https://sketchfab.com/alixor22),
licensed [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). See
`ASSETS.md` for this and every other asset's source and license.

## History

This repo originally held a simpler A-Frame test page (a clickable
color-cycling cube). That version is preserved as git tag `cube-demo-v1`;
everything from here on is the snowman demo.
