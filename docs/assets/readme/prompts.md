# README image prompts

These project images were generated with Codex's built-in `image_gen` tool. The prompts and correction passes below describe the saved illustrations. Labels and connections were checked against the repository implementation; accompanying README text provides the detailed rules.

The gameplay screenshot and logo in the README are existing project assets.

## Architecture

Output: `architecture.png`.

### Generation

```text
Use case: infographic-diagram
Asset type: GitHub README system architecture diagram, landscape PNG at approximately 1920 x 1200.
Primary request: Create a precise, polished architecture diagram for "RFC Legends". This is a real engineering diagram. Typography, boxes, and arrow topology are more important than decoration.
Style: clean editorial technical diagram, warm ivory background, deep forest-green text, muted green application cards, amber blockchain cards, teal integration cards. Flat vector-like look, large crisp sans-serif labels, generous whitespace, rounded rectangle cards, thin directional arrows. Tiny tasteful rooster silhouette beside title only. No perspective or 3D.
Title: "RFC Legends"
Subtitle: "System architecture"
Composition: THREE horizontal bands with 3 columns, no intersecting arrows. Left-to-right main path in top band: "PLAYER" card, "NEXT.JS SERVER" card, "POCKETBASE" card.
PLAYER card lines: "Next.js + Phaser", "Wallet / wagmi", "World ID / IDKit".
NEXT.JS SERVER card lines: "Idle game engine", "Proof verification", "EIP-712 vouchers".
POCKETBASE card lines: "Players and drops", "Nullifier bindings", "Guild state and realtime".
Connect PLAYER to NEXT.JS SERVER labeled "HTTPS"; connect NEXT.JS SERVER to POCKETBASE labeled "Read / write".
MIDDLE BAND: wide left-center amber enclosure titled "ETHEREUM SEPOLIA". Inside clearly separated rows reading "HumanRegistry  |  Verified wallets", "RareItems  |  ERC-1155 drops", "RareMarket  |  90% seller / 10% treasury", "RoosterRWA  |  ERC-721 provenance", "ENSv2  |  Pedigree and farm records". Top band NEXT.JS SERVER connects downward to this enclosure labeled "Registry writes / chain reads". PLAYER connects downward along left edge to enclosure labeled "Mint / list / buy".
MIDDLE right: two integration cards stacked vertically, "WORLD ID" with "Server-side proof verification", and "MULTIBAAS" with "Event indexing / sale history". Arrow from NEXT.JS SERVER right/below edge to WORLD ID labeled "Verify proof"; arrow from Sepolia enclosure to MULTIBAAS labeled "Contract events". Use a return arrow from MULTIBAAS to NEXT.JS SERVER labeled "Query sales" if it can route clearly, otherwise omit this return arrow entirely.
BOTTOM BAND: single wide farm card "NINLANEE FARM + ISSUER" with "Farm co-signs registrations and health attestations" and "Issuer submits mints; farm writes scoped ENS health records". Arrow upward from farm card to bottom edge of Sepolia enclosure labeled "Signed provenance".
Footer: "Game state stays offchain. Ownership and settlement are onchain."
Constraints: render the exact labels, no invented services, no backend auto-mint arrows, no direct browser database write arrow, no World ID smart-contract verifier claim, no background ornament. All text readable when scaled to 1000px wide.
```

### Correction 1

```text
Edit only the connector labeled "Query sales" in this architecture diagram. It currently floats without connecting to MULTIBAAS. Replace it with one complete continuous connector FROM the top-left edge of the MULTIBAAS card, routed left through the empty vertical gutter between the SEPOLIA enclosure and the WORLD ID card, then upward and left, ending with its arrowhead at the bottom of the NEXT.JS SERVER card. Keep the "Query sales" label readable beside that connector. Do not cross the WORLD ID card, the SEPOLIA box, or other labels. Preserve every card, all other text, colors, typography, background, iconography, layout and dimensions exactly. No other changes.
```

### Correction 2

```text
Add exactly ONE missing connector to this diagram. Draw a thin dark-green arrow FROM the lower-right edge of the NEXT.JS SERVER card down slightly into the blank horizontal space ABOVE the WORLD ID card, then right, then down into the TOP of the WORLD ID card. Label it "Verify proof" in the blank space above WORLD ID. Route it ABOVE the existing "Query sales" connector so neither arrow crosses; it must stay below the POCKETBASE card. Arrowhead at WORLD ID. Preserve the complete existing "Query sales" connector from MULTIBAAS to NEXT.JS SERVER. Preserve every other existing pixel, label, box, arrow, dimension and the fully opaque ivory background. Do not remove or move any existing connector.
```

## Rare drop and market flow

Output: `rare-drop-flow.png`.

### Generation

