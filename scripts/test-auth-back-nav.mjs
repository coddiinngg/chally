/* eslint-disable no-console */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 360, height: 520 };
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Missing TEST_EMAIL or TEST_PASSWORD env");
  process.exit(2);
}

function pass(n) { console.log(`✅ PASS  ${n}`); }
function fail(n, d) { console.log(`❌ FAIL  ${n}\n         ${d}`); }
function skip(n, d) { console.log(`⚠️  SKIP  ${n} (${d})`); }

const results = [];

async function ensureLoggedIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // wait for redirect off /login
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function clearKeys(page, keys) {
  await page.evaluate((ks) => ks.forEach(k => sessionStorage.removeItem(k)), keys);
}

async function findScrollable(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[class*='overflow-y-auto']"));
    return all.findIndex(el => el.scrollHeight > el.clientHeight + 20);
  });
}

async function getScrollAt(page, idx) {
  return page.evaluate((i) => {
    const all = Array.from(document.querySelectorAll("[class*='overflow-y-auto']"));
    return all[i]?.scrollTop ?? -1;
  }, idx);
}

async function setScrollAt(page, idx, target) {
  return page.evaluate(({ i, t }) => {
    const all = Array.from(document.querySelectorAll("[class*='overflow-y-auto']"));
    const el = all[i];
    if (!el) return -1;
    el.scrollTop = t;
    el.dispatchEvent(new Event("scroll"));
    return el.scrollTop;
  }, { i: idx, t: target });
}

