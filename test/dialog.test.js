"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, open, teardown } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await teardown(ctx); });

const isOpen = (page, id = "dlg") => page.$eval("#" + id, (d) => d.isOpen && d.dialog.open);
const closed = (page, id = "dlg") => page.waitForFunction((id) => !document.getElementById(id).dialog.open, id);
const active = (page) => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);

test("dialog: label dan deskripsi diambil dari isi", async () => {
  const page = await open(ctx);
  const a = await page.$eval("#dlg", (d) => {
    const dlg = d.dialog;
    return [document.getElementById(dlg.getAttribute("aria-labelledby"))?.textContent, document.getElementById(dlg.getAttribute("aria-describedby"))?.textContent];
  });
  assert.deepEqual(a, ["Hapus berkas?", "Tindakan ini tidak bisa dibatalkan."]);
  assert.equal(await page.$eval("#keep", (d) => d.dialog.getAttribute("aria-label")), "Simpan perubahan");
  assert.equal(await page.$eval("#opener", (b) => b.getAttribute("aria-haspopup")), "dialog");
  await page.close();
});

test("dialog: tombol pembuka, fokus masuk, Escape menutup, fokus kembali", async () => {
  const page = await open(ctx);
  await page.click("#opener");
  assert.ok(await isOpen(page));
  assert.equal(await active(page), "cancel"); // elemen pertama yang bisa difokus
  assert.equal(await page.$eval("#dlg", (d) => d.hasAttribute("open")), true);
  await page.keyboard.press("Escape");
  await closed(page);
  assert.equal(await active(page), "opener");
  assert.equal(await page.$eval("#dlg", (d) => d.hasAttribute("open")), false);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test("dialog: fokus terkurung di dalam dialog", async () => {
  const page = await open(ctx);
  await page.click("#opener");
  const seen = new Set();
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); seen.add(await active(page)); }
  for (const id of seen) assert.ok(["cancel", "ok", "BODY", "DIALOG"].includes(id) || id === "", "fokus keluar ke " + id);
  assert.ok(!seen.has("before") && !seen.has("opener"));
  await page.close();
});

test("dialog: data-wc-close menutup dengan alasan", async () => {
  const page = await open(ctx);
  await page.evaluate(() => { window.reasons = []; document.getElementById("dlg").addEventListener("wc-close", (e) => reasons.push(e.detail.reason)); });
  await page.click("#opener");
  await page.click("#cancel");
  await closed(page);
  assert.deepEqual(await page.evaluate(() => reasons), ["batal"]);
  await page.close();
});

test("dialog: klik latar menutup, kecuali persistent", async () => {
  const page = await open(ctx, { viewport: { width: 1000, height: 800 } });
  await page.click("#opener");
  await page.mouse.click(20, 20);
  await closed(page);

  await page.click("#opener2");
  assert.equal(await active(page), "field"); // autofocus dihormati
  await page.mouse.click(20, 20);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  assert.ok(await isOpen(page, "keep"));
  await page.click("#keep [data-wc-close]");
  await closed(page, "keep");
  await page.close();
});

test("dialog: wc-beforeclose bisa membatalkan penutupan", async () => {
  const page = await open(ctx);
  await page.evaluate(() => document.getElementById("dlg").addEventListener("wc-beforeclose", (e) => { if (e.detail.reason === "escape") e.preventDefault(); }));
  await page.click("#opener");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  assert.ok(await isOpen(page));
  await page.click("#cancel");
  await closed(page);
  await page.close();
});

test("dialog: scroll halaman dikunci selama terbuka", async () => {
  const page = await open(ctx);
  await page.click("#opener");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await page.keyboard.press("Escape");
  await closed(page);
  assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-wc-locked")), false);
  await page.close();
});

test("dialog: API show, close, toggle, dan atribut open", async () => {
  const page = await open(ctx);
  await page.$eval("#dlg", (d) => d.show());
  assert.ok(await isOpen(page));
  await page.$eval("#dlg", (d) => d.toggle());
  await closed(page);
  await page.$eval("#dlg", (d) => d.setAttribute("open", ""));
  assert.ok(await isOpen(page));
  await page.$eval("#dlg", (d) => d.removeAttribute("open"));
  await closed(page);
  await page.close();
});
