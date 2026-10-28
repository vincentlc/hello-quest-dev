# Progress: snowman_demo

Updated 2026-10-27. Read this file first in any new session working on this
project — it has everything learned so far that isn't obvious from the code,
so you don't need to re-derive it (and re-spend tokens doing so).

Original spec: `~/Documents/Claude_folder/Meta_quest_coaniquem/02_plans/snowman_demo_prompt.md`
(the full work order — lives outside this repo, in the user's planning
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
   asking the user to download it themselves.
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
  a site other than the CDN allowlist needs the user to download it themselves in
  their own browser and save it under this project folder. Since Claude Code
  and the user are on the same machine, no upload/share step is needed —
  just ask them to save to an exact path and it's immediately readable.
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

## Deviations from the original spec (all approved by the user)

1. **Copito's body is a CC-BY glTF model, not CC0 hand-built primitives.**
   The user provided it (Sketchfab "Snowman" by alixor22). This is now the
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
   offered HDR/EXR for this asset (no JPG), so the user downloaded the **HDR**
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

   Iterated several times with the user to get here: first pass (40x40
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
  the fake-eyelid-overlay hack unless the user flags it as needed.
- Crown shimmer: dropped, not applicable (hat, not a crystal crown).
- Sparkles (120 orbiting points): one `THREE.Points` buffer geometry
  (`copito.buildSparkles`/`updateSparkles`), attached to the outer `el`'s
  `object3D` (ground level under Copito) so they orbit independently of the
  model wrapper's bob/sway. Per-point angle/speed/radius/height/phase are
  randomized once at init and advanced each tick; verified visually in the
  browser (sparkle positions clearly shift frame to frame, zero console
  errors).

**Step 3 — throwing (desktop + controllers), pool, trajectory preview:
DONE.**

- Two hand entities (`#leftHand`, `#rightHand`) added with `meta-touch-controls`
  (confirmed current name for Quest Touch controllers by grepping
  `vendor/aframe.min.js`; `oculus-touch-controls` also exists, same
  implementation under the hood).
- **The "simplest fix" for no laser pointer turned out to need one more
  piece than planned.** Not attaching `laser-controls` isn't enough:
  `meta-touch-controls` (like every vendor touch-controls component)
  auto-attaches its own `raycaster` with `showLine: true` itself, internally,
  as soon as a controller connects (confirmed in vendor source: its per-vendor
  config merge defaults to `{showLine: true}` unless a specific vendor entry
  overrides it, which `meta-touch-controls` doesn't). New small component
  `hide-controller-line` listens for `controllerconnected` and
  `controllermodelready` on each hand entity and flips `raycaster.showLine`
  back to `false` every time the library turns it on. Couldn't verify this
  on-device this session (no headset attached, see below); logic matches the
  vendor source exactly, flag if a beam still shows up on the Quest.
  (Later renamed to `controller-aim` and given a second job — see the step 3
  follow-up fix below.)
- `snowball-thrower` (on `<a-scene>`): 12-entity object pool of `<a-sphere>`
  snowballs (radius `CONFIG.snowballRadius`, 8 segments, color
  `CONFIG.colors.snowball`), reused by round-robin index rather than a
  free-slot search. Per-source cooldown (`left`/`right`/`desktop` keys) using
  the component's own `tick()` time as the clock, not `performance.now()`,
  so cooldown and lifetime share one time base. Ballistic `tick()`:
  Euler-integrates gravity + velocity with scratch `THREE.Vector3`s (no
  per-frame allocation), clamps `dt` to 50ms to avoid a physics blow-up on a
  stalled/backgrounded tab. "Hit" is a simple proximity check against
  `#copito`'s world position (`CONFIG.snowballHitRadius`, generous) rather
  than per-part collision, per the single-fused-mesh constraint; on hit it
  deactivates the snowball and emits `snowball-hit` on `#copito` with
  `{point: {x,y,z}}` in detail, step 4's contract.
- `trajectory-preview`: one instance per aim source (`source: hand` on each
  hand entity, `source: desktop` on the camera), each its own
  `THREE.Points` buffer of `CONFIG.trajectoryDots` dots attached directly to
  the scene root (world-space positions computed analytically each frame
  from the same ballistic formula, independent of the source entity's own
  transform). Hidden while that source's trigger/mouse is held, and the
  desktop instance also hides itself in `vr-mode` (a mouse-driven arc
  floating in front of the camera made no sense once a headset is in use;
  not in the original brief, added since it was a one-line, obviously-correct
  guard once building the desktop/VR split).
- Desktop aim: a single shared `DesktopAim = {x, y}` (NDC mouse position,
  updated by one `window` `mousemove` listener) used by both
  `snowball-thrower` (via `THREE.Raycaster.setFromCamera` at throw time) and
  the desktop `trajectory-preview` instance (every frame). Plain object + one
  listener, not a third component, since it isn't tied to any entity.
- Haptics: `CONFIG.haptics.throw` pulses via
  `handEl.components['tracked-controls'].controller.gamepad.hapticActuators[0]`,
  guarded at every step (works on desktop, confirmed no throw/crash when no
  gamepad is present).
- **Tested this session:** desktop click-to-throw in the Browser pane,
  console clean on load and after repeated throws. The pane's headless
  renderer only produces a frame on demand (confirmed:
  `requestAnimationFrame` never fires on its own, even on a fronted,
  `visibilityState: "visible"` tab; only a screenshot/CDP capture pumps one
  frame), so real-time flight couldn't be watched frame-by-frame in a
  screenshot loop. Verified correctness instead by driving
  `snowball-thrower.tick()` manually in 16ms steps from a real
  `throwFromDesktop()` call: the snowball reached `z ≈ -4.75` (Copito is at
  `z = -5`) after 0.53s of simulated flight and fired `snowball-hit` with a
  sane `point`, and the haptics-guard path didn't throw when called on a hand
  entity with no connected controller. **Not yet tested: an actual Quest 2
  headset** (trigger throw, haptics felt, hide-controller-line working
  on-device, 72 fps during normal play) — do that before calling this step
  fully verified, same as step 1's "zero console errors" bar but for VR
  input this time.

**Step 3 follow-up fix (separate session, after the user tried it on-device):
aim direction was wrong.** Throws and the hand trajectory arc pointed
straight down (out of the bottom of the controller, parallel to the cable)
instead of out in front like a laser pointer. Root cause, confirmed by
grepping `vendor/aframe.min.js`: `tracked-controls` (which `meta-touch-controls`
depends on) drives each hand entity's `object3D` from the WebXR **grip**
pose (`tick()` calls `frame.getPose(controller.gripSpace, ...)`) — grip
space's forward axis runs down the physical handle, not out through the
buttons the way a laser pointer naturally points. `throwFromHand` and
`trajectory-preview`'s hand branch were reading that axis directly
(`object3D.getWorldDirection`), so they inherited the wrong direction.
The correct offset (a per-controller-model local `{origin, direction}`,
tilted roughly 40° off grip-forward) is exactly what A-Frame's own
`laser-controls` forwards into a raycaster — it's emitted by
`meta-touch-controls` itself on the `controllermodelready` event's
`detail.rayOrigin`, confirmed in the vendor source. Renamed
`hide-controller-line` to **`controller-aim`** and had it also capture that
`rayOrigin` (no need to pull in `laser-controls` itself, keeping the
no-laser-line decision above) via a new `getAimRay(originOut, dirOut)`
method, applying the exact same `localToWorld`/`transformDirection` math
`raycaster.updateOriginDirection` uses internally. `throwFromHand` and
`trajectory-preview` now call `getAimRay()` instead of reading the raw grip
axis; falls back to the old `object3D`-based direction if a hand entity's
model hasn't finished loading yet (same safe degradation as before, not a
new risk). **Tested this session:** fresh-tab console clean (ruled out the
already-known stale-NaN red herring by diffing against `main` — identical
NaN appears on both, confirmed pre-existing and unrelated); the fallback
path (no controller connected) verified unchanged by directly calling
`getAimRay()` in-browser; the corrected path verified by injecting the real
`meta-quest-touch-pro`/`-plus`/`oculus-touch-v3` left-hand `rayOrigin`
values from the vendor table and confirming `getAimRay()` produces a
clearly different, forward-tilted direction instead of the raw grip axis.
**Not yet tested: an actual Quest 2 headset** — same outstanding item as the
rest of step 3; this was fixed from the vendor source and A-Frame's own
reference implementation, not by guessing numbers, but the real on-device
feel (and whether this hardware reports as `meta-touch-controls`/
`oculus-touch-v3` vs a Pro/Plus variant, which changes which `rayOrigin`
table entry applies) still needs a real headset to confirm.

<details>
<summary>Original step 3 brief (superseded by the DONE notes above)</summary>

Scope was strictly throwing mechanics: input, the snowball object pool,
ballistic flight, and the aim-assist arc. Hit reactions (squash, flash,
cracks) stay out of this step and land in step 4 — see the event contract
note below for how the two steps meet.**

Scope is strictly throwing mechanics: input, the snowball object pool,
ballistic flight, and the aim-assist arc. Hit reactions (squash, flash,
cracks) stay out of this step and land in step 4 — see the event contract
note below for how the two steps meet.

- **No controller entities exist yet.** The scene currently has only the
  camera; this step adds `<a-entity>` controller entities for Quest (left
  and right hand) for the first time. Use A-Frame's built-in Touch
  controller component (verify the exact name, e.g. `oculus-touch-controls`
  vs a newer `meta-touch-controls`, by grepping `vendor/aframe.min.js`
  rather than trusting memory, per the step 1 lesson).
- **Deviation (planned, not left open): no laser pointer at all.** The
  original spec's own note says to keep hello_quest's laser lines "hidden or
  very short" because they fight with the dotted trajectory arc. Simplest
  fix: don't attach `laser-controls` / a raycaster line to the hand entities
  in the first place, since nothing in this demo needs point-and-click UI.
  The dotted parabola arc is the only aim visual, and it is more accurate
  than a straight laser anyway (it shows the actual gravity drop).
- **Two components**, matching the original spec's component list:
  - `snowball-thrower` (likely on `<a-scene>`): owns the 12-entity object
    pool (`CONFIG.maxSnowballs`, pre-created once, reused, not
    created/destroyed per throw), listens for `triggerdown` on each hand
    entity and `mousedown`/click on the canvas for desktop, tracks a
    **separate cooldown timer per input source** (`CONFIG.throwCooldown`)
    so one hand's cooldown doesn't block the other, and runs the ballistic
    `tick()`: Euler-integrate `velocity.y -= gravity * dt`,
    `position += velocity * dt` per active snowball, reusing scratch
    `THREE.Vector3` instances (no per-frame allocation, per the spec's
    performance budget). Initial velocity = aim direction *
    `CONFIG.throwSpeed` with `CONFIG.throwUpBias` added to the Y component.
    Each snowball deactivates (hidden, flagged free in the pool) after
    `CONFIG.snowballLifetime` or on a hit.
  - `trajectory-preview` (one instance per aim source: each hand entity,
    plus a desktop one driven by the camera + live mouse position): one
    `THREE.Points` buffer per source for the dotted arc (`CONFIG.showTrajectory`
    toggle, `CONFIG.trajectoryDots` points), positions computed analytically
    from the same ballistic formula so the dots actually match where the
    snowball will go. Hidden while that source's trigger/mouse button is
    held down (spec: "while the trigger is not pressed").
- **Desktop aim**: left-click throws from the camera, direction toward the
  mouse cursor (`THREE.Raycaster` through NDC mouse coordinates against the
  camera), not just the camera's forward vector. Keep existing
  `look-controls` + `wasd-controls` as is.
- **Event contract with step 4**: since hit reactions aren't built yet, a
  snowball that comes within a generous radius of Copito's position
  (`CONFIG.snowmanDistance`) deactivates and fires a `snowball-hit` DOM
  event on the `#copito` entity with the impact point in the detail payload.
  Step 4 just adds the listener; step 3 doesn't need Copito to react yet, so
  it's independently testable (watch snowballs fly, arc, and vanish near
  Copito).
- **Haptics**: wire up `CONFIG.haptics.throw` (`[0.3, 40]`, already defined)
  via `gamepad.hapticActuators[0].pulse()` on throw, guarded behind an
  existence check so desktop (no gamepad) doesn't throw an error.
- **New CONFIG value needed**: snowball color isn't defined yet (original
  spec: `#F4FFFD`, slightly blue-tinted white) — add
  `CONFIG.colors.snowball` when implementing.