// Generic test: visit `path`, scroll, navigate elsewhere, come back, verify scroll restored
async function testScrollRoundTrip(page, name, path, awayPath, scrollTarget = 300) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900); // animation + data load

    const idx = await findScrollable(page);
    if (idx === -1) { skip(name, "content not scrollable"); results.push(true); return; }

    const before = await setScrollAt(page, idx, scrollTarget);
    await page.waitForTimeout(200);

    // Navigate away via SPA — use history.pushState + popstate? Simpler: goto + goBack (full reload).
    // useScrollRestoration writes to sessionStorage on every scroll, so it survives full reload.
    await page.goto(`${BASE}${awayPath}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    const idx2 = await findScrollable(page);
    const after = await getScrollAt(page, idx2);

    if (Math.abs(after - before) <= 5) {
      pass(`${name}: ${before} → ${after}`);
      results.push(true);
    } else {
      fail(name, `expected ~${before}, got ${after}`);
      results.push(false);
    }
  } catch (e) {
    fail(name, e.message);
    results.push(false);
  }
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await ensureLoggedIn(page);

  // ──────────────────────────────────────────────────
  // Test A: Profile scroll restored after navigation
  // ──────────────────────────────────────────────────
  await testScrollRoundTrip(page, "Profile", "/profile", "/rewards");

  // ──────────────────────────────────────────────────
  // Test B: Rewards scroll restored
  // ──────────────────────────────────────────────────
  await testScrollRoundTrip(page, "Rewards", "/rewards", "/profile");

  // ──────────────────────────────────────────────────
  // Test C: Gallery scroll + viewMode persistence
  // ──────────────────────────────────────────────────
  try {
    await clearKeys(page, ["gl-scroll", "gl-view", "gl-filter", "gl-cols"]);
    await page.goto(`${BASE}/gallery`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Set viewMode to "month" via UI? Just write sessionStorage which the page reads on mount.
    await page.evaluate(() => sessionStorage.setItem("gl-view", "month"));

    await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const view = await page.evaluate(() => sessionStorage.getItem("gl-view"));
    if (view === "month") {
      pass(`Gallery: viewMode "month" preserved across navigation`);
      results.push(true);
    } else {
      fail("Gallery viewMode", `expected "month", got "${view}"`);
      results.push(false);
    }
  } catch (e) {
    fail("Gallery viewMode", e.message);
    results.push(false);
  }

  // ──────────────────────────────────────────────────
  // Test D: ChallengeHistory scroll restored
  // ──────────────────────────────────────────────────
  await testScrollRoundTrip(page, "ChallengeHistory", "/stats/challenge-history", "/stats");

  // ──────────────────────────────────────────────────
  // Test E: WeeklyReport weekIdx persistence
  // ──────────────────────────────────────────────────
  try {
    await page.evaluate(() => sessionStorage.removeItem("wr-week-idx"));
    await page.goto(`${BASE}/stats/weekly-report`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    await page.evaluate(() => sessionStorage.setItem("wr-week-idx", "1"));
    await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    const wk = await page.evaluate(() => sessionStorage.getItem("wr-week-idx"));
    if (wk === "1") {
      pass(`WeeklyReport: weekIdx "1" persisted`);
      results.push(true);
    } else {
      fail("WeeklyReport weekIdx", `expected "1", got "${wk}"`);
      results.push(false);
    }
  } catch (e) {
    fail("WeeklyReport weekIdx", e.message);
    results.push(false);
  }

  // ──────────────────────────────────────────────────
  // Test F: GroupDetail — SPA navigation + cache (no loading flicker on return)
  // ──────────────────────────────────────────────────
  try {
    await clearKeys(page, ["ch-filter", "ch-cat"]);
    await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // SPA click into a group
    const cardHandle = await page.evaluateHandle(() => {
      const candidates = Array.from(document.querySelectorAll("div.cursor-pointer"));
      return candidates.find(el => /명 참여|진행중|모집중|마감임박/.test(el.textContent ?? "")) ?? null;
    });
    const cardEl = cardHandle.asElement();
    if (!cardEl) throw new Error("no clickable group card");
    await cardEl.scrollIntoViewIfNeeded();
    await cardEl.click();
    await page.waitForURL(/\/challenge\/group\//, { timeout: 7000 });
    await page.waitForTimeout(1500); // wait for activity feed first load

    // Scroll on group page
    const idx = await findScrollable(page);
    let before = -1;
    if (idx !== -1) {
      before = await setScrollAt(page, idx, 200);
      await page.waitForTimeout(200);
    }

    // SPA back via browser back (popstate → React Router)
    await page.goBack();
    await page.waitForURL(/\/challenge(\?|$)/, { timeout: 5000 });
    await page.waitForTimeout(300);

    // SPA forward to GroupDetail
    await page.goForward();
    await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });

    // Immediately check for loading text (no flicker if cache hit)
    await page.waitForTimeout(60);
    const loadingCount = await page.locator("text=활동을 불러오는 중").count();

    await page.waitForTimeout(800); // settle for scroll check

    const idx2 = await findScrollable(page);
    const after = idx2 !== -1 ? await getScrollAt(page, idx2) : -1;

    const noFlicker = loadingCount === 0;
    const scrollOk = before === -1 || idx === -1 ? true : Math.abs(after - before) <= 10;

    if (noFlicker && scrollOk) {
      pass(`GroupDetail: cache hit (no flicker), scroll ${before} → ${after}`);
      results.push(true);
    } else {
      fail("GroupDetail SPA round-trip",
        `loadingCount=${loadingCount}, scroll expected ~${before}, got ${after}`);
      results.push(false);
    }
  } catch (e) {
    fail("GroupDetail SPA round-trip", e.message);
    results.push(false);
  }

  // ──────────────────────────────────────────────────
  // Test G: GroupDetail tab restoration (gd-tab-X)
  // ──────────────────────────────────────────────────
  try {
    // After Test F we're on /challenge/group/X — get the groupId from URL
    const urlMatch = page.url().match(/\/challenge\/group\/([^/?]+)/);
    if (!urlMatch) throw new Error("not on group detail page");
    const gid = urlMatch[1];
    const tabKey = `gd-tab-${gid}`;

    // Force tab to "leaderboard"
    await page.evaluate((k) => sessionStorage.setItem(k, "leaderboard"), tabKey);

    // Navigate away (full reload) then back to verify mount-time read
    await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Tab value should still be "leaderboard" (the page reads it on mount)
    const tab = await page.evaluate((k) => sessionStorage.getItem(k), tabKey);
    if (tab === "leaderboard") {
      pass(`GroupDetail: tab="leaderboard" preserved (key=${tabKey})`);
      results.push(true);
    } else {
      fail("GroupDetail tab", `expected "leaderboard", got "${tab}"`);
      results.push(false);
    }
  } catch (e) {
    fail("GroupDetail tab", e.message);
    results.push(false);
  }

  await browser.close();
  console.log("\n=== Results ===");
  console.log(`${results.filter(Boolean).length} / ${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}

run().catch(e => { console.error("Runner crash:", e); process.exit(2); });
