#!/usr/bin/env node
// Menyalin src/ ke docs/ supaya GitHub Pages menyajikan versi terbaru.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
for (const f of ["wc-kit.js", "wc-kit.css"]) {
  fs.copyFileSync(path.join(root, "src", f), path.join(root, "docs", f));
  console.log("docs/" + f + " diperbarui");
}