```text
Use case: infographic-diagram
Asset type: GitHub README flowchart, landscape PNG approximately 1920 x 1200.
Primary request: A precise readable workflow for the RFC Legends rare item economy. Title "From rare drop to onchain sale". Subtitle "RFC Legends / verified minting and atomic settlement".
Style: premium restrained engineering infographic. Warm ivory background, dark forest-green text, pale green gameplay and backend cards, soft amber blockchain cards, terracotta rejection card. Flat vector-style rounded cards, crisp sans-serif labels, large type, thin arrow connectors and ample whitespace. No perspective, no decorative scene.
Layout: TWO horizontal rows, serpentine workflow with clear arrowheads. TOP ROW left to right: numbered card "1  EARN A DROP", text "Play and reach Base Lv 30" and "Legendary / Monster Card / MVP Card"; card "2  VERIFY HUMAN", text "IDKit + wallet signature", "Server verifies with World ID", "Bind nullifier; mirror to HumanRegistry"; diamond "3  ELIGIBLE?" with adjacent small checklist "Wallet ownership", "Verified human", "Base Lv 30+", "Owned, unminted rare drop", "Daily mint limit".
An arrow labeled "Fail" leaves the diamond to a small terracotta side card "REQUEST REJECTED" with "Show the failed check".
An arrow labeled "Pass" travels downward from the diamond into bottom right card "4  SIGN + MINT", with "Server signs EIP-712 voucher", "Wallet submits to RareItems", "Validate signer, expiry, human, dropId".
BOTTOM ROW right to left continues from step 4 to bottom center card "5  LIST + BUY", text "Verified seller escrows ERC-1155", "Buyer approves and pays MockUSDC", "RareMarket settles atomically".
Then bottom left card "6  SETTLEMENT", with two clearly separated figures "90% SELLER" and "10% TREASURY", and smaller text "Buyer receives the item". Example on a final line "2.00 MockUSDC = 1.80 + 0.20".
Connect step 1 -> step 2 -> step 3 -> step 4 -> step 5 -> step 6. All six numbered step headings visible once only. No arrow into the rejection card except the Fail edge. No other arrows.
Footer in readable text: "Sold events feed MultiBaas sale history. One dropId can mint only once."
Constraints: exact spelling of IDKit, HumanRegistry, EIP-712, RareItems, ERC-1155, MockUSDC, RareMarket, MultiBaas. Do not say buyers must be World ID verified. Do not imply the contract checks game level or daily limits; those are server checks at step 3. No real-money amounts or currency symbols. No extra claims or logos.
```

### Correction 1

```text
Correct this technical flowchart while preserving its layout, readable typography, colors, and wording except specified corrections.
1. Fix the Pass connector. It must leave step 3 ELIGIBLE and go RIGHT across the empty middle gutter, then DOWN into the TOP EDGE of step 4 SIGN + MINT. Remove the current downward Pass arrow that incorrectly points into step 5 LIST + BUY. The correct order is 1 -> 2 -> 3 -> 4 -> 5 -> 6; step 3 must not connect directly to step 5.
2. In step 1, change "Legendary Card" to "Legendary".
3. Use a fully opaque flat warm ivory (#fbf8ef) background behind the entire image, including the title, all gaps and footer. No black regions, no transparency, no cutout/alpha effects, no rough white edges.
Keep the Fail branch to REQUEST REJECTED, both leftward arrows from 4 to 5 and 5 to 6, and all other labels unchanged.
```

## Rooster provenance

Output: `rooster-provenance.png`.

### Generation

```text
Use case: infographic-diagram
Asset type: Github README diagram, landscape PNG approximately 1920 x 1080.
Primary request: Precisely explain RFC Legends rooster provenance in three clearly separated numbered panels. Title "A rooster with verifiable provenance". Subtitle "RFC Legends / RoosterRWA + ENSv2".
Style: clean editorial engineering diagram, ivory background, dark forest-green sans-serif text, muted green and pale amber cards, thin clear arrows, flat vector-like rendering, crisp typography, generous space. Match a thoughtful open-source README. No photorealism, no perspective, no decorative background.
Panel 1 on left: heading "1  REGISTER". Two small stacked cards "Farm signs registration" and "Issuer submits mint" both point down to one card "RoosterRWA / ERC-721". Under this card: "One unique ring ID per token" and "Farm custody; onchain provenance".
Panel 2 center: heading "2  LINK PEDIGREE". Vertical tree with exactly three boxes connected downward: "rfclegends.eth", then "theprawang.rfclegends.eth", then "chick01.theprawang.rfclegends.eth". Give these labels enough width. Under boxes small caption "Parent / sire / offspring". Final small text "Token links record sire and dam".
Panel 3 right: heading "3  ATTEST HEALTH". Top card "Farm signs EIP-712 attestation". Down arrow to card "Anyone can relay to RoosterRWA". Down arrow to card "Farm mirrors to ENSv2". Under it print three short lines "rfc.weight", "rfc.health", "rfc.attestedAt". Caption "Resolver grants are scoped by name and key".
Panels are independent explanations: no arrows between panels. All arrows within panels point down. Footer "Sepolia demo uses sample birds and placeholder ring IDs; no legal ownership claim."
Constraints: no tokens being sold, no marketplace, no physical delivery, no smart contract claiming to verify the real physical bird. Do not imply automatic ENS synchronization. Exact text and ENS spelling required. Readable at 1000px wide.
```

### Correction 1

```text
Correct only the background of this technical diagram. Replace every transparent, black, rough white cutout or missing background region with one continuous fully opaque warm ivory background (#fbf8ef). The whole rectangular canvas must be fully opaque, including all three panel backgrounds, title area, gaps, and footer. Preserve ALL existing text, all exact ENS names, every arrow, all icons, dimensions, box layout and card colors. Make the dark forest-green title, panel headings, small captions and footer legible on the light ivory background. Clean edges without cutout artifacts. This is an opaque README document diagram, never a transparent asset.
```

### Correction 2

```text
Fix only the small caption text in this existing diagram. Keep the title, all cards, ENS names, arrows, headings, fully opaque ivory background, and dimensions unchanged.
Replace the two small caption lines below the ERC-721 card in panel 1 with these exact lines:
"One ring ID per token"
"Farm custody; onchain provenance"
Replace the bottom caption of panel 2, below "Parent / sire / offspring", with exactly:
"Tokens record sire and dam"
Replace the bottom caption of panel 3 with exactly:
"Resolver grants: per name and key"
Replace the overall bottom footer with exactly:
"Sepolia demo: sample birds and ring IDs; no legal ownership claim."
Spell all text exactly as quoted. Crisp clean sans-serif at readable size. Do not change any other text.
```