</details>

**Step 4 — 3-hit reactions + snowball packing/stacking: DONE.**

- **Hit reactions**, all driven by the `snowball-hit` event `snowball-thrower`
  already emits (step 3's contract): `copito` tracks `hitCount` and listens
  for it.
  - Hit 1: whole-model squash-stretch (decaying damped-oscillation impulse,
    see `computeImpulse`, applied as a delta on top of `copitoScale` the same
    way idle bob/sway are deltas on top of `copitoOffset` — hit reactions and
    idle animation never fight over the transform) + a brief material
    color-flash (materials collected once via the model's `model-loaded`
    event, traversed and cached with their original colors so the flash can
    revert exactly) + a snow-puff particle burst at the impact point (one
    shared `THREE.Points` pool, `CONFIG.snowPuffCount` particles, reused
    every hit rather than allocated per hit).
  - Hit 2: bigger squash (`CONFIG.hitSquashAmplitude[1]`) + an added wobble
    rotation (`CONFIG.hitWobbleAmplitude`, same decaying-impulse mechanism,
    on `rotation.z`/`rotation.x`) + a crack decal: a canvas-drawn crack
    texture on a plane, built once at init and just toggled visible/hidden
    rather than created per hit. **Simplification from the original
    brief:** the wobble rotates the model wrapper around its own base
    origin (feet), not a pivot at head height — the model's corrective
    offset (`copitoOffset`) already puts that origin near the ground, and a
    true head-height pivot would need extra pivot-point math for a fused
    mesh with no separable parts. Reads fine as "shaken" in testing; revisit
    only if the user flags it as too subtle/wrong-feeling in VR.
  - Hit 3: per the event contract, emits `snowman-destroyed` on `#copito`
    (step 5's hook) and, since step 5's explosion/respawn isn't built yet,
    resets `hitCount` to 0 and hides the crack decal immediately rather than
    leaving Copito stuck mid-damage with no recovery. Swap this reset for
    the real explosion when step 5 lands.
  - Crack sound: **deferred to step 6** (no audio assets wired up yet, same
    as the rest of sound/haptics).
- **Snowball packing/stacking (new, requested alongside step 4, not in the
  original spec):** a miss that reaches the ground no longer vanishes after
  `snowballLifetime` — `snowball-thrower.tick()` now checks
  `pos.y <= CONFIG.snowballRadius` for any flying snowball and, if hit,
  calls `land()` instead of `deactivate()`. A landed snowball eases into a
  squashed "packed into the snow" shape over `CONFIG.landedSquashTime`
  (scale eased toward `CONFIG.landedSquashXZ`/`landedSquashY`) and just sits
  there, visible, no longer simulated.
  - **The limit** is `CONFIG.maxLandedSnowballs` (8): landed slots are
    tracked in a small FIFO (`this.landed`). Once a new landing would exceed
    the cap, the oldest landed snowball is freed back to the pool
    immediately — no extra cleanup pass needed.
  - **Pool reuse was the one subtlety:** the existing throw pool already
    reuses slots round-robin (`spawn()`); a landed snowball just occupies its
    slot until that same round-robin comes back around to it, at which point
    it's thrown again like any other slot. `spawn()` only needed one new
    line (drop the slot from the `landed` FIFO if it was currently landed)
    for this to work correctly — confirmed by scripted testing (see below)
    that round-robin naturally evicts the oldest landed ball once 11 misses
    are thrown in a row.
  - A hit on Copito still vanishes immediately (unchanged) — only misses
    that reach the ground stack up; this matches what was actually asked
    for ("they are going to stack, where they landed, like on the ground").
  - **Known interaction, not a bug:** `maxSnowballs` (pool size, 12) is
    shared between flying + landed + free. With up to 8 reserved for landed,
    only 4 slots cycle for actively-in-flight balls. Fine at normal human
    throwing pace (cooldown 0.25s, typical flight-to-ground well under 1s in
    testing) — only matters if someone spams throws far faster than balls
    can land, in which case the round-robin would start recycling slots
    sooner than `maxLandedSnowballs` would suggest. Not tuned further since
    it didn't come up in testing; revisit `maxSnowballs` upward if it ever
    does.
- **Tested this session** (same headless-pane constraint as step 3: no
  on-demand `requestAnimationFrame`, so verified by manually driving
  `tick()` in 16ms steps from real `spawn()`/event calls, not by watching
  real-time flight): confirmed landed count climbs then holds exactly at
  `maxLandedSnowballs` (8) across 11 scripted misses, with evicted slots
  correctly returning to `free`; confirmed the 3-hit sequence against Copito
  (hitCount 1 → squash + flash + puff fire, 2 → crack decal appears, 3 →
  resets cleanly, crack hidden again); confirmed a landed pile is visibly a
  flattened white mound in a screenshot (see session), not just correct
  state. Zero console errors throughout. **Not yet tested: an actual Quest 2
  headset** (hit reactions and the landed pile from real trigger throws,
  not scripted ones) — same outstanding item as step 3.

**Step 4 follow-up round (same session, after the user's first look):** four
issues reported against the above, all fixed:

1. **Hitbox missed the head/hat.** The "hit" check was a single sphere
   centered on Copito's root (his feet), radius 0.5 — anything above ~0.5m
   (most of the body) was outside it. Changed to a capsule: horizontal
   distance (unchanged 0.5 radius) + a height range from the ground to
   `snowmanHeight + hitHeightMargin`. Now covers him head-to-foot.
2. **Crack decal looked disconnected from the moving body**, and once fixed,
   the first crack read great but the second one didn't. Two separate
   causes:
   - The decal was parented to the outer, non-animated entity while all of
     Copito's own animation (bob/sway, and the new squash/wobble) applies to
     a different, inner node — so the crack just sat still while the body
     moved under it. Fixed by parenting the decals **inside** the model
     wrapper itself (`copito.worldToModelLocal` converts an authored
     "el-local meters" position into the wrapper's raw/pre-scale local
     space once, at build time), so they now inherit every animation
     automatically through the normal object3D parent-child hierarchy —
     no per-frame syncing code needed.
   - Separately, while debugging that, found and fixed a **real bug**: the
     new hit-wobble/squash was rotating and scaling the model wrapper
     directly, but the wrapper's own local origin (an artifact of the
     glTF's messy raw export transform, see `copitoOffset`'s comment) sits
     far from the visible mesh. Rotating/scaling around it swung Copito's
     whole body sideways by up to ~0.5m instead of wobbling in place —
     confirmed by sampling world position before/after in-browser. Fixed by
     adding `hitPivot`, a plain, well-centered rotation/scale point
     (`CONFIG.hitPivotHeight`, roughly mid-body) that the model wrapper
     nests inside; squash/wobble now apply to `hitPivot`, while the
     pre-existing idle bob/sway stay exactly as they were on the model
     wrapper (untouched, to avoid regressing already-approved behavior).
     After the fix, displacement during a full-amplitude wobble dropped
     from ~0.5m to ~0.05m in testing.
   - The "crack 2 looks worse" complaint itself turned out to be the two
     decals' glow halos overlapping (crackSize was bumped up for
     visibility, see next point, and the glow radius was a fraction of
     that size, so it grew right along with it) — crack 1's wide halo was
     bleeding across and washing out crack 2. Fixed by tightening the glow
     radius fractions so each crack's halo hugs its own lines instead of
     flooding the whole decal plane; confirmed visually afterward that both
     read as distinct, legible fractures at normal viewing distance.
3. **Crack asked to be bigger/more impactful:** `CONFIG.crackSize` raised
   (0.42 → 0.75), line widths and branch reach increased, and an extra
   "core" glow layer added on top of the outer halo for a punchier look —
   balanced against the overlap fix above so it stays readable with
   several cracks on screen at once.
4. **Snowballs landing at the same spot now stack vertically** instead of
   overlapping flat on the ground (`snowball-thrower.land`/`findStackBase`:
   a landing within `CONFIG.landedStackRadius` of an existing pile snaps
   onto its current top instead of ground level). Cap raised to 12 (top of
   the user's requested 10-12 range, for a more satisfying pile) and pool
   size bumped 12 → 16 so flying/cooldown balls still have slots once the
   ground is full. **One real consequence found and fixed:** evicting the
   *oldest* landed ball once over the cap, when that ball happens to be
   buried at the base of a tall single-spot stack, would otherwise cascade
   and collapse the *entire* pile at once (confirmed in testing: 13 throws
   at one exact spot dropped the count from 12 straight to 0). Fixed by
   making cap-eviction (`evictForCap`) always target the oldest ball that's
   currently the *top* of its own pile, never a buried one — a tall stack
   now caps out gracefully instead of periodically collapsing. A separate
   `freeLanded` (cascade-on-removal) is kept for the other path where a
   slot genuinely has no choice but to be reused (the pool's round-robin
   landing on an occupied slot in `spawn()`), so nothing is ever left
   visually floating.

**Two more requests folded in as "future-proofing" (no new user-facing
feature built, just removed two single-instance assumptions that would
otherwise block this later):**

- **Scalable "lives":** `CONFIG.hitsToExplode` (default 3, lives up to a
  tested 7) now drives the crack system directly — `generateCrackPositions
  (count)` procedurally lays out `hitsToExplode - 1` crack decals around a
  widening front arc (no more hardcoded two-position list), and
  `onHit`'s squash/wobble amplitude ramps via `lerp` across
  `hitSquashAmplitudeRange`/`hitWobbleAmplitudeRange` instead of a
  fixed 2-entry table indexed by hit number. Verified in-browser with
  `hitsToExplode` temporarily set to 7: 6 cracks generated, each revealed
  one at a time across 6 hits, clean reset on the 7th, zero console errors.
  **Not built:** an actual bigger-snowman visual variant for the higher
  end of that range — the user explicitly said not to build that yet, this
  just keeps the hit/crack code from having to be reworked when it happens.
- **Multiple snowmen on the map:** `snowball-thrower` no longer hardcodes
  `#copito` as the one hit target. Every `copito` component instance
  registers itself into a module-level `copitoRegistry` on init (and
  deregisters in `remove()`); the thrower's capsule hit-check
  (`findHitSnowman`) loops that registry and emits `snowball-hit` on
  whichever snowman was actually hit. Also fixed a latent id collision that
  would have bitten this immediately: the blob-shadow and crack-decal
  `<img>` assets used fixed ids (`#blobShadow`, `#crackDecal0`) — a second
  snowman would have silently reused the first one's textures via DOM id
  collision. Each `copito` instance now gets a unique `instanceId`
  (`copitoInstanceCounter`) and namespaces its own asset ids with it.
  **Not built:** actually placing more than one snowman entity in the
  scene — that's a content/placement change for whenever it's wanted, not
  a code change, now that the lookup side is generic.

**Step 4 crack redesign (same session, after the user shared a hand-drawn
reference):** replaced the crack system entirely with a "snowman type"
model, per a hand-drawn sketch the user shared (crossing curved bands, not
flat jagged fracture decals).

- **Only four valid types: 1, 3, 5, or 7 lives** (`CONFIG.hitsToExplode`).
  Type 1 dies on the first hit with no crack at all. Every other type shows
  one crack per hit, building toward death.
- **Six fixed crack "slots"**, each a fixed color and a fixed crossing
  angle: 1 (red) / 2 (amber) is the pair always shown right before death,
  for any type that has at least 3 lives; 3 (pink) / 4 (green) is added
  before that for type 5+; 6 / 7 (both blue) is added before even those,
  only for type 7. `CRACK_MASTER_ORDER = [6, 7, 3, 4, 1, 2]` encodes this
  once; `getCrackSlotsForLives(lives)` just takes the **last** `lives - 1`
  entries of it -- a tougher snowman gets earlier cracks *prepended*, never
  new ones appended after 1/2, so "cracks 1, 2, then dies" stays true for
  every type that reaches them. Verified for all four types plus an
  off-list value (4 snaps to the nearest valid type, 3, rather than
  producing a broken half-pair).
- **Every active crack crosses through the same central point** on the
  torso (`CONFIG.crackCenter`), not spread to different spots -- matching
  the user's sketch, where all the lines cross near the belly. This also
  simplified the code a lot versus the previous per-crack-position
  generator: since all decals share one position, only the *texture* needs
  to differ per slot (drawn at `CRACK_SLOTS[slot].angle`), not the plane's
  world transform. Decals are nudged a hair apart in z (0.002 model-local
  units per slot) purely to avoid z-fighting between coplanar planes --
  visually imperceptible.
- **Curved sweep, not jagged fracture.** The user confirmed the original
  hit-1 crack's curve/arc was good and a flat decal plane (not a true 3D
  band wrapping the body, confirmed not needed) is sufficient. Rewrote
  `makeCrackTexture` to draw one smooth quadratic-bezier stroke through the
  shared center (core line + glow halo + highlight), replacing the earlier
  branching-fracture canvas code entirely. `mulberry32` (the old PRNG for
  randomizing branch patterns) is no longer used anywhere and was removed.
- **Tested this session:** `getCrackSlotsForLives` output checked directly
  for all four types (plus the off-list snap case); default type 3 (shows
  slots [1,2]) and type 7 (shows all six) both exercised through full hit
  cycles with screenshots confirming the crossing-curves look matches the
  reference sketch at both close range and normal play distance; zero
  console errors with `hitsToExplode` set at load time (the realistic way
  this would ever be configured). **One false alarm during testing:**
  reloading with `hitsToExplode` hot-swapped at runtime via
  `removeAttribute`/`setAttribute` (an abnormal test-only technique, not
  how the game ever actually reconfigures this) produced one THREE.js NaN
  bounding-sphere console error; confirmed it does NOT reproduce when the
  value is set the normal way (edited in CONFIG before page load) --
  logged here only so a future session doesn't need to re-derive this if
  the same red herring resurfaces.
- **Not yet tested:** an actual Quest 2 headset, same outstanding item as
  every step since step 3.

**Step 4 crack redesign, round 2 (same session, after the user reviewed the
first redesign against a screenshot):** three more issues, all fixed:

1. **Color.** The user wanted the original cyan/glow look back (not the
   red/amber/pink/green/blue-per-slot palette from redesign round 1). All
   six slots now share one color (`CONFIG.colors.crackCore` '#0A2A28' /
   `crackGlow` '#7DF9FF'), restored into `CONFIG.colors` after having been
   removed.
2. **Actually hugging the body, not a flat floating card.** The flat decal
   plane read as detached/floating once seen up close (visible gap between
   the glowing line and the body surface beneath it). Replaced with a real
   ribbon mesh: several short quad segments following a curve, each
   oriented to the curve's local outward direction so it sits flush against
   the body rather than being one rigid flat plane. Two approaches were
   tried:
   - **Raycasting the actual glTF mesh** for the curve's points (so it
     would hug the *real*, not idealized, surface) seemed like the more
     accurate choice, but repeatedly produced broken/pinched geometry in
     testing -- traced to the scarf's surface detail (ridges, folds)
     injecting noise into the per-point surface normals, which a
     hand-rolled ribbon cross-section (`cross(tangent, normal)`) is
     numerically sensitive to: a near-degenerate normal at one sample
     collapses that point's ribbon width toward zero, reading as a pinch
     or a "bowtie". Also cost real debugging time chasing what first
     looked like a geometry bug but turned out to be the preview camera
     sitting too close to the crack geometry (near-clip distortion) for
     several iterations -- worth remembering if ribbon/curve geometry ever
     looks broken again: check camera distance before assuming the math is
     wrong.
   - **An idealized sphere approximating the torso** (`CONFIG.crackTorso
     Center`/`crackTorsoRadius`) replaced it: mathematically clean points
     and normals by construction (a sphere's outward normal is just
     `(point - center)`, never degenerate), and the torso is close enough
     to actually spherical that it still reads as hugging the real body.
     This is what shipped. If a future session wants to revisit true
     mesh-hugging, the lesson here is to fix the ribbon math's robustness
     to noisy normals first (e.g. smooth/average normals across neighbors,
     or fall back to a stable reference direction when the cross product's
     magnitude drops near zero) rather than assuming raycasting alone
     will produce clean geometry.
   - Each ribbon is a `THREE.Group` of two meshes (wide translucent glow +
     narrow opaque core), built once per active slot and added directly to
     `this.model.object3D` (raw three.js objects, not a-frame entities,
     since the geometry is custom per crack) -- same "parent inside the
     animated model" trick as the flat-decal version for free animation
     tracking, confirmed still working (sampled world position during a
     fresh squash/wobble impulse and again 100ms later: moves smoothly
     with the body).
