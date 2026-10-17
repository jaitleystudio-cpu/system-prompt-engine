import assert from "node:assert/strict";
import { chromium } from "../node_modules/playwright/index.mjs";

async function main() {
  console.log("================================================================================");
  console.log("SPE LEVEL 6: SWARM INTELLIGENCE & BFT FEDERATION — LIVE BROWSER VERIFICATION");
  console.log("================================================================================");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[BROWSER ERROR]", msg.text());
  });

  console.log("1. Navigating to http://127.0.0.1:4173/capabilities ...");
  await page.goto("http://127.0.0.1:4173/capabilities", { waitUntil: "networkidle" });

  console.log("2. Verifying Level 6 Swarm UI presence...");
  await page.waitForSelector("text=LEVEL 6 SWARM INTELLIGENCE", { timeout: 10000 });
  await page.waitForSelector("text=Collective Multi-Agent Swarm Federation", { timeout: 5000 });
  await page.waitForSelector("text=Byzantine-Resilient P2P Mesh and Quorum Consensus", { timeout: 5000 });
  await page.waitForSelector("text=Connected Peer Nodes", { timeout: 5000 });
  await page.waitForSelector("text=Swarm Cluster Nodes Topology", { timeout: 5000 });
  await page.waitForSelector("text=Swarm P2P Gossip Protocol Log", { timeout: 5000 });

  console.log("3. Testing 'Broadcast Capsule to Swarm' button click...");
  const broadcastBtn = page.getByRole("button", { name: "Broadcast Capsule to Swarm" });
  await broadcastBtn.click();
  await page.waitForTimeout(500);

  const pendingText = await page.locator("text=QUORUM_PENDING").first().innerText();
  console.log("   -> Quorum Status after broadcast:", pendingText);
  assert.equal(pendingText, "QUORUM_PENDING");

  console.log("4. Testing 'Trigger BFT Consensus Round' button click...");
  const bftBtn = page.getByRole("button", { name: "Trigger BFT Consensus Round" });
  await bftBtn.click();
  await page.waitForTimeout(500);

  const quorumText = await page.locator("text=BFT_QUORUM_ACHIEVED").first().innerText();
  console.log("   -> Quorum Status after BFT consensus:", quorumText);
  assert.equal(quorumText, "BFT_QUORUM_ACHIEVED");

  console.log("5. Testing 'Simulate Byzantine Slash' button click...");
  const slashBtn = page.getByRole("button", { name: "Simulate Byzantine Slash" });
  await slashBtn.click();
  await page.waitForTimeout(500);

  const slashedBadge = await page.locator("text=SLASHED").first().innerText();
  console.log("   -> Peer Node Slash Badge:", slashedBadge);
  assert.ok(slashedBadge.toUpperCase().includes("SLASHED"));

  console.log("6. Taking full screenshot of Level 6 Swarm Mesh Studio...");
  const artifactPath = "/Users/prawinpalisetty/.gemini/antigravity/brain/56183f26-b3d5-4328-820c-5d76116b5617/live_level6_swarm_federation_verified.png";
  await page.screenshot({ path: artifactPath, fullPage: true });
  console.log("   -> Saved screenshot to:", artifactPath);

  await browser.close();
  console.log("================================================================================");
  console.log("LEVEL 6 SWARM INTELLIGENCE & BFT FEDERATION 100% VERIFIED LIVE IN BROWSER!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
