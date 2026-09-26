# ETHGlobal Tokyo 2026 — prizes & rules

> Copied verbatim from the cowork session (researched 2026-09-25). Source pages are listed at the bottom.

ETHGlobal Tokyo 2026 จัดวันที่ 25–27 ก.ย. 2026 (เริ่มวันนี้) ที่ Toranomon Hills Forum ชั้น 5 โตเกียว มี Sponsor 7 ราย เงินรางวัล Partner Prize รวม **$52,500** ส่งงานได้ถึง **อาทิตย์ 27 ก.ย. 09:00 JST**

## กติกาสำคัญ

- **Classic Track:** ต้องเริ่มเขียนโค้ดหลังงานเปิด ถ้าเป็นโปรเจกต์ที่ทำไว้ก่อน จะส่งได้แต่ไม่มีสิทธิ์ลุ้น Partner Prize และรอบ Finalist
- **Continuity Track:** ต่อยอดจากโค้ดเดิมได้ แต่ต้องแจ้งให้ชัดว่าส่วนไหนมีอยู่แล้ว และส่วนไหนทำใหม่ระหว่างงาน
- **Partner Prize:** สมัครได้สูงสุด **3 รายการ** ต่อโปรเจกต์
- **Git:** ต้องมี commit history ที่ดูรู้ว่าทำมาเป็นขั้นตอน ถ้า commit ครั้งเดียวจบ 1inch จะตัดสิทธิ์
- **AI tools:** ถ้าใช้ ต้องระบุ
- **Demo video:** ความยาว 2–4 นาที ไม่บังคับแต่แนะนำให้มี
- **รอบ Finalist:** มีเวลา 7 นาที แบ่งเป็น demo 4 นาที และ Q&A 3 นาที หน้า prizes ไม่ได้บอกว่ารางวัล Finalist เป็นเงินเท่าไร

## รางวัลทั้งหมด

| Sponsor | รางวัล | เงินรางวัล | ต้องทำอะไร |
|---|---|---|---|
| **World** ($15k) | Best Use of IDKit | $7,500 | ใช้ World ID ยืนยันตัวตนตอนที่ต้องเชื่อใจกันจริง ๆ โดย verify ฝั่ง server หรือ onchain ต้องโชว์ทั้งกรณีผ่านและกรณีถูกปฏิเสธ/ยกเลิก และส่ง feedback การ integrate |
| | Best Use of World ID for Agents | $7,500 | ทำ Agent ที่ขอให้คนยืนยันตัวตนก่อนทำ action สำคัญ ครบลำดับ request → verify → ผลที่ validate แล้ว → action ที่ถูกป้องกันไว้ มีกรณี fail และ validate ฝั่ง backend |
| **ENS** ($10k) | Best Use of ENSv2 | $3k / $2k / $1k | สร้างบน ENSv2 (Sepolia) ให้ฟีเจอร์ ENSv2 เป็นแกนหลัก เช่น subname, permission, alias มี **โบนัสถ้าใช้กับ AI Agent** ห้าม hard-code ต้องมี live demo และโค้ด open source |
| | ENSv2 Integration (โปรเจกต์เดิม) | $2k / $1k / $1k | เอา ENSv2 ไปใส่ในโปรเจกต์ที่มีอยู่แล้ว ต้องช่วยให้ดีขึ้นจริง ไม่ใช่แค่ใส่ให้สวย |
| **Uniswap** ($10k) | Best Uniswap Stack Contribution | $3k / $2k / $1k | ใช้ส่วนไหนของ Uniswap ก็ได้ (API, v2/v3/v4, hooks, CCA) ต้องมี **FEEDBACK.md** กรอก Feedback Form และเขียน README ชี้ไปยังบรรทัดโค้ดที่ integrate |
| | Continuity Track | $2k / $1k / $1k | เงื่อนไขเหมือนรายการบน แต่สำหรับโปรเจกต์เดิม |
| **1inch** ($7k) | Build an Aqua App | $2.5k / $1.5k / $1k | ทำแอป DeFi บน Aqua/SwapVM ถ้าแก้ opcode ของ SwapVM จะได้คะแนนเพิ่ม demo ต้องโชว์การโอน token onchain (ใช้ local fork ได้) |
| | Continuity Track | $1.5k / $500 | เงื่อนไขเหมือนรายการบน |
| **Sui** ($5k) | DeFi & Payments | $2.5k / $1.5k / $1k | ระบบ payment, wallet, vault หรือระบบเงินอัตโนมัติบน Sui |
| **Curvegrid** ($3k) | Best RWA Tokenization | $1,000 | ทำ Tokenize สินทรัพย์จริง เช่น invoice, อสังหาฯ, treasury |
| | Best Digital Asset Dashboard | $1,000 | Dashboard วิเคราะห์ portfolio, RWA หรือ DeFi |
| | Best AI Agent Project | $1,000 | Agent ที่อ่านข้อมูล onchain แล้วลงมือทำ action เอง (ทั้ง 3 รายการต้องมี repo, tests และ README ตาม format ที่กำหนด ใช้ MultiBaas หรือไม่ก็ได้) |
| **Intercepta** ($2.5k) | Safe Agent-to-Agent Payments (x402) | $1,250 / $750 | ใช้ Intercepta API ตรวจการจ่ายเงินก่อน Agent จะ sign ห้าม mock ผล API ต้องตรวจ address บน mainnet จริง และ demo ต้องมีทั้งรายการที่ผ่านและรายการที่ถูกบล็อก |
| | Add Screening (Continuity) | $500 | เพิ่มฟีเจอร์ screening ลงในโปรเจกต์ที่มีอยู่แล้ว |

## ข้อสังเกตเชิงกลยุทธ์

ธีม **AI Agent** เข้ากับหลายรายการพร้อมกัน ได้แก่ World ID for Agents, ENSv2 (มีโบนัสด้าน agent), Curvegrid AI Agent และ Intercepta x402 ถ้าทำ Agent จ่ายเงินที่ต้องให้คนยืนยันตัวตนก่อน และใช้ ENS subname เป็นตัวตนของ Agent ก็เลือกสมัคร 3 รางวัลได้ในโปรเจกต์เดียว เช่น World ($7.5k) + ENS ($3k) + Intercepta หรือ Curvegrid

หลาย Sponsor บังคับให้ส่ง feedback การใช้งานด้วย (World, Uniswap, Intercepta, Curvegrid) อย่าลืมเผื่อเวลาเขียนส่วนนี้ก่อนส่งงาน

ถ้าต้องการ ผมทำสรุปนี้เป็นไฟล์ .docx ไว้แชร์ให้ทีมได้ครับ

Sources:
- [ETHGlobal Tokyo 2026 – Prizes](https://ethglobal.com/events/tokyo2026/prizes)
- [ETHGlobal Tokyo 2026 – Event Details](https://ethglobal.com/events/tokyo2026/info/details)
- [Solidity Developer – ETHGlobal Tokyo 2026](https://soliditydeveloper.com/ethglobal-tokyo-2026)
- [ETHGlobal on X – 2026 calendar](https://x.com/ETHGlobal/status/1992919708589576215)