3. **Not all 6 crossing one point.** With six bands converging on a single
   spot (type 7), the result was visually busy and the two "outer" (6/7)
   bands initially swept right across the eyes/face, which also read as
   wrong because it visually conflicted with the hat. Split into two
   separate crossing points instead: slots 1-4 (`group: 'torso'`) still
   cross at the main torso center; slots 6/7 (`group: 'upper'`,
   `CONFIG.crackUpperCenter`/`crackUpperRadius`) cross at a separate, lower
   point spanning roughly chin-height down to the top of the scarf, clear
   of both the eyes and the hat.
- **Process note:** The user asked to see a rendered preview before each
  round of changes landed in the file. Delivered by live-patching the
  already-loaded page in the browser (mutating `CRACK_SLOTS`/CONFIG,
  rebuilding the affected crack meshes, screenshotting) rather than editing
  `index.html` and reloading each time -- let several layout/color options
  get checked and discarded in-browser before committing to one and
  porting it into the real component code, which is what actually landed.
- **Tested this session:** the final design re-verified through the real
  component code (not just the live-patched preview) for both type 3
  (slots [1,2]) and type 7 (all six, split across the two crossing points)
  with screenshots matching what was approved; hitbox, landing/stacking,
  and the snowman registry all re-confirmed still working together (full
  regression pass); zero console errors throughout.
