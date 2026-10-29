# Assets

Every non-code asset used in this demo, where it came from, and its license. Licenses are listed per asset; required attribution is included below.

## 3D model

| File | Source | Author | License |
|---|---|---|---|
| `assets/models/copito/scene.gltf` + `scene.bin` + `textures/*` | [Snowman](https://sketchfab.com/3d-models/snowman-7d683ce4a9c54f158cc73d65a16a9a29), Sketchfab | [alixor22](https://sketchfab.com/alixor22) | CC-BY-4.0 |

**Required credit** (must be shown wherever this is shared, per the license):
> This work is based on "Snowman" (https://sketchfab.com/3d-models/snowman-7d683ce4a9c54f158cc73d65a16a9a29) by alixor22 (https://sketchfab.com/alixor22) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

Provided by the user as a CC-BY download (originally FBX + a separate glTF export); only the glTF export is used (`scene.gltf`/`scene.bin`, 1 mesh, ~8,900 triangles, 3 PBR textures: base color, metallic/roughness, normal). The type-3/5/7 base-color variants in the same texture folder are derived recolors of that original texture, used as difficulty cues. This replaces the original hand-built primitive snowman design from earlier in the build. Single fused mesh, so later steps (idle animation, hit reactions) treat it as one rigid body rather than animating individual sub-parts (eyes, crown, etc. aren't separately addressable the way the primitive version was).

Internal in-code naming ("Copito") is kept as a project nickname only, unrelated to this asset's own title.

## Sky

| File | Source | Author | License |
|---|---|---|---|
| `assets/sky/sky.jpg` | [Passendorf Snow HDRI](https://polyhaven.com/a/passendorf_snow), Poly Haven | Poly Haven | CC0 |
| `assets/sky/sky2.jpg` | [Snowy Park 01 HDRI](https://polyhaven.com/a/snowy_park_01), Poly Haven | Oliksiy Yakovlyev | CC0 |
| `assets/sky/sky3.jpg` | [Snowy Forest Path 01 HDRI](https://polyhaven.com/a/snowy_forest_path_01), Poly Haven | Oliksiy Yakovlyev | CC0 |

Downloaded as `passendorf_snow_4k.hdr` (4096x2048, 23.5 MB) and converted locally: tone-mapped to 8-bit with OpenCV's Reinhard operator (gamma 2.2), saved as JPG at quality 85, final size 0.88 MB. Poly Haven only offers one fixed-resolution "tonemapped JPG" export per asset (not a 4096x2048 option directly), so downloading the HDR at our target 4096x2048 resolution and tone-mapping it ourselves was the practical path to hit the size budget without upscaling or re-downscaling a larger JPG.

The raw `passendorf_snow_4k.hdr` is kept in `assets/sky/` for reference; only `sky.jpg` is referenced by `index.html`.

The second sky variant was downloaded as `snowy_park_01_4k.hdr`; the third now uses `snowy_forest_path_01_4k.hdr` in place of the overexposed `snowy_hillside_4k.hdr`. Both were tone-mapped with OpenCV Reinhard (gamma 2.2) and saved as `sky2.jpg` / `sky3.jpg` at 4096x2048 with 650x650 foreground-snow crops saved as `ground2.jpg` / `ground3.jpg`. The forest panorama's horizon color was sampled for its fog value in `js/config.js`.

## Sound

| File | Source | Author | License |
|---|---|---|---|
| `assets/audio/rayadito-xc1075472.mp3` | [Xeno-canto XC1075472](https://www.xeno-canto.org/1075472), Thorn-tailed Rayadito (*Aphrastura spinicauda*), Parque Tepuhueico, Chiloé, Chile, 2025 | Marc Anderson | [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) |
| `assets/audio/chucao-xc1075454.mp3` | [Xeno-canto XC1075454](https://www.xeno-canto.org/1075454), Chucao Tapaculo (*Scelorchilus rubecula*), Parque Tepuhueico, Chiloé, Chile, 2025 | Marc Anderson | [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) |
| `assets/audio/steps/snow-step-01..08.ogg` | 8 of the [41 snow shoe steps](https://opengameart.org/content/41-snow-shoe-steps) (originals 23, 27, 33, 17, 25, 22, 41, 18), extracted from [Freesound #29876](https://freesound.org/s/29876/) | Corsica_S (recording), Iwan Gabovitch (extraction) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

**Bird recordings (NoDerivatives):** both files are the original
xeno-canto downloads, byte-for-byte unmodified (only renamed). The
license allows sharing the material "in whole or in part" but not
sharing adapted versions, so nothing is cut, filtered or re-encoded in
the repo. `sound-manager.js` plays only short excerpts (start/end times
in `BIRD_SPECIES`), and applies fades, a highpass, distance filtering
and 3D placement at playback time. NonCommercial: fine while this
project stays free; confirm with the recordist before any use that
could count as commercial.

**Attribution:** "Thorn-tailed Rayadito (Aphrastura spinicauda),
XC1075472" and "Chucao Tapaculo (Scelorchilus rubecula), XC1075454" by
Marc Anderson, via xeno-canto, licensed under CC BY-NC-ND 4.0.

**Snow steps:** trimmed to the step, peak-normalized, converted to mono
Ogg Vorbis. CC0, no attribution required (credited anyway).

**Synthesized in code:** the throw swish, snowball impacts and the wind
bed are generated with plain JS at audio unlock (no sample files).
