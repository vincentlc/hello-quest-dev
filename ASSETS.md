# Assets

Every non-code asset used in this demo, where it came from, and its license. CC0 by default, with one explicit CC-BY exception below (the 3D model), used by the user's choice and credited as its license requires.

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

Downloaded as `passendorf_snow_4k.hdr` (4096x2048, 23.5 MB) and converted locally: tone-mapped to 8-bit with OpenCV's Reinhard operator (gamma 2.2), saved as JPG at quality 85, final size 0.88 MB. Poly Haven only offers one fixed-resolution "tonemapped JPG" export per asset (not a 4096x2048 option directly), so downloading the HDR at our target 4096x2048 resolution and tone-mapping it ourselves was the practical path to hit the size budget without upscaling or re-downscaling a larger JPG.

The raw `passendorf_snow_4k.hdr` is kept in `assets/sky/` for reference; only `sky.jpg` is referenced by `index.html`.

## Sound

Not sourced yet (step 6 of the build). Plan: Kenney Impact Sounds pack (CC0) for hit thuds/cracks/shatter, Freesound CC0 clip for wind ambience, and a few effects (throw whoosh, respawn chime) synthesized directly with the Web Audio API since no suitable CC0 sample was found quickly for those. Will be filled in with exact files/authors/links once downloaded.