- **Not yet tested:** an actual Quest 2 headset, same outstanding item as
  every step since step 3.

**Step 4 crack redesign, round 3 (same session, after the user compared the
round-2 result against an older reference screenshot):** they wanted the
cracks "broader... a bit more longer to the boarder" and the shine back to
how an earlier in-browser prototype looked ("glowing, super good") rather
than the round-2 version, which read as flatter. Root cause and fix:

1. **The real problem was the material, not the color.** Round 2 built
   each crack as two stacked `THREE.MeshBasicMaterial` meshes (a wide
   translucent "glow" + a narrow opaque "core"), both flat solid colors.
   Flat solid color with transparency reads as *dull*, not *glowing*, even
   with the exact right hex value — there's no falloff. Replaced both with
   a **single mesh per crack, UV-mapped to a shared gradient texture**
   (`getCrackGlowTexture`, module-level cached `THREE.CanvasTexture`: an
   8x128 canvas painted with a vertical gradient — transparent at the
   edges, rising through the glow color, white-hot at the dead center) and
   `THREE.AdditiveBlending`. A true soft falloff plus additive blending is
   what actually reads as "glowing" — this was validated first by
   live-patching the loaded page (building one prototype ribbon with the
   gradient texture before touching `index.html`) and only ported into the
   real `copito.buildCrackDecal`/`buildCrackRibbonMesh` once the live
   result matched what the user had asked for.
