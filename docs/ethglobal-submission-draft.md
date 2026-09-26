# ETHGlobal submission — RFC Legends

## Status (2026-09-26 ~07:15 UTC)

Project page: https://ethglobal.com/events/tokyo2026/project

- [x] Project created: name "RFC Legends", category Gaming, emoji 🐓
- [x] Typed into the "Project details" step (NOT saved yet): short description, description, how it's made
- [ ] **Blocked:** "GitHub Repositories" is required and the `fortun3-guru` GitHub account shows "No repositories found". Create a public repo, then use "Review GitHub Permissions" so ETHGlobal can see it
- [ ] Demo link (required field): empty, no live demo yet
- [ ] Remaining steps: Images, Tech stack, Select prizes, Video, Future, Final
- [ ] Final submit: do it only after the text is trimmed to what the repo and demo actually show

Deadline: **Sun 27 Sep 2026 09:00 JST** (Sat 24:00 UTC)

---

## Draft copy (verbatim from the cowork session)

ผมกรอกฟอร์มแทนไม่ได้ครับ session นี้ไม่ได้เชื่อมกับ Chrome และหน้า submit ต้อง login ETHGlobal ด้วยบัญชีของคุณ ผมเลยเตรียมข้อความไว้ให้ copy ไปวางได้ทันที

**ก่อนวาง:** ข้อความด้านล่างเขียนตามแผน vertical slice ส่วนไหนที่ทีมยังทำไม่เสร็จให้ลบออกก่อน กรรมการจะเปิดดู repo และ demo จริง ถ้าอ้างฟีเจอร์ที่ไม่มีอยู่จะเสียคะแนนหรือถูกตัดสิทธิ์ได้

---

**Project name**
RFC Legends

**Short description** (97 ตัวอักษร)
Idle MMORPG: level up with your rooster companion. Real roosters live onchain as verifiable RWAs.

**Description**
RFC Legends is an idle MMORPG inspired by classic Ragnarok-style progression, themed around Thai native gamecock breeds. You play as a trainer who adventures with a rooster companion. Both level up together automatically, even while you are offline, so you spend your time making decisions and talking with your guild instead of clicking.

The game is backed by real animals. RFC Club sells RWA cards of real roosters cared for by Ninlanee Farm in Thailand. Each real rooster gets an ENSv2 name, and its offspring become subnames of their sire, so anyone can verify a bloodline onchain. Every week the farm signs updates on weight and health, and those updates feed the in-game card.

Rare drops, like in Ragnarok, are the heart of the economy. Legendary items and monster cards can be minted and sold in an onchain Rare Market. The seller receives 90% and the platform receives 10%, enforced by the contract. To stop bots from farming drops for real money, minting and selling require a World ID verification: one human, one account.

There is no gambling. The game focuses on breeding, collecting and community.

**How it's made**
- Frontend: Next.js (PWA) with Phaser for the isometric idle scene.
- Idle engine: a Node.js/TypeScript server-authoritative engine. Live combat is simulated tick by tick. Offline rewards use rate-based settlement.
- Data and realtime: PocketBase stores player state, drops and World ID nullifier bindings, and powers guild chat and the guild boss over realtime subscriptions.
- Smart contracts: Solidity on Ethereum Sepolia.
  - an ERC-721 for real-rooster RWAs, carrying signed farm attestations
  - an ERC-1155 for mintable rare drops
  - a marketplace that splits every sale 90/10 automatically
- ENSv2: hierarchical subnames act as the pedigree registry (sire → offspring). A permissioned resolver lets only the farm's key write health records.
- World ID: IDKit with backend verification, required before minting or selling rare items. Unverified accounts are rejected.
- Curvegrid MultiBaas: used for contract deployment, interaction and event indexing.
- AI tools: we used Claude for the game design document and code scaffolding. Our GDD is in the repo.

**Partner prizes** (เลือก 3)
1. World: Best Use of IDKit
2. ENS: Best Use of ENSv2
3. Curvegrid: Best RWA Tokenization

---

## ส่วนที่ทีมต้องใส่เอง

- **GitHub repo:** ต้องเป็น public และเห็น commit history ต่อเนื่อง
- **README ใน repo:** ต้องชี้ไปยังไฟล์และบรรทัดที่ใช้ World ID, ENSv2 และ MultiBaas ส่วน Curvegrid บังคับให้มีสรุป 1 ประโยค, แนะนำทีมพร้อม social handle, วิธี setup และ feedback เรื่อง MultiBaas
- **Integration feedback สำหรับ World (บังคับ):** ใช้เวลากี่นาทีกว่าจะ verify สำเร็จครั้งแรก, ติดขัดตรงไหน, อะไรที่ขาด, อยากให้ปรับอะไรมากที่สุด
- **Live demo link และ demo video** (2–4 นาที)
- **Logo และ screenshot**

ต้องส่งก่อน **อาทิตย์ 27 ก.ย. 09:00 JST** ครับ ถ้าส่ง repo URL และรายการฟีเจอร์ที่ทำเสร็จจริงมา ผมปรับข้อความให้ตรงกับของจริง และเขียน README ให้ครบตามเงื่อนไขของทั้ง 3 Sponsor ให้ได้
