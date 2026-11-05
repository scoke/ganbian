import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || "@playwright/test",
);
const { chromium, expect } = require("@playwright/test");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
const base = process.env.LOCAL_URL || "http://127.0.0.1:8094";
const out = new URL("../docs/local-evidence/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const errors = [];
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
        viewport,
        colorScheme: "light",
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/prototype/#home");
    await page.locator("h1").waitFor();
    await page.screenshot({
      path: out + `before-${device}.png`,
      fullPage: true,
    });
    await page.goto(base + "/local/#home");
    await expect(page.locator("h1")).toContainText("本机记录");
    await page.screenshot({
      path: out + `after-${device}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "准备出钓", exact: true }).click();
    await page.locator('[name="spot"]').fill("验证钓点");
    await page.locator('[name="flow"]').selectOption("急");
    await page.locator('[name="water"]').fill("0");
    await page.locator('[name="batch-bait"]').selectOption("玉米粒");
    await expect(
      page.locator('[name="batch-interval"][value="2"]'),
    ).toBeChecked();
    await page.locator('[name="batch-rig"]').selectOption({ index: 1 });
    await page.locator('[name="batch-interval"][value="1.5"]').check();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "应用到全部竿" }).click();
    await expect(
      page.locator('[name="r0-interval"][value="1.5"]'),
    ).toBeChecked();
    await page.getByRole("button", { name: "增加一支竿" }).click();
    await expect(page.locator('[name="r1-bait"]')).toHaveValue("");
    await page.getByRole("button", { name: "开始垂钓", exact: true }).click();
    await expect(page.locator("#error")).toBeVisible();
    await expect(page.locator('[name="spot"]')).toHaveValue("验证钓点");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "应用到全部竿" }).click();
    await page.locator('[name="r1-interval"][value="1"]').check();
    await page.getByRole("button", { name: "开始垂钓", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("垂钓中");
    await expect(page.locator("#main")).toContainText("0 ℃");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("垂钓中");
    await expect(page.locator("#main")).toContainText("1.5 小时");
    await page
      .getByRole("button", { name: "已换饵", exact: true })
      .nth(1)
      .click();
    await expect(page.locator(".timeline")).toContainText("2号竿 · 已换饵");
    await page.getByRole("button", { name: "调整间隔" }).first().click();
    await page.locator('dialog [name="interval"]').selectOption("1");
    await page
      .locator("dialog")
      .getByRole("button", { name: "确认", exact: true })
      .click();
    await expect(page.locator(".timeline")).toContainText("1.5 → 1");
    await page.getByRole("button", { name: "记鱼获", exact: true }).click();
    await page.locator('dialog [name="fish"]').fill("<测试>");
    await page.locator('dialog [name="count"]').fill("2");
    await page
      .locator("dialog")
      .getByRole("button", { name: "确认", exact: true })
      .click();
    await expect(page.locator(".timeline")).toContainText("<测试> 2 尾");
    await page.screenshot({
      path: out + `fishing-${device}.png`,
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "结束本场", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("历史记录");
    await expect(page.locator("#main")).toContainText("手动结束场次");
    await page.reload();
    await expect(page.locator("#main")).toContainText("<测试> 2 尾");
    await page.goto(base + "/local/#stats");
    await expect(page.locator("#main")).toContainText("1 场 · 2 尾");
    await page.locator("#stats-flow").selectOption("未记录");
    await expect(page.locator("#main")).toContainText("0 场 · 0 尾");
    await page.locator("#stats-flow").selectOption("急");
    await expect(page.locator("#main")).toContainText("1 场 · 2 尾");
    for (const width of [320, 375, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of [
        "home",
        "prepare",
        "fishing",
        "history",
        "stats",
        "settings",
      ]) {
        await page.goto(base + "/local/#" + route);
        await page.locator("h1").waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          route + " overflow " + width,
        );
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: persisted workflow, isolated rods, history/stats, escaping, required fields, desktop/mobile evidence and overflow checks",
  );
} finally {
  await browser.close();
}
