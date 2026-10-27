# Progress: snowman_demo

Updated 2026-10-27. Read this file first in any new session working on this
project — it has everything learned so far that isn't obvious from the code,
so you don't need to re-derive it (and re-spend tokens doing so).

Original spec: `~/Documents/Claude_folder/Meta_quest_coaniquem/02_plans/snowman_demo_prompt.md`
(the full work order — lives outside this repo, in Vincent's planning
folder, not duplicated here). This file tracks what changed from it, what's
done, and what's next.

**This repo (`hello-quest-dev`) is now the snowman demo itself**, not just a
build output. It started as a separate, simpler A-Frame "cube" test page
(laser pointers, click-to-cycle-color cube); that original version is
preserved as git tag `cube-demo-v1` and is **not** being developed further —
everything going forward is the snowman demo. The project was built in
`~/Documents/Claude_folder/Meta_quest_coaniquem/04_prototypes/snowman_demo/`
first (steps 1 and the ground/sky iteration happened there) and moved into
this repo's root afterward so it'd be under git. That source folder no
longer exists (emptied by the move); if any note below still mentions it by
path, read it as historical, not current.

## Lessons learned (read before repeating a mistake)

General patterns that caused real back-and-forth during this build. Check
these *first* when something looks visually wrong, before guessing at new
numbers:

1. **Flat (unlit) vs standard (lit) shader mismatch is the recurring bug
   class in this project.** `<a-sky>` uses `shader: flat` (shows the photo
   at its raw brightness, no lighting applied). Anything meant to visually
   continue that photo (the ground) needs to match — `standard` shader
   multiplies a texture by the scene lights, and lights tuned for general
   use will almost never match a specific photo's baked-in sun exposure. Two
   separate bugs in this build traced back to exactly this mismatch: (a) sky
   getting fully fogged out because its material defaults to `fog: true`
   like everything else, (b) the ground rendering darker than the sky
   because it used `standard` while the sky used `flat`. **When something's
   brightness or fog behavior looks wrong, check which shader it's on and
   whether it matches its visual neighbors before touching colors or
   numbers.**
2. **Don't trust a schema property exists from memory — grep the vendored
   source.** `emissive`/`emissiveIntensity` exist on the `standard` shader
   schema but not on `flat`; `fog` exists on both. Confirmed by searching
   `vendor/aframe.min.js` for `iC("standard",{schema:{...` /
   `iC("flat",{schema:{...` rather than guessing. Do this for any other
   shader/component property question that comes up later.
3. **Never guess a hex color for matching against a photo — sample it.**
   Every hand-guessed color used in this build (ground base color, fog
   color, twice) was visibly wrong on the first try. Use Python
   (PIL `Image.crop().getdata()` averaged, or similar) to sample the actual
   pixels from the relevant region of the source image instead, every time.
4. **A fade-based "hide the edge" trick needs real margin, not exact math.**
   Fog correctly reaches 100% blend exactly at its `far` distance, but
   leaving only ~0.1m between `far` and the ground's actual edge still
   looked like a hard border — because what's being hidden is a real photo
   with its own spatial color variation, not a flat color, so pixel-perfect
   math isn't enough. A generous buffer (several meters of "already 100%
   faded" ground before the real edge) hides it far more robustly than
   tight numbers do.
5. **Live `THREE.Box3` / transform measurements in the browser can be stale
   if the tab has prior manual history.** A tab that had earlier camera
   repositioning or live object pokes gave an inconsistent bounding-box
   reading once during this build. Always measure on a freshly opened tab,
   and do identity-reset → measure → compute → apply → re-measure-to-confirm
   as one atomic script, not as separate calls trusting an earlier read.
6. **General web access for Claude's own tools is narrow in this
   environment** (small CDN allowlist only — see "Environment facts" above)
   — don't assume a direct asset URL is fetchable; confirm or go straight to
   asking Vincent to download it himself.
7. **WebXR secure-context nuance:** `localhost` (that exact hostname, not a
   LAN IP) counts as secure over plain HTTP, in both desktop Chrome and the
   Quest browser. Seeing "Access this site over HTTPS..." on desktop with no
   headset attached is expected/harmless (nothing to enter VR into anyway).
   Seeing it *on the Quest* means the URL typed wasn't literally
   `http://localhost:8080`.

## How to continue in a new session

Paste something like: "Continue building the snowman demo in
hello-quest-dev. Read PROGRESS.md first, then do step N." The original work
order (path above) is the full spec; this file is the diff against it plus
the step-by-step status.

## Environment facts (so you don't re-discover these the hard way)

