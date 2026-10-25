"use strict";
/*
 * Server statis kecil dan peluncur browser untuk tes.
 * Pilih mesin dengan BROWSER=chromium | firefox | webkit (bawaan chromium).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, firefox, webkit } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp", ".gif": "image/gif" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, url.endsWith("/") ? url + "index.html" : url);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function setup() {
  const engine = { chromium, firefox, webkit }[process.env.BROWSER || "chromium"];
  const { server, url } = await serve();
  const browser = await engine.launch();
  return { server, url, browser };
}

/** Halaman baru dari fixture, menunggu semua elemen terdaftar. */
async function open(ctx, opts = {}) {
  const page = await ctx.browser.newPage(opts);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ctx.url + "/test/fixtures/index.html");
  await page.waitForFunction(() => customElements.get("wc-dialog") && document.querySelector("wc-tabs[data-ready]"));
  page.errors = errors;
  return page;
}

async function teardown(ctx) {
  await ctx.browser.close();
  await new Promise((r) => ctx.server.close(r));
}

/** Atribut beberapa elemen sekaligus, supaya assertion ringkas. */
function attrs(page, selector, names) {
  return page.$$eval(selector, (els, names) => els.map((e) => Object.fromEntries(names.map((n) => [n, n === "hidden" ? e.hidden : e.getAttribute(n)]))), names);
}

module.exports = { setup, open, teardown, attrs };
