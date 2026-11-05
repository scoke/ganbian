import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Same environment contract as verify.mjs. Each case receives a clean browser context.
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || "@playwright/test",
);
const { chromium, expect } = require("@playwright/test");
const base = process.env.LOCAL_URL || "http://127.0.0.1:8094";
const out =
  process.env.EDGE_EVIDENCE_DIR ||
  new URL("../docs/local-evidence/edge/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
const results = [];
const readRecord = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("ganbian-local-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const r = db
          .transaction("records", "readonly")
          .objectStore("records")
          .get("state");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  });
const putRecord = (page, record) =>
  page.evaluate(async (record) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("ganbian-local-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        tx.objectStore("records").put(record, "state");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, record);
async function open(context, route = "home") {
  const page = await context.newPage();
  await page.goto(base + "/local/#" + route);
  await expect(page.locator("h1")).toBeVisible();
  return page;
}
async function run(name, test) {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  const result = { name, status: "PASS", evidence: {} };
  try {
    await test(context, result.evidence);
    assert.deepEqual(errors, [], "uncaught browser errors");
  } catch (e) {
    result.status = "FAIL";
    result.error = e.stack || String(e);
  }
  for (const [i, page] of context.pages().entries())
    if (!page.isClosed())
      await page
        .screenshot({
          path: out + "/" + name + "-" + i + ".png",
          fullPage: true,
        })
        .catch(() => {});
  result.pageErrors = errors;
  results.push(result);
  console.log(
    result.status + ": " + name + (result.error ? "\n" + result.error : ""),
  );
  await context.close();
}
try {
  await run("two-page-conflict", async (context, evidence) => {
    const a = await open(context),
      b = await open(context);
    evidence.first = await a.evaluate(async () => {
      const c = await import("./core.mjs"),
        s = await import("./store.mjs");
      const state = await s.load();
      state.draft.spot = "page A winner";
      await s.save(state);
      return state.draft.spot;
    });
    evidence.second = await b.evaluate(async () => {
      const c = await import("./core.mjs"),
        s = await import("./store.mjs");
      const state = c.createState();
      state.draft.spot = "page B stale";
      try {
        await s.save(state);
        return { saved: true };
      } catch (e) {
        return { saved: false, message: e.message };
      }
    });
    assert.equal(evidence.second.saved, false);
    assert.match(evidence.second.message, /另一页面/);
    evidence.record = await readRecord(a);
    assert.equal(evidence.record.state.draft.spot, "page A winner");
    assert.equal(evidence.record.revision, 1);
  });
  await run("corrupt-startup-no-overwrite", async (context, evidence) => {
    const page = await open(context);
    const corrupt = {
      revision: 7,
      state: { version: 999, marker: "preserve-me" },
    };
    await putRecord(page, corrupt);
    await page.reload();
    await expect(page.locator("h1")).toHaveText("本机记录暂不可用");
    await expect(page.locator("#error")).toContainText("原记录未覆盖");
    evidence.record = await readRecord(page);
    assert.deepEqual(evidence.record, corrupt);
  });
  await run("corrupt-live-record-no-overwrite", async (context, evidence) => {
    const page = await open(context);
    await page.evaluate(async () => {
      const s = await import("./store.mjs"),
        c = await import("./core.mjs");
      await s.save(c.createState());
    });
    const corrupt = {
      revision: 1,
      state: { version: 999, marker: "preserve-live-corruption" },
    };
    await putRecord(page, corrupt);
    evidence.save = await page.evaluate(async () => {
      const s = await import("./store.mjs"),
        c = await import("./core.mjs");
      try {
        await s.save(c.createState());
        return { saved: true };
      } catch (e) {
        return { saved: false, message: e.message };
      }
    });
    evidence.record = await readRecord(page);
    assert.equal(
      evidence.save.saved,
      false,
      "save must reject corrupt existing storage even when revision matches",
    );
    assert.deepEqual(evidence.record, corrupt);
  });
  await run("storage-failure-keeps-input", async (context, evidence) => {
    const page = await open(context, "prepare");
    await page.locator('[name="spot"]').fill("DO NOT LOSE unsaved spot");
    evidence.before = (await readRecord(page)) || null;
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        if (args[1] === "readwrite")
          throw new DOMException(
            "Injected quota failure",
            "QuotaExceededError",
          );
        return original.apply(this, args);
      };
    });
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.locator("#error")).toContainText(
      "Injected quota failure",
    );
    await expect(page.locator('[name="spot"]')).toHaveValue(
      "DO NOT LOSE unsaved spot",
    );
    evidence.toast = await page.locator("#toast").textContent();
    assert.doesNotMatch(evidence.toast, /已保存/);
    evidence.after = (await readRecord(page)) || null;
    assert.deepEqual(evidence.after, evidence.before);
    assert.equal(await page.locator("#main").evaluate((el) => el.inert), false);
  });
  await run("overdue-once-reload-rebait", async (context, evidence) => {
    const page = await context.newPage();
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    await page.clock.install({ time: now });
    await page.goto(base + "/local/#home");
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(async () => {
      const c = await import("./core.mjs"),
        s = await import("./store.mjs");
      let state = c.createState();
      state.draft.spot = "clock edge";
      state.draft.rods = [{ bait: "玉米粒", rig: c.RIGS[0], interval: "1" }];
      await s.save(c.start(state, Date.now(), "clock-case"));
    });
    await page.goto(base + "/local/#fishing");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("垂钓中");
    await expect(page.locator("#reminder")).toBeHidden();
    await page.clock.fastForward(3_601_000);
    await expect(page.locator("#reminder")).toContainText("1号竿已到检查时间");
    evidence.first = await readRecord(page);
    const rod = evidence.first.state.sessions[0].rods[0];
    assert.equal(rod.remindedDueAt, rod.lastBaitAt + 3_600_000);
    await page.clock.runFor(3000);
    evidence.repeated = await readRecord(page);
    assert.equal(
      evidence.repeated.revision,
      evidence.first.revision,
      "overdue tick must persist once",
    );
    await page.reload();
    await expect(page.locator("#reminder")).toContainText("1号竿已到检查时间");
    await page.clock.runFor(2000);
    evidence.reloaded = await readRecord(page);
    assert.equal(
      evidence.reloaded.revision,
      evidence.first.revision,
      "reload must retain marker without repeat save",
    );
    await page.getByRole("button", { name: "已换饵", exact: true }).click();
    await expect(page.locator("#reminder")).toBeHidden();
    evidence.rebaited = await readRecord(page);
    assert.equal(
      evidence.rebaited.state.sessions[0].rods[0].remindedDueAt,
      null,
    );
    assert.equal(
      evidence.rebaited.state.sessions[0].events.filter(
        (e) => e.type === "rebait",
      ).length,
      1,
    );
    await page.reload();
    await expect(page.locator("#reminder")).toBeHidden();
  });
  await run(
    "draft-navigation-cancel-and-typing-unload",
    async (context, evidence) => {
      const page = await open(context, "prepare");
      await page
        .locator('[name="spot"]')
        .pressSequentially("typed without blur");
      // Probe before any blur/change: input alone must arm the native unload guard.
      evidence.inputOnlyGuard = await page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
      assert.equal(evidence.inputOnlyGuard, true);
      const confirm = page.waitForEvent("dialog");
      const navigation = page
        .getByRole("link", { name: "历史", exact: true })
        .click();
      const dialog = await confirm;
      evidence.navigationDialog = {
        type: dialog.type(),
        message: dialog.message(),
      };
      await dialog.dismiss();
      await navigation;
      await expect(page).toHaveURL(/#prepare$/);
      await expect(page.locator('[name="spot"]')).toHaveValue(
        "typed without blur",
      );
      await expect(page.locator("#draft")).toBeVisible();
      const unload = page.waitForEvent("dialog");
      const reload = page
        .reload({ timeout: 5000 })
        .catch((e) => ({ cancelled: e.message }));
      const native = await unload;
      evidence.nativeUnloadType = native.type();
      await native.dismiss();
      await reload;
      assert.equal(evidence.nativeUnloadType, "beforeunload");
      await expect(page.locator('[name="spot"]')).toHaveValue(
        "typed without blur",
      );
    },
  );
} finally {
  await browser.close();
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      { base, generatedAt: new Date().toISOString(), results },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    report: out + "/report.json",
  }),
);
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