- **This project lives in the `hello-quest-dev` git repo, at its root**
  (`index.html`, `vendor/`, `assets/`, this file, `ASSETS.md`). If Claude
  Code is started elsewhere, `cd` here first. The original planning folder
  (`~/Documents/Claude_folder/Meta_quest_coaniquem/`) still holds the work
  order and the bigger-picture docs (`01_context/`, `02_plans/`, etc.) but no
  longer has a copy of this project's files.
- **The repo has a remote**: `origin` →
  `https://github.com/vincentlc/hello-quest-dev.git`. Nothing has been
  pushed as part of this move — only committed locally. Don't push without
  being asked explicitly.
- **Git tag `cube-demo-v1`** marks the commit just before the snowman demo
  replaced the old cube-click test page at this repo's root — that's how the
  original `index.html` is preserved (`git show cube-demo-v1:index.html` to
  see it, or `git checkout cube-demo-v1` to visit it).
- **General web access is restricted** for both the Bash tool (curl/wget get
  TLS connection resets to arbitrary hosts) and the in-app Browser pane
  (`navigate` is denied for most sites). Confirmed blocked: polyhaven.com,
  dl.polyhaven.org, kenney.nl, freesound.org, aframe.io. Confirmed working:
  `cdn.jsdelivr.net` (used to vendor A-Frame itself), and `npm`'s registry is
  reachable (`npm view <pkg> version` works) even though general web isn't.
  **`WebFetch` and `WebSearch` tools still work** for any site (they return
  text/analysis, not raw bytes) — use them for research/lookups.
- **Practical consequence:** any new binary asset (image, audio, model) from
  a site other than the CDN allowlist needs Vincent to download it himself in
  his own browser and save it under this project folder. Since Claude Code
  and Vincent are on the same machine, no upload/share step is needed —
  just ask him to save to an exact path and it's immediately readable.
- **Local preview server:** `.claude/launch.json` in this repo has a
  `"snowman-demo"` config that runs `python3 -m http.server 8080` right here
  at the repo root. Use the Browser pane's `preview_start` with
  `name: "snowman-demo"` to test, or manually: `python3 -m http.server 8080`
  from this folder.
- **A-Frame gotcha:** the `material` component defaults `fog: true` for
  *every* mesh, including `<a-sky>`. The spec's own note ("sky ignores fog by
  default, check") turned out to be wrong — without an explicit
  `material="fog: false"` on `<a-sky>`, fog washes the whole photo
  background out to a flat color. Already fixed in `index.html`; keep it in
  mind if touching the sky entity.
- **Local tools available:** Python 3 with Pillow and OpenCV (`cv2`) are
  installed — OpenCV reads Radiance `.hdr` natively (not `.exr` without
  extra setup), useful if more HDRIs are needed. No Blender, no FBX
  converters, no `imageio`/`OpenEXR` Python packages.

## Deviations from the original spec (all approved by Vincent)

1. **Copito's body is a CC-BY glTF model, not CC0 hand-built primitives.**
   Vincent provided it (Sketchfab "Snowman" by alixor22). This is now the
   *one* non-CC0 asset — see `ASSETS.md` for the required credit text, which
   is already shown in two places: `ASSETS.md` and a small on-page corner
   div in `index.html` (`#credit`). **Still owed:** an in-scene credit line
   visible inside the headset itself (the on-page div isn't visible once in
   VR) — planned for step 7 (HUD), don't forget it.
   - The model is a **single fused mesh** (Sketchfab's export merges
     everything) — no separate "eye", "crown", "head" sub-parts to animate
     individually. This changes how steps 2 and 4 need to work; see their
     notes below. It also means the original "Copito" ice-crystal/mint
     palette design (crown spikes, glowing nose, etc.) no longer applies —
     the model is a classic top-hat-and-scarf snowman. The internal name
     "Copito" is kept as a project/code nickname only, unrelated to the
     model's own identity.
   - Files: `assets/models/copito/scene.gltf` + `scene.bin` +
     `textures/*` (base color, metallic-roughness, normal — only the 3
     glTF-native textures were copied in, not the separate FBX-only texture
     set that came in the same download).
   - Placement: the raw model has a messy baked-in transform (odd scale,
     off-center pivot, from its Sketchfab/FBX export chain). It's corrected
     with `CONFIG.copitoScale` (0.6324) and `CONFIG.copitoOffset`
     (`-4.206 0.0574 3.6008`), applied to a wrapper `<a-entity gltf-model>`
     inside the `copito` component. These numbers were solved by measuring
     the model's actual world-space bounding box live in the browser via
     `THREE.Box3` and solving for the scale/offset that centers it and
     plants its feet at y=0 at `CONFIG.snowmanHeight` tall. **If the model
     file ever changes, these need to be re-measured** — method: load the
     page, run a script that sets the wrapper's scale/position to identity,
     read `new THREE.Box3().setFromObject(modelEl.getObject3D('mesh'))`,
     then solve `s = targetHeight / size.y`, `offset = -s * localCenter`
     (with `offset.y = -s * localMin.y` instead, to plant feet on the
     ground). **Do this on a freshly opened tab** — mixing it with a tab
     that's had earlier unrelated camera/object manipulation produced a
     stale/wrong reading once during this build; a clean tab gave a
     self-consistent, verified-correct result.

