"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, open, teardown, attrs } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await teardown(ctx); });

test("tabs: peran dan relasi ARIA terpasang", async () => {
  const page = await open(ctx);
  assert.equal(await page.$eval("#tabs .wc-tablist", (e) => e.getAttribute("role") + "|" + e.getAttribute("aria-label")), "tablist|Contoh");
  const tabs = await attrs(page, "#tabs wc-tab", ["role", "aria-selected", "tabindex", "aria-controls", "aria-disabled"]);
  assert.equal(tabs.length, 4);
  assert.deepEqual(tabs.map((t) => t.role), ["tab", "tab", "tab", "tab"]);
  assert.deepEqual(tabs.map((t) => t["aria-selected"]), ["true", "false", "false", "false"]);
  assert.deepEqual(tabs.map((t) => t.tabindex), ["0", "-1", "-1", "-1"]);
  assert.equal(tabs[2]["aria-disabled"], "true");
  // aria-controls menunjuk panel yang benar, dan panel menunjuk balik
  const ok = await page.$$eval("#tabs wc-tab", (ts) => ts.every((t) => {
    const p = document.getElementById(t.getAttribute("aria-controls"));
    return p && p.getAttribute("role") === "tabpanel" && p.getAttribute("aria-labelledby") === t.id;
  }));
  assert.ok(ok);
  const panels = await attrs(page, "#tabs wc-panel", ["hidden", "tabindex"]);
  assert.deepEqual(panels.map((p) => p.hidden), [false, true, true, true]);
  // panel tanpa elemen fokus mendapat tabindex=0; panel yang punya tautan tidak
  assert.equal(panels[0].tabindex, "0");
  assert.equal(panels[1].tabindex, null);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test("tabs: panah memilih, melewati tab nonaktif, dan berputar", async () => {
  const page = await open(ctx);
  await page.focus("#tabs wc-tab:nth-of-type(1)");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Dua");
  await page.keyboard.press("ArrowRight"); // Tiga nonaktif, lompat ke Empat
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Empat");
  assert.equal(await page.$eval("#tabs", (e) => e.selectedIndex), 3);
  assert.equal(await page.$eval("#tabs", (e) => e.getAttribute("selected")), "3");
  await page.keyboard.press("ArrowRight"); // berputar ke awal
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Satu");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Empat");
  await page.keyboard.press("Home");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Satu");
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Empat");
  assert.equal(await page.$eval("#tabs wc-panel:nth-of-type(4)", (e) => e.hidden), false);
  await page.close();
});

test("tabs: Tab berikutnya masuk ke panel, bukan ke tab lain", async () => {
  const page = await open(ctx);
  await page.focus("#tabs wc-tab:nth-of-type(1)");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Panel satu");
  await page.close();
});

test("tabs: klik memilih dan memicu wc-change sekali", async () => {
  const page = await open(ctx);
  await page.evaluate(() => { window.changes = []; document.getElementById("tabs").addEventListener("wc-change", (e) => changes.push(e.detail.index)); });
  await page.click("#tabs wc-tab:nth-of-type(2)");
  await page.click("#tabs wc-tab:nth-of-type(2)");
  await page.click("#tabs wc-tab:nth-of-type(3)", { force: true }); // nonaktif, diabaikan
  assert.deepEqual(await page.evaluate(() => changes), [1]);
  assert.equal(await page.$eval("#tabs wc-panel:nth-of-type(2)", (e) => e.hidden), false);
  await page.close();
});

test("tabs: mode manual, panah hanya memindah fokus, Enter memilih", async () => {
  const page = await open(ctx);
  assert.equal(await page.$eval("#manual", (e) => e.selectedIndex), 1); // atribut selected awal
  await page.focus("#manual wc-tab:nth-of-type(2)");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "C");
  assert.equal(await page.$eval("#manual", (e) => e.selectedIndex), 1);
  await page.keyboard.press("Enter");
  assert.equal(await page.$eval("#manual", (e) => e.selectedIndex), 2);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press(" ");
  assert.equal(await page.$eval("#manual", (e) => e.selectedIndex), 1);
  await page.close();
});

test("tabs: atribut selected dan tab baru disinkronkan", async () => {
  const page = await open(ctx);
  await page.$eval("#tabs", (e) => e.setAttribute("selected", "1"));
  assert.equal(await page.$eval("#tabs wc-tab:nth-of-type(2)", (e) => e.getAttribute("aria-selected")), "true");
  await page.$eval("#tabs", (e) => {
    const t = document.createElement("wc-tab"); t.textContent = "Lima";
    const p = document.createElement("wc-panel"); p.textContent = "Panel lima";
    e.append(t, p);
  });
  await page.waitForFunction(() => document.querySelectorAll("#tabs [role=tab]").length === 5);
  const last = await page.$eval("#tabs wc-tab:last-of-type", (t) => [t.getAttribute("role"), document.getElementById(t.getAttribute("aria-controls"))?.textContent]);
  assert.deepEqual(last, ["tab", "Panel lima"]);
  await page.close();
});