2. **Broader + longer:** `CONFIG.crackCoreWidth`/`crackGlowWidth`/
   `crackGlowOpacity` (two separate widths for the old two-mesh approach)
   collapsed into one `CONFIG.crackWidth: 0.09` (up from the old
   0.02/0.05) for the new single-mesh ribbon, and every slot's `sweep` in
   `CRACK_SLOTS` was widened (torso slots 1-4: 85°/70°→100°/85°, upper
   slots 6/7: 48°→60°) so each crack reaches further around the body
   toward its edge, per "make it a bit more longer to the boarder."
3. **`CONFIG.colors.crackCore` dropped** — the old dark "core" color is no
   longer needed since the gradient texture's own white-hot center
   supplies that contrast; only `crackGlow` ('#7DF9FF', unchanged) remains.
- **Tested this session:** fresh-tab console clean throughout (ruled out
  the known stale-console-NaN red herring by cross-checking a new tab, see
  the lesson above); `buildCrackDecal` confirmed returning a single `Mesh`
  with the gradient texture as its `map` for every slot; full hit
  progression driven through the real `onHit` path (not just manually
  toggling decals) for type 3 — hit 1 shows slot 1 only, hit 2 adds slot 2,
  hit 3 fires `snowman-destroyed` and resets `hitCount`/hides all decals —
  each state screenshotted and visually matching the broader/glowing look
  the user approved; type 7 checked separately with all six slots shown at
  once to confirm the wider sweep doesn't make them collide awkwardly.
