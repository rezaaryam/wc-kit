"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, open, teardown, attrs } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await teardown(ctx); });

const openState = (page, sel) => page.$$eval(sel + " > details", (ds) => ds.map((d) => d.open));
const settle = (page) => page.waitForFunction(() => !document.querySelector("details[data-anim]"));

test("accordion: summary punya aria-expanded dan aria-controls", async () => {
  const page = await open(ctx);
  const s = await attrs(page, "#acc summary", ["aria-expanded", "aria-controls"]);
  assert.deepEqual(s.map((x) => x["aria-expanded"]), ["false", "true", "false"]);
  const ok = await page.$$eval("#acc summary", (ss) => ss.every((x) => {
    const r = document.getElementById(x.getAttribute("aria-controls"));
    return r && r.getAttribute("role") === "region" && r.getAttribute("aria-labelledby") === x.id;
  }));
  assert.ok(ok);
  await page.close();
});

test("accordion: mode single menutup item lain", async () => {
  const page = await open(ctx);
  await page.click("#acc summary >> text=Pertama");
  await settle(page);
  assert.deepEqual(await openState(page, "#acc"), [true, false, false]);
  await page.click("#acc summary >> text=Ketiga");
  await settle(page);
  assert.deepEqual(await openState(page, "#acc"), [false, false, true]);
  await page.click("#acc summary >> text=Ketiga");
  await settle(page);
  assert.deepEqual(await openState(page, "#acc"), [false, false, false]);
  assert.equal(await page.$eval("#acc summary >> nth=2", (s) => s.getAttribute("aria-expanded")), "false");
  await page.close();
});

test("accordion: tanpa single, beberapa item boleh terbuka", async () => {
  const page = await open(ctx);
  await page.click("#multi summary >> text=M1");
  await page.click("#multi summary >> text=M2");
  await settle(page);
  assert.deepEqual(await openState(page, "#multi"), [true, true]);
  await page.close();
});

test("accordion: keyboard Enter membuka, panah dan Home/End memindah fokus", async () => {
  const page = await open(ctx);
  await page.focus("#acc summary >> nth=0");
  await page.keyboard.press("Enter");
  await settle(page);
  assert.deepEqual(await openState(page, "#acc"), [true, false, false]);
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Kedua");
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Ketiga");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Pertama");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Ketiga");
  await page.close();
});

test("accordion: animasi selesai dengan tinggi kembali otomatis", async () => {
  const page = await open(ctx);
  await page.click("#acc summary >> text=Pertama");
  const during = await page.$eval("#acc details", (d) => d.getAttribute("data-anim"));
  assert.equal(during, "open");
  await settle(page);
  assert.equal(await page.$eval("#acc details", (d) => d.style.height), "");
  await page.close();
});

test("accordion: wc-toggle membawa indeks dan status", async () => {
  const page = await open(ctx);
  await page.evaluate(() => { window.log = []; document.getElementById("multi").addEventListener("wc-toggle", (e) => log.push([e.detail.index, e.detail.open])); });
  await page.$eval("#multi", (a) => a.open(1));
  await page.$eval("#multi", (a) => a.close(1));
  assert.deepEqual(await page.evaluate(() => log), [[1, true], [1, false]]);
  await page.close();
});

test("accordion: tanpa gerak bila pengguna meminta gerak dikurangi", async () => {
  const page = await open(ctx, { reducedMotion: "reduce" });
  await page.click("#multi summary >> text=M1");
  assert.equal(await page.$eval("#multi details", (d) => [d.open, d.hasAttribute("data-anim")].join()), "true,false");
  await page.close();
});
