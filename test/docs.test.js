"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

test("salinan di docs/ sama persis dengan src/ (jalankan npm run sync)", () => {
  for (const f of ["wc-kit.js", "wc-kit.css"]) {
    assert.equal(fs.readFileSync(path.join(root, "docs", f), "utf8"), fs.readFileSync(path.join(root, "src", f), "utf8"), f);
  }
});

test("versi di package.json, kode, dan CHANGELOG sama", () => {
  const { version } = require("../package.json");
  const src = fs.readFileSync(path.join(root, "src", "wc-kit.js"), "utf8");
  assert.ok(src.includes(`wc-kit ${version}`));
  assert.ok(src.includes(`export const version = "${version}"`));
  assert.ok(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").includes(`## ${version}`));
});
