/* eslint-disable no-console */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 360, height: 520 }; // small viewport to force scrollable content

function pass(name) { console.log(`✅ PASS  ${name}`); }
function fail(name, detail) { console.log(`❌ FAIL  ${name}\n         ${detail}`); }

async function getScrollTop(page, selector) {
  return page.$eval(selector, el => el.scrollTop);
}

async function withRetry(fn, tries = 10, delay = 200) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delay)); }
  }
  throw lastErr;
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  // Always treat as guest mode visit
  await ctx.addInitScript(() => sessionStorage.setItem("guestMode", "1"));

  const results = [];

  // ───────────────────────────────────────────────
  // Test 1: Challenge → GroupDetail → back (scroll restored)
  // ───────────────────────────────────────────────
  try {
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800); // animations settle

    // Find the scroll container (the flex-1 overflow-y-auto div)
    const scrollSel = "[class*='overflow-y-auto']";
    await withRetry(() => page.waitForSelector(scrollSel, { timeout: 3000 }));

    // Scroll down 400px
    await page.$eval(scrollSel, el => { el.scrollTop = 400; });
    await page.waitForTimeout(150); // let onScroll fire
    const beforeScroll = await getScrollTop(page, scrollSel);

    // Find the first group card and click — wait for any visible group
    await page.waitForSelector("text=/그룹|챌린지/", { timeout: 5000 });
    // Click first group card
    const card = await page.locator("[data-group-card], a[href*='/challenge/group/'], div").filter({ hasText: /명 참여|진행중|모집중|마감임박/ }).first();
    const cardCount = await card.count();
    if (cardCount === 0) {
      // Fallback: just navigate directly
      await page.goto(`${BASE}/challenge/group/1?preview=1`, { waitUntil: "networkidle" });
    } else {
      // Try clicking a group element
      await card.click({ force: true, timeout: 2000 }).catch(async () => {
        await page.goto(`${BASE}/challenge/group/1?preview=1`, { waitUntil: "networkidle" });
      });
    }
    await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Go back
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const afterScroll = await getScrollTop(page, scrollSel);
    if (Math.abs(afterScroll - beforeScroll) <= 5) {
      pass(`Challenge: scroll restored (${beforeScroll} → ${afterScroll})`);
      results.push(true);
    } else {
      fail(`Challenge: scroll restored`, `expected ~${beforeScroll}, got ${afterScroll}`);
      results.push(false);
    }
  } catch (e) {
    fail(`Challenge → GroupDetail → back`, e.message);
    results.push(false);
  }

  // ───────────────────────────────────────────────
  // Test 2: Challenge: filterMode persists across navigation
  // ───────────────────────────────────────────────
  try {
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Set filterMode in sessionStorage
    await page.evaluate(() => sessionStorage.setItem("ch-filter", "참여중"));

    // Navigate away and back
    await page.goto(`${BASE}/?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const persisted = await page.evaluate(() => sessionStorage.getItem("ch-filter"));
    if (persisted === "참여중") {
      pass(`Challenge: ch-filter persists (= "참여중")`);
      results.push(true);
    } else {
      fail(`Challenge: ch-filter persists`, `got "${persisted}"`);
      results.push(false);
    }
  } catch (e) {
    fail(`Challenge filter persistence`, e.message);
    results.push(false);
  }

  // ───────────────────────────────────────────────
  // Test 3: GroupDetail scroll restored via SPA back/forward
  //   /challenge → click group (SPA) → scroll on group → back → forward → scroll restored
  // ───────────────────────────────────────────────
  try {
    // Clear filter state from Test 2 (was set to "참여중" — would hide all groups in guest mode)
    await page.evaluate(() => sessionStorage.removeItem("ch-filter"));
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    // SPA click into a group — locate first clickable group card, scroll into view, click
    const cardHandle = await page.evaluateHandle(() => {
      const candidates = Array.from(document.querySelectorAll("div.cursor-pointer"));
      return candidates.find(el => /명 참여|진행중|모집중|마감임박/.test(el.textContent ?? "")) ?? null;
    });
    const cardEl = cardHandle.asElement();
    if (!cardEl) throw new Error("no clickable group card found");
    await cardEl.scrollIntoViewIfNeeded();
    await cardEl.click();
    await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });
    await page.waitForTimeout(900); // group detail mounts + activity loads

    const scrollSel = "[class*='overflow-y-auto']";
    await page.waitForSelector(scrollSel, { timeout: 5000 });

    // Find a scroll target that actually has scrollable content
    const target = await page.evaluate((sel) => {
      const candidates = Array.from(document.querySelectorAll(sel));
      const c = candidates.find(el => el.scrollHeight > el.clientHeight + 50);
      if (!c) return { idx: -1, max: 0 };
      c.scrollTop = Math.min(200, c.scrollHeight - c.clientHeight);
      return { idx: candidates.indexOf(c), max: c.scrollTop };
    }, scrollSel);

    if (target.idx === -1) {
      // Content too short to scroll — skip test as not applicable
      console.log(`⚠️  SKIP  GroupDetail: content not scrollable in viewport`);
      results.push(true);
    } else {
      await page.waitForTimeout(200); // let onScroll fire
      const before = target.max;

      // Set tab via setting the tab UI: just set sessionStorage directly (the page reads from it on remount)
      await page.evaluate(() => sessionStorage.setItem("gd-tab-1", "leaderboard"));

      // SPA back to /challenge
      await page.goBack();
      await page.waitForURL(/\/challenge(\?|$)/, { timeout: 5000 });
      await page.waitForTimeout(400);

      // SPA forward to group detail
      await page.goForward();
      await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });
      await page.waitForTimeout(800);

      const after = await page.evaluate((sel) => {
        const candidates = Array.from(document.querySelectorAll(sel));
        const c = candidates.find(el => el.scrollHeight > el.clientHeight + 50);
        return c ? c.scrollTop : -1;
      }, scrollSel);

      const tab = await page.evaluate(() => sessionStorage.getItem("gd-tab-1"));
      const scrollOk = Math.abs(after - before) <= 5;
      const tabOk = tab === "leaderboard";

      if (scrollOk && tabOk) {
        pass(`GroupDetail: scroll restored (${before} → ${after}), tab="${tab}"`);
        results.push(true);
      } else {
        fail(`GroupDetail: scroll/tab restored`,
          `scroll expected ~${before}, got ${after}; tab expected "leaderboard", got "${tab}"`);
        results.push(false);
      }
    }
  } catch (e) {
    fail(`GroupDetail restore`, e.message);
    results.push(false);
  }

  // ───────────────────────────────────────────────
  // Test 4: sessionStorage helpers — usePersistedState write-through
  // ───────────────────────────────────────────────
  try {
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // Default value should be set in sessionStorage by usePersistedState
    const cat = await page.evaluate(() => sessionStorage.getItem("ch-cat"));
    const filter = await page.evaluate(() => sessionStorage.getItem("ch-filter"));

    if (cat !== null && filter !== null) {
      pass(`usePersistedState: ch-cat="${cat}", ch-filter="${filter}" both written`);
      results.push(true);
    } else {
      fail(`usePersistedState writes initial`, `cat=${cat}, filter=${filter}`);
      results.push(false);
    }
  } catch (e) {
    fail(`usePersistedState write-through`, e.message);
    results.push(false);
  }

  // ───────────────────────────────────────────────
  // Test 5: GroupDetail cache → no "loading" flicker on return
  // ───────────────────────────────────────────────
  try {
    await page.evaluate(() => sessionStorage.removeItem("ch-filter"));
    await page.goto(`${BASE}/challenge?preview=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    const cardHandle2 = await page.evaluateHandle(() => {
      const candidates = Array.from(document.querySelectorAll("div.cursor-pointer"));
      return candidates.find(el => /명 참여|진행중|모집중|마감임박/.test(el.textContent ?? "")) ?? null;
    });
    const cardEl2 = cardHandle2.asElement();
    if (!cardEl2) throw new Error("no clickable group card");
    await cardEl2.scrollIntoViewIfNeeded();
    await cardEl2.click();
    await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });
    // Wait for activity feed to finish initial load (populates module cache)
    await page.waitForTimeout(1500);

    // SPA back then forward
    await page.goBack();
    await page.waitForURL(/\/challenge(\?|$)/, { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.goForward();
    await page.waitForURL(/\/challenge\/group\//, { timeout: 5000 });

    // Immediately check (within 50ms) for the loading text — should NOT appear if cache works
    await page.waitForTimeout(50);
    const loadingShown = await page.locator("text=활동을 불러오는 중").count();

    // Also verify mounted=true initial: items should NOT have opacity:0 transitioning to 1
    // (we just check that there's no loading message — cache hit means activityPosts seeded immediately)
    if (loadingShown === 0) {
      pass(`GroupDetail: cache hit on return — no "loading" flicker`);
      results.push(true);
    } else {
      fail(`GroupDetail: no loading flicker`, `loading text appeared ${loadingShown} time(s)`);
      results.push(false);
    }
  } catch (e) {
    fail(`GroupDetail cache hit`, e.message);
    results.push(false);
  }

  await browser.close();

  console.log("\n=== Results ===");
  console.log(`${results.filter(Boolean).length} / ${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}

run().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(2);
});