- **Lesson:** debugging a camera framing issue during this round's
  screenshot testing (a hand-rolled test camera facing backwards despite a
  mathematically-verified-correct quaternion) burned real time before
  switching to just repositioning the scene's existing default camera
  entity instead of fighting a new one — same category as the earlier
  near-clip lesson: when a screenshot looks wrong, suspect the *camera
  setup* before the geometry, and prefer reusing a camera A-Frame is
  already driving over hand-building a new one when scripting tests.

<details>
<summary>Original step 4 brief (superseded by the DONE notes above)</summary>

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

</details>

**Step 5 — explosion + respawn: DONE.** Branched off
`step-4-hit-reactions-and-packing` (not `main`) since the explosion logic
needed step 4's hit-state machine to hook into; rebased onto `main` once
step 4 merged (`#3`), so the branch history is linear.

- **Hooks into step 4's existing event contract, no new one needed.**
  `copito.onHit` already emitted `snowman-destroyed` on `#copito` once
  `hitCount` reached `CONFIG.hitsToExplode` and then reset state
  immediately — this step's `copito.startExplosion` listens for that same
  event (on the same `el`, self-emit/self-listen, same pattern as
  `snowball-hit`) and does the real thing instead. The `hitCount`/crack
  reset moved from `onHit` to `finishRespawn` so Copito stays visibly
  destroyed for the full `respawnDelay` instead of snapping back instantly.
- **Built inside `copito` itself, not a separate `explosion-fx` component**
  (deviation from the original spec's one-component-per-job layout). Step 4
  had already established the pattern of one component owning build + idle
  animation + hit state for this snowman; splitting explosion/respawn into
  a separate component would mean constantly reaching back into `copito`'s
  internals (`hitPivot`, `model`, `shadow`, `alive`) from outside, which is
  worse than just extending the component that already owns all of it.
  `copitoRegistry`'s per-instance design (step 4's multi-snowman
  future-proofing) still works fine this way — nothing here assumes a
  single global snowman.
- **`alive` flag gates hit detection.** `snowball-thrower.findHitSnowman`
  now skips any registered snowman with `alive === false`, so a snowball
  can't score a hit on a hidden, mid-explosion/respawn body. Set false in
  `startExplosion`, back to true in `finishRespawn`.
- **Hiding Copito**: `hitPivot.object3D.visible = false` hides the model
  *and* the crack decals in one call — `THREE.Object3D.visible = false`
  stops the renderer from traversing into children too, and both live
  inside `hitPivot`. The blob shadow and idle sparkles are siblings outside
  that subtree (shadow directly under `el`, sparkles on `el.object3D`
  itself), so they need their own explicit hide/show alongside it —
  confirmed this the hard way by first forgetting the shadow in an early
  pass, visible as a shadow sitting alone with nothing above it.
- **Chunks**: two `THREE.InstancedMesh` pools (mint snow lumps =
  `IcosahedronGeometry`, cyan ice shards = `OctahedronGeometry`), split
  evenly across `CONFIG.chunkCount` (50), built once in `copito.init` and
  reused every explosion (parked at scale 0 off-screen between uses, not
  created/destroyed). Distributed across the model's height band
  (`CONFIG.snowmanHeight`) from the snowman's own world position, not
  per-part anchors — no separate "parts" on this fused mesh, same
  constraint as steps 2/4. Each chunk Euler-integrates gravity, bounces
  once at `y = 0` with damping (`CONFIG.chunkBounceDamping`), then shrinks
  to 0 over `CONFIG.chunkFadeDuration` (1.5s) after the bounce — scaling to
  nothing substitutes for a true per-instance alpha fade, which
  `InstancedMesh`'s one shared material can't do without a custom shader;
  reads the same at this chunk size.
- **Comfort rule implemented structurally, not as a per-frame check.**
  `copito.biasAwayFromCamera` mirrors any chunk direction that would point
  toward the live camera position back away from it, at spawn time — so no
  chunk's velocity ever has a toward-player component to begin with, rather
  than clamping/checking distance every frame. Verified in-browser: after
  an explosion, `max(chunk.velocity.z)` across all 50 chunks was negative
  (away from the camera at the time), with the bias recomputed fresh from
  the camera's actual position each explosion (not a fixed `+Z` assumption,
  so it still holds if the player has moved). **Not yet verified on an
  actual headset** — the structural guarantee hasn't been checked against
  real head tracking, only a static desktop camera.
- **Sparkle burst, light flash, haptics**: `buildExplosionBurst` is the
  same reused-`THREE.Points`-buffer pattern as `buildSnowPuffs`, just
  bigger (`CONFIG.explosionSparkleCount`, 250) and additive-blended. A
  `THREE.PointLight` (`buildExplosionLight`) spikes to
  `CONFIG.explosionFlashIntensity` for `CONFIG.explosionFlashDuration`
  (150ms) and decays — no full-screen flash, per spec. Both hand
  controllers get `CONFIG.haptics.explosion` (`[1.0, 150]`) via the same
  guarded `pulseHaptics` helper throw/hit already used — hoisted it to a
  module-level function (was a `snowball-thrower`-only method) once a
  second caller needed the identical gamepad-lookup guard, rather than
  duplicating it.
