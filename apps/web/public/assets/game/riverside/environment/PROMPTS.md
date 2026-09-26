# Thai Riverside Environment Prompts

All assets were generated with the built-in OpenAI `image_gen` tool. The two references are used only for art direction and mood; each output is an original modular game environment asset.

Runtime textures were reduced with the project's existing `sharp` package to control mobile memory: sky 768×432, each house 350×234, corridor 768×160, and water/boardwalk 768×210. Original-resolution images are kept in the local coordination artifact, outside `public/`.

## Runtime: `sky-temple-night.webp`

```text
Use case: stylized-concept
Asset type: modular 2D game environment background layer, wide panoramic raster
Primary request: Create an original painterly Thai riverside night sky with a soft full moon, layered indigo clouds and haze, distant palm silhouettes, and a graceful original Thai temple silhouette on the horizon. Use the supplied riverside images only as style and mood references; do not copy their exact composition.
Input images: Image 1 is the painterly style anchor; Image 2 is the Thai riverside mood reference.
Scene/backdrop: Deep blue night atmosphere above a riverside village, with the temple low on the horizon and a broad quiet sky.
Style/medium: polished hand-painted game background, soft brush texture, collectible adventure-game finish.
Composition/framing: 16:9 panoramic composition with generous horizontal overscan; moon in the upper-left third; temple clustered around the center horizon; center kept calm and uncluttered so portrait crops still retain moon, haze, and temple; no foreground architecture.
Lighting/mood: tranquil, inviting moonlight with very restrained warm temple pinlights.
Color palette: midnight indigo, muted teal-blue, smoky slate, soft moon cream, tiny warm amber accents.
Constraints: original artwork; game-friendly low contrast behind combat; no characters, animals, text, logos, UI, borders, or watermark; no blood or violence.
Avoid: photorealism, neon colors, busy stars, dominant black shapes, sharp high-frequency detail in the central combat area.
```

## Runtime: `stilt-houses-left.webp`

```text
Use case: stylized-concept
Asset type: modular transparent 2D game environment edge layer
Primary request: Create an original cluster of traditional Thai wooden stilt houses and riverside vegetation designed to frame the left edge of a game scene. Use the supplied riverside images only as style and mood references; do not copy their exact buildings or layout.
Input images: Image 1 is the painterly style anchor; Image 2 is the Thai riverside mood reference.
Scene/backdrop: Left-edge stilt house silhouettes with teak posts, terracotta roof edges, a small indigo woven cloth, banana leaves, clay water jars, baskets, and two softly glowing woven lanterns.
Style/medium: polished hand-painted game environment asset with clean readable silhouettes and subtle brush texture.
Composition/framing: tall left-heavy cluster occupying the left half, with architecture cropped naturally at the far left and negative transparent space opening toward the right; enough vertical detail for portrait overscan; no floor spanning the full image.
Lighting/mood: moonlit blue shadow with localized soft amber lantern glow; welcoming and calm.
Color palette: deep indigo, desaturated teak brown, muted terracotta, dark tropical green, restrained amber.
Constraints: genuinely transparent background around the isolated house cluster; original artwork; restrained contrast toward the open right side; no characters, animals, text, logos, UI, borders, or watermark.
Avoid: photorealism, symmetrical facade, excessive lantern bloom, modern objects, solid rectangular background, copied reference composition.
```

## Runtime: `stilt-houses-right.webp`

