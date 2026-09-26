#!/usr/bin/env python3
"""Burst-capture the live /game canvas so juice can be judged frame by frame.
Stubs window.ethereum as a fixed Sepolia account so wagmi's injected connector
connects and the Phaser scene renders.
Usage: python3 burst.py <outdir> <first_wait_ms> <n_frames> <gap_ms> [url]
Writes <outdir>/full.png (whole page) and <outdir>/cNN.png (canvas only)."""
import sys
from playwright.sync_api import sync_playwright

STUB = """
Object.defineProperty(window, 'ethereum', { value: {
  isMetaMask: true,
  chainId: '0xaa36a7',
  networkVersion: 11155111,
  selectedAddress: '0x4444444444444444444444444444444444444444',
  request: async (args) => {
    const m = args.method;
    if (m === 'eth_requestAccounts' || m === 'eth_accounts') {
      return ['0x4444444444444444444444444444444444444444'];
    }
    if (m === 'eth_chainId') return '0xaa36a7';
    if (m === 'net_version') return '11155111';
    if (m === 'wallet_getPermissions') {
      return [{ parentCapability: 'eth_accounts' }];
    }
    if (m === 'eth_blockNumber') return '0x1';
    if (m === 'eth_getBalance') return '0x0';
    if (m === 'eth_call') return '0x';
    if (m === 'wallet_listenAccounts' || m === 'wallet_scanQRCode') return null;
    return null;
  },
  on: () => {},
  removeListener: () => {},
  emit: () => {},
  enable: async () => ['0x4444444444444444444444444444444444444444'],
}, configurable: true, writable: false });
"""

outdir = sys.argv[1]; first_wait = int(sys.argv[2]); n = int(sys.argv[3]); gap = int(sys.argv[4])
url = sys.argv[5] if len(sys.argv) > 5 else "http://localhost:3000/game"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(STUB)
    page.goto(url, wait_until="networkidle", timeout=60000)
    for attempt in range(6):
        try:
            page.get_by_role("button", name="Connect wallet").first.click(timeout=8000)
        except Exception:
            break  # already connected
        try:
            page.wait_for_selector("canvas", timeout=6000); break
        except Exception:
            page.wait_for_timeout(1500)
    page.wait_for_selector("canvas", timeout=20000)
    page.wait_for_timeout(first_wait)
    page.screenshot(path=f"{outdir}/full.png")
    c = page.locator("canvas").first
    for i in range(n):
        c.screenshot(path=f"{outdir}/c{i:02d}.png")
        page.wait_for_timeout(gap)
    b.close()
print("page errors:", errs[:5] or "none")