- **Respawn**: `hitPivot` scale animates 0 → 1 with an overshoot "pop"
  (`easeOutBack`, new module-level easing helper) over
  `CONFIG.respawnPopDuration` (0.6s), safe to drive directly rather than as
  a delta like bob/sway/squash since nothing else is competing for
  `hitPivot`'s scale at that point (hit impulses have long since decayed).
  `destroyedCount` increments on `finishRespawn` — no HUD to show it yet
  (step 7's job), but the count isn't lost.
- **`respawnDelay` lowered from the spec's 2.5s default to 1.5s** at
  the user's request after a first look — felt slow. `respawnPopDuration`
  left at 0.6s.
- **Debugging note, logged so a future session doesn't re-chase this:** a
  `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN`
  console error appeared intermittently during this session's testing, but
  **only** when test scripts manually stepped `copito.tick(fakeTime, 16)`
  in a loop *interleaved* with the pane's own real automatic tick loop
  (confirmed running continuously in this environment — budget the note
  above about "`requestAnimationFrame` never fires on its own" from step
  3's testing as no longer accurate here, or specific to a since-changed
  pane behavior). Mixing a manually-incremented fake clock with the page's
  real wall-clock ticks makes `time` non-monotonic across calls, and that's
  what triggered it. Three separate clean runs using *only* the real tick
  loop (trigger via `onHit`/an actual throw, then just let real time pass)
  produced zero console errors through a full explosion → chunk-bounce →
  fade → respawn-pop cycle. Same category as step 4's hot-swapped-config
  false alarm: a test-harness artifact, not a bug in the shipped code — but
  flagging it so it's recognized immediately if seen again rather than
  re-investigated from scratch.
- **Tested this session**: hit-3 → explosion trigger (state transitions
  idle → exploding → respawning → idle, confirmed via direct state
  inspection), `alive`/hit-detection gating during explosion
  (`findHitSnowman` returns `null` for a snowman mid-explosion), all 50
  chunks activate/bounce/fade/deactivate cleanly with zero leaked NaN in
  the instance matrices, burst + light flash fire and decay to off, both
  haptics calls guarded correctly with no controller present, respawn pop
  completes and hit detection resumes normally on the next hit
  (`hitCount` correctly reset, crack decals correctly hidden), comfort-rule
  bias confirmed structurally (see above). Screenshots confirm idle,
  mid-explosion, and mid-respawn-pop frames all render as expected with the
  surrounding scene (sky/ground/fog) unaffected. **Not yet tested on an
  actual Quest 2 headset** — same outstanding item as every step since
  step 3, plus the comfort-rule caveat above.

**Step 5 bis — wave/level director (new, not in the original spec): DONE.**
Branched off `main` as `step-5bis-wave-director`. Built per the design below
(unchanged from the planning session) -- the "Planned build order" note
originally called for two separate layers/branches, but the whole thing
turned out small enough to land in one pass once started.

- **What it's for:** today there's exactly one snowman, always in the same
  spot. This turns that into a wave-based level system — waves 1 and 2
  spawn a single snowman each (same mechanic, different spawn point each
  time, to teach that the position varies); from wave 3 on, multiple
  snowmen spawn simultaneously and the count scales up (2, 3, 4, 5...).
  The user's own example went up to 5 but explicitly said that's not a hard
  cap — the table just keeps going if wanted later.
- **Data-driven wave table, not branching code:** an ordered array of
  `{count, types}` rows. `types` picks each snowman's `hitsToExplode` via
  the existing 1/3/5/7 "lives" system from step 4 — no new mechanic needed,
  just reused per-instance. Early waves use type 1 (fast, builds
  confidence); later waves mix in 3/5/7 for variety and pacing, not just
  raw count.
- **New `wave-director` component** (likely on `<a-scene>`) is the only new
  piece — everything else it touches already exists:
  - Owns the wave index, an alive-this-wave counter, and score. Reacts only
    to the `snowman-destroyed` event `copito` already emits (step 4's
    contract, reused again here) — never reaches into
    `copito`/`snowball-thrower` internals directly.
  - On wave start: asks a spawn-placement utility for N points, activates N
    `copito` instances there via the existing `copitoRegistry` pattern
    (step 4's multi-snowman future-proofing — confirmed in this session's
    design pass that it was built exactly for this and needs no changes).
  - On each `snowman-destroyed`: adds a destroy bonus scaled by that
    snowman's `hitsToExplode` (a type-7 kill is worth more than a type-1),
    decrements the counter; at zero, adds a wave-clear bonus (plus a small,
    intentionally low-stakes soft-timer bonus — no fail state, no countdown
    UI, per the user: "could be soft time but not too exigent... nor
    important for now") and starts the next row.
- **Spawn placement rules** (a new utility, independent of the director so
  it's reusable elsewhere later): radius band roughly 3-7m from the player
  (inside the fog-clear zone, `fog far: 7.9`, and well inside the ground
  disc, `radius: 9.5`); a frontal arc rather than full 360°, narrower on
  early waves and wider once a wave has several simultaneous snowmen;
  minimum separation between points placed in the same wave so simultaneous
  snowmen don't overlap or crowd one spot. Implemented as rejection
  sampling — pick a radius+angle, retry if it's too close to an existing
  point or past the edge/fog margin.
- **Deliberately written to be player-movement-compatible even though the
  player is stationary for now** (the user: "for now stationary, let's see
  in the future"): every spawn point is computed from the camera's *live*
  world position/facing at spawn time, never from a fixed world constant —
  the same pattern step 5's `biasAwayFromCamera` already uses for explosion
  chunk direction. Today that's equivalent to the old hardcoded
  `snowmanDistance = -5` since the camera never moves, but nothing here
  needs rework if/when the player gains locomotion later.
- **Explicitly out of scope for this step: snowmen actually moving toward
  the player.** The design reserves a `state` field and a `moveSpeed` (0
  for now) per snowman, and reuses the same minimum-radius bound as a
  future "stop distance," but no movement code is planned yet — just not
  blocked by this step either.
- **Implementation notes (deviations from the plan are all additive, nothing
  above was dropped):**
  - `copito` gained a schema: `hitsToExplode` (per-instance override of
    `CONFIG.hitsToExplode`, 0 = "use the CONFIG default") and `managed`
    (true for wave-director's pool entities). Every internal
    `CONFIG.hitsToExplode` read inside `copito` became `this.hitsToExplode`
    -- the crack-slot system (`getCrackSlotsForLives` etc.) was already
    written generically per PROGRESS's own note that step 4 built it to
    scale with `hitsToExplode`, so this was a pure threading change, no
    redesign needed.
  - **A managed snowman does not self-respawn in place.** Standalone use
    (declaring `copito` with no `managed` attribute, the old
    single-snowman way) is untouched -- it still auto-respawns after
    `respawnDelay` exactly as step 5 built it. A managed one instead goes
    hidden/non-alive and stays that way once its post-explosion
    `respawnDelay` elapses (new `snowman-cleared` event, instead of the
    standalone path's pop-back-to-visible), until wave-director's new
    `copito.activateForWave(position)` method explicitly brings it back --
    the director decides if/when/where a pool slot gets reused, not the
    snowman itself. This wasn't an explicit call in the original design
    notes but followed necessarily from "the director owns activation":
    letting a killed snowman silently reappear in its old spot mid-wave
    (or after the next wave had already started) would have produced
    duplicate/stray live snowmen.
  - **Pool entities are reused by type, not recycled generically.** `copito`
    instances build their crack-decal meshes once at init from their own
    `hitsToExplode` (step 4's design, unchanged) -- reconfiguring an
    instance's type after the fact would mean rebuilding that geometry, so
    wave-director keeps one pool per type (`this.pools[hitsToExplode]`)
    and grows a given type's pool lazily rather than trying to re-skin an
    arbitrary free entity. Matches the plan's "activates N copito
    instances... via the existing copitoRegistry pattern" without needing
    per-activation type changes.
  - `wave-director` deliberately has **no `tick()`** -- every state change
    it reacts to is event- or timer-driven (a kill, a freed pool slot, an
    intermission timeout), so it runs entirely on `performance.now()` +
    `setTimeout` instead. This was a real debugging finding, not just a
    style choice: with an early tick-based version, merely having wave-
    director attached to `<a-scene>` as a *second* tick-bearing component
    (`snowball-thrower` is the first) reproducibly shifted the very first
    frame's component/render ordering enough to make the desktop
    `trajectory-preview` instance raycast against a momentarily-invalid
    camera projection matrix, producing one NaN position written into its
    dots buffer. The actual fix that landed is in `trajectory-preview`
    itself (see next bullet) -- going tick-free in wave-director is a
    separate, independently-good simplification kept alongside it.
  - **New general hardening in `trajectory-preview.tick()`'s desktop
    branch:** after computing `scratchOrigin`/`scratchDir` from the
    raycaster, both are now checked with `isFinite` before being used --
    if either is non-finite (seen in testing on the very first tick,
    before the canvas has a real size for the camera's projection matrix
    to be valid), the frame is skipped (`setVisible(false); return;`)
    instead of writing NaN into the dots geometry. This matters because
    THREE caches a `BufferGeometry`'s `boundingSphere` once computed --
    including a bad one -- and doesn't recompute it on later attribute
    updates, so a single bad frame would otherwise leave a permanent
    `Computed radius is NaN` console error even though every subsequent
    frame's data is fine. Confirmed via bisection that this exact
    first-frame race is not new (reproduces with any sufficiently large
    script added before the first render, not specifically anything in
    wave-director's own logic) but was never hit before wave-director's
    code made the file large enough to shift the timing -- so the guard
    belongs in `trajectory-preview` itself, not worked around upstream.
  - Pool reuse and the multi-type crack/hit-count threading were verified
    directly against the real event-driven code paths (not reimplemented
    test logic): scripted `snowball-hit` events were emitted on live
    `copitoRegistry` entries to drive waves 1-3 through real kills (type-1
    one-hit kills, pool slot correctly reused on the next wave once its
    explosion+respawn cycle finished), and `wave-director.startWave(5)`
    was called directly to jump to a `{count:3, types:[1,3,3]}` row and
    confirm a type-3 snowman takes exactly 3 hits (crack decals appearing
    on hits 1-2) before exploding, matching step 4's existing crack system
    with no changes needed there. Zero console errors across a fresh page
    load and this full scripted sequence.
- **Not yet tested:** an actual Quest 2 headset, same outstanding item as
  every step since step 3. Also not verified on-device: whether the
  desktop-only `trajectory-preview` NaN-guard fix above also mattered for
  the hand sources in VR (their own fallback path reads a hand entity's
  `object3D` directly, a different code path from the desktop raycaster,
  so it's a different -- and so far unconfirmed -- question whether it was
  ever actually at risk the same way).

**Step 5 bis follow-up round (same session, after the user's first look):**
three requests, all folded into the same branch:

1. **Harder ramp + 2 more rows.** `WAVE_TABLE` went from 10 to 12 rows and
   the early pacing was tightened: wave 1 is still a single type-1 snowman
   (kept as a quick, readable intro), but wave 2 now brings a second
   snowman immediately (previously another single one) and type-3 shows up
   by wave 3 instead of wave 4. Every later row shifted correspondingly
   tougher. `CONFIG.waveMaxConcurrentSnowmen` (8) and the spawn-placement
   band were already generous enough to not need changing for the new
   7-snowman top row.
2. **Snowmen now always face the camera**, not just at spawn. New
   `copito.updateFacing()`, called every tick (all explosion states,
   cheap): yaw-only, applied to `el` itself (never the model
   wrapper/hitPivot, which stay free for idle sway/hit wobble) via
   `atan2(dx, dz)` toward the camera's live world position. Relies on the
   model's unrotated rest pose already facing local +Z -- confirmed
   visually from the original single-snowman placement, which had no
   rotation attribute and always faced the camera dead-on when spawned
   directly ahead. This was a real gap the old fixed single-spawn-point
   setup never exposed: once wave-director scattered snowmen across a wide
   arc, anything off-angle would otherwise show its side/back by default.
   Verified in-browser across a 6-snowman wave (type mix `[3,5,5,7,7,7]`,
   wide arc) -- every spawn point reads front-on in the screenshot.
3. **How to show wave/score in VR, asked but not yet built:** recommended
   a world-space HUD anchored to the camera entity (plain A-Frame
   `<a-text>`/plane, fixed local offset so it follows head movement) since
   a 2D page overlay (like the existing `#credit` div) isn't visible inside
   the headset -- this is exactly what step 7 ("HUD + i18n") below already
   covers, including the VR-comfort caveat (don't lock it dead-center;
   peripheral placement avoids the head-locked-UI nausea issue). Not
   implemented this round -- the user was asking for an approach, not
   requesting the build yet.

**Step 6 — sound + haptics: not started.** Same access problem as the sky
image is likely for Kenney/Freesound — the user will probably need to
download the Kenney Impact Sounds zip and the Freesound wind clip themselves
(same workaround: their browser, save to this project folder, Claude reads it
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

## Open judgment calls for the user (not yet decided)

- Ground is now textured + circular + mirror-tiled and considered settled
  for now; revisit only if the user flags something specific about it.