2. **Sky image sourcing took a different path than planned.** Ended up using
   **Passendorf Snow** (not Bergen — Bergen's snow wasn't visually obvious
   enough once in-scene) from Poly Haven. Poly Haven's download page only
   offered HDR/EXR for this asset (no JPG), so Vincent downloaded the **HDR**
   at 4K (matches our target 4096x2048 exactly) and it was tone-mapped
   locally with OpenCV (`cv2.createTonemapReinhard`, gamma 2.2) to
   `assets/sky/sky.jpg` (0.88 MB, well under the 3 MB budget). Full method
   logged in `ASSETS.md`. The raw `.hdr` is kept in `assets/sky/` for
   reference but not referenced by the page.

3. **Ground is a circular plane, textured with the sky photo's own snow
   (not a flat color), + fog.** `assets/sky/ground.jpg` (0.08 MB) is a
   650x650 crop of foreground snow from `sky.jpg` itself (cropped from
   `(2000, 1300)` — picking a different crop just needs an in-bounds
   `(x, y, x+650, y+650)` region that avoids the top ~40% of the image,
   which is sky/trees, not ground). It's tiled across the circle
   (`repeat: 6 6`) and made seamless with a `mirror-tile` component (mirrors
   alternating tiles via `THREE.MirroredRepeatWrapping` — plain repeat
   showed a visible seam grid; A-Frame doesn't expose texture wrap mode as
   an HTML attribute, hence the few lines of JS). Fog (`near: 4.5, far: 7.9`,
   color `#aab0b8`, resampled from the photo's horizon band) fades it to the
   horizon tone well before its edge (`radius: 9.5`) is reached — the gap
   between `far` and `radius` (about 1.6m currently) is deliberate, see the
   buffer-margin lesson below.

   Iterated several times with Vincent to get here: first pass (40x40
   square, flat color, far fog distances) worked but felt too big/distant;
   shrinking it straight to a tight fog band (radius right at `far`, no
   buffer) caused a visible bright seam/hard edge twice over (once from a
   wrong fog color, once from too little buffer margin — see "Lessons
   learned" #4); switching to circular + re-sampled color + a real buffer
   margin fixed that; switching the flat color to an actual photo-cropped
   tiled texture is what made it read as genuinely continuous with the
   background rather than just color-matched. If asked to adjust size again:
   keep `radius` meaningfully bigger than `fog far` (a few meters, not a
   fraction of one), keep `fog near` at or past Copito's
   distance (`CONFIG.snowmanDistance`, currently -5) so he doesn't get hazy,
   and re-sample ground/fog color from the sky photo rather than guessing
   hex values — guessed colors have been wrong twice so far. If the repeat
   count changes, re-check for visible tiling patterns (the mirror trick
   hides seams but a *very* low repeat count can still show an obvious
   kaleidoscope-style mirror symmetry near the center).

   **One more gotcha found after the texture was in:** the ground looked
   noticeably darker than the sky and the near-to-far transition felt
   uneven. Cause: `<a-sky>` uses `shader: flat` (unlit, shows the texture at
   its raw photo brightness), but the ground circle was using the default
   `standard` (lit) shader, which multiplies the texture by the scene
   lights — and those lights are tuned well below the sun exposure already
   baked into the photo, so the same texture rendered much darker on the
   ground than in the sky. Fixed by setting `shader: flat` on the ground's
   material too (now in `index.html`), matching the sky's unlit treatment.
   If ground brightness or the near/far transition ever looks off again,
   check the shader first before touching colors or fog numbers — standard
   vs flat shading was the actual cause twice now (fog-vs-sky in step 1,
   lights-vs-sky here).

## Step-by-step status

**Step 1 — folder, vendored A-Frame, sky, ground, Copito static: DONE**
(with the deviations above layered on top, all verified working, zero
console errors as of this writing).

**Step 2 — idle animation + sparkles: DONE.**
- Bob (2cm, 2.5s sine) + slight sway (~2deg, 3.2s sine, deliberately
  different period so it doesn't read as a mechanical loop): implemented in
  `copito`'s `tick(time)` handler, applied as deltas on top of
  `CONFIG.copitoOffset` on `this.model.object3D` (position.y and
  rotation.z). Tunables added to `CONFIG`: `idleBobAmplitude`,
  `idleBobPeriod`, `idleSwayAmplitude`, `idleSwayPeriod`.
- Blink: **skipped** (option (a) from the brief). Tried it visually with
  just bob+sway+sparkles running and it already reads as alive; not building
  the fake-eyelid-overlay hack unless Vincent flags it as needed.
- Crown shimmer: dropped, not applicable (hat, not a crystal crown).
- Sparkles (120 orbiting points): one `THREE.Points` buffer geometry
  (`copito.buildSparkles`/`updateSparkles`), attached to the outer `el`'s
  `object3D` (ground level under Copito) so they orbit independently of the
  model wrapper's bob/sway. Per-point angle/speed/radius/height/phase are
  randomized once at init and advanced each tick; verified visually in the
  browser (sparkle positions clearly shift frame to frame, zero console
  errors).

**Step 3 — throwing (desktop + controllers), pool, trajectory preview: not
started.** Unaffected by any deviations so far; follow the original spec
directly. `CONFIG` already has `throwSpeed`, `throwUpBias`, `gravity`,
`throwCooldown`, `maxSnowballs`, `snowballLifetime`, `showTrajectory`,
`trajectoryDots` defined and ready to use. Trajectory preview should also be
one `THREE.Points` system, not N entities.

**Step 4 — 3-hit reactions: not started. Prepared brief (adapted for the
single-mesh model):**
- Hit 1: whole-model squash-stretch scale pulse + brief material
  color-flash (grab the mesh's material(s) via
  `this.model.getObject3D('mesh').traverse(...)`, tween color/emissive then
  revert) + snow-puff particles at the impact point. Skip "eyes squint" /
  "crown crystal falls" — not applicable to this model; the squash + flash +
  puff combo should already read clearly as "hit 1".
- Hit 2: bigger wobble + a whole-body tilt (rotate the wrapper around a
  pivot near head height — can't isolate just the head on a fused mesh) +
  a crack decal (new plane with a canvas-drawn crack texture, alpha-blended
  over the front of the torso — independent of mesh structure, works fine)
  + sparkle system sped up + crack sound.
- Hit 3: hands off to step 5.

**Step 5 — explosion + respawn: not started.** Chunks (40-60): use
`THREE.InstancedMesh` (two instances — snow lumps, ice shards — already
agreed during planning, for draw-call budget). Since there are no separate
"parts" anymore, spawn chunks distributed across the model's overall
bounding-box height bands instead of at specific part positions — visually
equivalent. Comfort rule (bias away from player, nothing within 1m of head)
still applies exactly as specified.

**Step 6 — sound + haptics: not started.** Same access problem as the sky
image is likely for Kenney/Freesound — Vincent will probably need to
download the Kenney Impact Sounds zip and the Freesound wind clip himself
(same workaround: his browser, save to this project folder, Claude reads it
directly). Planned sourcing (from earlier planning, still valid): Kenney
`impactSoft_medium_000.ogg` + `footstep_snow_000.ogg` (hit 1),
`impactSoft_heavy_000.ogg` + `impactGlass_light_000.ogg` (hit 2),
`impactGlass_heavy_000.ogg` + synthesized noise burst (explosion); throw
whoosh and respawn chime synthesized (Web Audio), no CC0 source found for
those; ambience: Freesound "Soft Wind Ambience.wav" by cribbler (CC0 1.0, id
380379), loop-crossfaded locally with ffmpeg since it isn't natively
loopable. `CONFIG.volume` and `CONFIG.haptics` are already defined.

**Step 7 — HUD + i18n + accent check: not started.** Also: **add the in-VR
CC-BY credit line here** (owed from step 1/model swap, see deviation #1
above). `I18N` object already has the core strings; test á/é/ñ/¡ rendering
in A-Frame's default MSDF font early in this step — fall back to a
canvas-texture text plane if glyphs are missing (spec's own documented
fallback).

**Step 8 — performance pass + README + ASSETS.md: not started.** The
original work order's "add a row to the planning folder's README" item is
superseded now that the project moved into its own repo — instead, the
planning folder's `README.md`
(`~/Documents/Claude_folder/Meta_quest_coaniquem/README.md`) should note
that this demo now lives in the separate `hello-quest-dev` git repo, the
same way it already describes `snow-canyon` as "a separate git repo...kept
outside this folder". Still outstanding, don't forget it. Final no-em-dash
grep check across all authored files before calling this done.

## Open judgment calls for Vincent (not yet decided)

- Ground is now textured + circular + mirror-tiled and considered settled
  for now; revisit only if Vincent flags something specific about it.
