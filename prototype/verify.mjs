// Browser dependency is supplied externally; the prototype itself has no dependencies.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || "@playwright/test",
);
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
});
const base = process.env.PROTOTYPE_URL || "http://127.0.0.1:8092/prototype/";
const out = new URL("../docs/prototype-evidence/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const expectText = async (s, t) => expect(page.locator(s)).toContainText(t);
if (process.env.BASELINE_URL) {
  await page.goto(process.env.BASELINE_URL);
  await page.getByRole("heading", { name: "竿边 · 本地工程验证" }).waitFor();
  await page.screenshot({ path: out + "before-desktop.png", fullPage: true });
}
await page.goto(base);
for (const route of [
  "home",
  "prepare",
  "rod-0",
  "fishing",
  "history",
  "detail",
  "stats",
  "catalog",
  "profile",
]) {
  await page.goto(base + "#" + route);
  await page.locator("h1").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    route + " overflow",
  );
  await page.screenshot({ path: out + route + "-desktop.png", fullPage: true });
}
await page.goto(base + "#prepare");
await page.getByRole("link", { name: "单竿设置" }).first().click();
await page.locator('[name="interval"]').selectOption("1.5");
await page.getByRole("button", { name: "保存单竿配置" }).click();
await expectText(".rod:nth-child(1)", /1.5 小时/);
await expectText(".rod:nth-child(2)", /2 小时/);
await page.locator('[name="count"]').selectOption("4");
await page.getByRole("button", { name: "应用到全部竿" }).click();
await page.getByRole("button", { name: "取消", exact: true }).click();
assert.equal(await page.locator(".rod").count(), 3);
await page.getByRole("button", { name: "应用到全部竿" }).click();
await page.getByRole("button", { name: "确认", exact: true }).click();
await expect(page.locator(".rod")).toHaveCount(4);
await page.locator('[name="water"]').fill("18.5");
await page.getByRole("button", { name: "确认配置，预览垂钓中 →" }).click();
await expectText("main", /18.5°C/);
await page.getByRole("button", { name: "记录本竿换饵" }).first().click();
await expectText(".timeline", /1 号竿换饵/);
await page.getByRole("button", { name: "记一笔渔获" }).click();
await page.getByRole("button", { name: "取消", exact: true }).click();
await expect(page.locator("dialog")).toHaveCount(0);
await page.getByRole("button", { name: "记一笔渔获" }).click();
await page.locator('[name="fish"]').fill("<script>alert(1)</script>");
await page.getByRole("button", { name: "确认", exact: true }).click();
await expectText(".timeline", /<script>alert\(1\)<\/script>/);
assert.equal(await page.locator("main script").count(), 0);
await page.getByRole("button", { name: "补充现场观察" }).click();
await page.getByRole("button", { name: "确认", exact: true }).click();
await expectText(".timeline", /水温未记录/);
await page.getByRole("button", { name: "结束本场", exact: true }).click();
await page.getByRole("button", { name: "确认", exact: true }).click();
await expect(
  page.getByRole("button", { name: "记录本竿换饵" }).first(),
).toBeDisabled();
await page.goto(base + "#history");
await page.getByRole("button", { name: "北岸芦苇荡", exact: true }).click();
assert.equal(await page.locator(".trip-row").count(), 1);
await page.locator(".trip-row").click();
await expectText("h1", /北岸芦苇荡/);
await page.goto(base + "#catalog");
await page.getByRole("link", { name: "去准备" }).nth(2).click();
await expect(page.locator('[name="spot"]')).toHaveValue("石桥下游");
await page.reload();
await page.goto(base + "#prepare");
assert.equal(await page.locator(".rod").count(), 3);
await page.setViewportSize({ width: 390, height: 844 });
if (process.env.BASELINE_URL) {
  await page.goto(process.env.BASELINE_URL);
  await page.getByRole("heading", { name: "竿边 · 本地工程验证" }).waitFor();
  await page.screenshot({ path: out + "before-mobile.png", fullPage: true });
}
for (const route of [
  "home",
  "prepare",
  "rod-0",
  "fishing",
  "history",
  "detail",
  "stats",
  "catalog",
  "profile",
]) {
  await page.goto(base + "#" + route);
  await page.locator("h1").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    route + " mobile overflow",
  );
  await page.screenshot({ path: out + route + "-mobile.png", fullPage: true });
}
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "PASS: 9 desktop/mobile routes, per-rod edit, batch cancel/confirm, fractional interval, environment, rebait, catch escaping, end, history filter, refresh reset; no browser exceptions or horizontal overflow.",
);