```text
Use case: stylized-concept
Asset type: modular transparent 2D game environment edge layer
Primary request: Create an original cluster of traditional Thai wooden stilt houses and riverside vegetation designed to frame the right edge of a game scene. Use the supplied riverside images only as style and mood references; do not copy their exact buildings or layout.
Input images: Image 1 is the painterly style anchor; Image 2 is the Thai riverside mood reference.
Scene/backdrop: Right-edge stilt house silhouettes with teak posts, layered terracotta eaves, an indigo woven cloth, potted jasmine, banana leaves, pottery, wicker fish traps, and two softly glowing woven lanterns.
Style/medium: polished hand-painted game environment asset with clean readable silhouettes and subtle brush texture.
Composition/framing: tall right-heavy cluster occupying the right half, with architecture cropped naturally at the far right and negative transparent space opening toward the left; enough vertical detail for portrait overscan; no floor spanning the full image.
Lighting/mood: moonlit blue shadow with localized soft amber lantern glow; welcoming and calm.
Color palette: deep indigo, desaturated teak brown, muted terracotta, dark tropical green, restrained amber.
Constraints: genuinely transparent background around the isolated house cluster; original artwork; restrained contrast toward the open left side; no characters, animals, text, logos, UI, borders, or watermark.
Avoid: photorealism, symmetrical facade, excessive lantern bloom, modern objects, solid rectangular background, copied reference composition.
```

## Runtime: `quiet-central-corridor.webp`

```text
Use case: stylized-concept
Asset type: modular transparent 2D game environment midground layer
Primary request: Create an original quiet Thai riverside village corridor for a 2D combat scene: distant low stilt homes, a narrow water channel, soft mist, sparse palms, short dock posts, and subtle warm window reflections. Use the supplied riverside images only as style and mood references; do not copy their exact composition.
Input images: Image 1 is the painterly style anchor; Image 2 is the Thai riverside mood reference.
Scene/backdrop: Calm midground village corridor that visually connects left and right edge houses while leaving the center readable for a trainer, rooster, and monsters.
Style/medium: hand-painted game environment layer, atmospheric perspective, simplified shapes, soft edges.
Composition/framing: wide 16:9 panoramic strip with strong horizontal overscan; low village silhouettes confined mostly to the outer thirds; broad central opening with low contrast and minimal detail; usable in portrait by cropping the middle; isolated layer with transparent sky above and transparent foreground below.
Lighting/mood: peaceful moonlit haze with a few dim amber windows and reflections.
Color palette: blue-indigo, muted teal, smoky gray-blue, restrained amber.
Constraints: genuinely transparent background outside the painted midground shapes; original artwork; keep combat lane quiet; no characters, animals, text, logos, UI, borders, or watermark.
Avoid: large central building, high contrast in the center, photorealism, hard black silhouettes, excessive lights, copied reference composition.
```

## Runtime: `water-lotus-boardwalk.webp`

```text
Use case: stylized-concept
Asset type: modular transparent 2D game environment foreground layer
Primary request: Create an original Thai riverside foreground layer with dark moonlit water, gentle ripples and amber reflections, lotus leaves and a few pink lotus blossoms near the lower corners, plus a sturdy teak boardwalk combat lane with posts and rope details. Use the supplied riverside images only as style and mood references; do not copy their exact composition.
Input images: Image 1 is the painterly style anchor; Image 2 is the Thai riverside mood reference.
Scene/backdrop: Water across the lower field, a clear horizontal teak boardwalk across the middle-lower band, and lotus clusters framing the bottom corners.
Style/medium: polished hand-painted game environment, readable stylized materials, subtle brush texture.
Composition/framing: wide 16:9 panoramic layer with generous horizontal overscan; straight stable boardwalk lane with a broad uncluttered center for combat; lotus and decorative detail concentrated at the far left, far right, and bottom; transparent upper half for compositing over sky and midground.
Lighting/mood: cool moonlit water with narrow restrained amber reflections; inviting and adventurous.
Color palette: deep teal-blue water, weathered dark teak, moss green lotus leaves, small dusty-pink blossoms, restrained amber reflections.
Constraints: genuinely transparent background above the painted water and boardwalk; original artwork; no actors or creatures; no text, logos, UI, borders, or watermark; no blood or violence.
Avoid: photorealism, bright white water, oversized flowers in the combat lane, crooked or broken boardwalk, clutter across the center, copied reference composition.
```
