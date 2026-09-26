# Art credits

The original art in `scene/`, `sprites/`, `monsters/`, and `items/` is
hand-authored SVG made for the RFC Legends vertical slice. The new `/game`
art in `game/riverside/` is original artwork generated with OpenAI's built-in
`image_gen` tool and then optimized for runtime. No third-party asset packs
were embedded or traced.

- **Legacy palette source:** project brand tokens defined in
  `apps/web/src/app/globals.css` (`--field`, `--field-deep`, `--sun`,
  `--sun-soft`, `--clay`, `--clay-deep`, `--cream`, `--bark`, `--bark-soft`),
  extended with rice-field greens (young rice `#7CB342`, deep paddy
  `#33691E`/`#3E6130`) and a single shared ink outline (`#2B1B12`) used on
  every character, monster and prop so the cast reads as one family.
- **Legacy style inspiration:** the cute, flat, outline-based look popularized by CC0
  game-asset creators such as Kenney (kenney.nl). Only the general aesthetic was
  referenced for inspiration — no Kenney (or any other) asset was copied,
  traced, derived from or embedded. Every path in this directory was drawn from
  scratch for this project.
- **Legacy format:** the original art files are plain vector SVG with honest
  viewBoxes, transparent backgrounds (except the full-bleed scene layers
  `sky/paddy/ground/hills`), no embedded raster data and no external references.
- **Riverside art direction:** `ref/thai-riverside-concept-v2.png` and the
  generated moonlit khlong keyframe were used only for palette, mood, materials,
  and lighting. They are not shipped as game backgrounds and no source image was
  copied or traced. The environment is split into composited layers; characters,
  creatures, props, and items are separate transparent sprites/icons.
- **Prompt provenance:** exact image prompts and image-processing notes are in
  `game/riverside/{environment,characters,creatures,props,items}/PROMPTS.md`.
  Runtime images use alpha WebP for the environment and characters, and
  palette-optimized PNG for creature, prop, and item artwork. Textures were
  sized to keep mobile decoding lean; no dependency was added.
- **Card rarity gem code:** the corner gems on framed cards encode rarity —
  violet `#7C4DBE` = Monster Card (1001-1003), gold `#FFD766` = Legendary
  trim (2001-2003), red `#D14B3D` = MVP (3001). Same code across the family.
- **Cloud variants:** `scene/cloud1.svg` (puffy cumulus), `scene/cloud2.svg`
  (long stratus for wide parallax drift), `scene/cloud3.svg` (tall cotton
  cluster) are standalone transparent clouds for the engine lane; `sky.svg`
  keeps its own embedded clouds for the static backdrop.
