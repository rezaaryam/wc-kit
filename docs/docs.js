/* Halaman dokumentasi wc-kit: inspektur, contoh, dan playground tema. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- tema terang dan gelap ---------- */
$("#tema-btn").addEventListener("click", () => {
  const d = document.documentElement;
  const dark = d.getAttribute("data-theme") === "dark" || (!d.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  d.setAttribute("data-theme", next);
  try { localStorage.setItem("wc-kit-tema", next); } catch (e) {}
});

/* ---------- pewarna kode sederhana ---------- */
function highlight(code, lang) {
  let out = esc(code);
  if (lang === "html") {
    out = out.replace(/(&lt;\/?)([\w-]+)([\s\S]*?)(\/?&gt;)/g, (m, open, tag, attrs, close) => {
      const a = attrs.replace(/([\w-]+)(=)(&quot;[^&]*?&quot;)/g, '<span class="a">$1</span><span class="p">$2</span><span class="s">$3</span>')
        .replace(/(\s)([\w-]+)(?=\s|$)/g, '$1<span class="a">$2</span>');
      return `<span class="p">${open}</span><span class="t">${tag}</span>${a}<span class="p">${close}</span>`;
    });
  } else if (lang === "css") {
    out = out.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="c">$1</span>')
      .replace(/(--[\w-]+)(:)/g, '<span class="a">$1</span>$2')
      .replace(/:\s([^;<]+);/g, ': <span class="s">$1</span>;')
      .replace(/^([\w-, ]+)(\s\{)/gm, '<span class="t">$1</span>$2');
  } else if (lang === "js") {
    out = out.replace(/(&quot;[^&]*?&quot;|"[^"]*")/g, '<span class="s">$1</span>')
      .replace(/\b(const|let|function|return|document|console)\b/g, '<span class="k">$1</span>')
      .replace(/\.(\w+)(?=\()/g, '.<span class="a">$1</span>');
  }
  return out;
}
$$("pre.code[data-lang]").forEach((pre) => { if (pre.id !== "themeOut") pre.innerHTML = highlight(pre.textContent, pre.dataset.lang); });

/* ---------- salin ---------- */
$$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
  const text = btn.getAttribute("data-copy");
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
  }
  btn.setAttribute("data-done", "");
  btn.querySelector(".sr").textContent = "Tersalin";
  setTimeout(() => { btn.removeAttribute("data-done"); btn.querySelector(".sr").textContent = "Salin kode"; }, 1600);
}));

/* ---------- Inspektur ARIA ---------- */
const ins = $("#inspector");
const insCode = $("#insCode");
const insKeys = $("#insKeys");
if (matchMedia("(pointer: coarse)").matches) {
  insKeys.innerHTML = '<span class="muted">ketuk sebuah tab</span>';
  insCode.innerHTML = '<span class="muted">Ketuk tab di atas.\nAtribut ARIA-nya tampil di sini.</span>';
}
const KEYNAME = { ArrowRight: "→", ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", " ": "Spasi", Escape: "Esc", Enter: "Enter", Tab: "Tab", Home: "Home", End: "End", Shift: "Shift" };
const SHOW = (n) => n === "role" || n.startsWith("aria-") || ["tabindex", "open", "disabled", "hidden", "selected"].includes(n);
let watched = null, mo = null, prevVals = {}, lastPointer = false;

function describe(el, changed = new Set()) {
  const tag = el.localName;
  const list = Array.from(el.attributes).filter((a) => SHOW(a.name));
  // `hidden` dan `open` sebagai properti juga relevan walau atribut tidak ada.
  const lines = list.map((a) => {
    const cls = changed.has(a.name) ? " chg" : "";
    return `  <span class="a${cls}">${a.name}</span>${a.value === "" ? "" : `=<span class="v${cls}">"${esc(a.value)}"</span>`}`;
  });
  const text = (el.matches("input, textarea") ? "" : (el.textContent || "").trim().replace(/\s+/g, " ")).slice(0, 28);
  let html = `<span class="t">&lt;${tag}</span>` + (lines.length ? "\n" + lines.join("\n") + "\n" : "") + `<span class="t">&gt;</span>` + esc(text) + (text.length === 28 ? "…" : "");
  // Catatan kecil yang menjelaskan apa yang terjadi.
  const role = el.getAttribute("role");
  let note = "";
  if (role === "tab") {
    const p = document.getElementById(el.getAttribute("aria-controls"));
    if (p) note = `panel terkait ${p.hidden ? "tersembunyi" : "tampil"}`;
  } else if (tag === "summary") {
    note = el.getAttribute("aria-expanded") === "true" ? "isi terbuka" : "isi tertutup";
  } else if (el.closest("dialog[open]")) {
    note = "fokus terkurung di dalam dialog";
  } else if (role === "tabpanel") {
    note = "panel bisa difokus karena tidak berisi tautan atau tombol";
  }
  if (note) html += `\n<span class="note">// ${note}</span>`;
  return html;
}

function snapshot(el) {
  const o = {};
  Array.from(el.attributes).forEach((a) => { if (SHOW(a.name)) o[a.name] = a.value; });
  return o;
}

function render(el, diff) {
  const now = snapshot(el);
  const changed = new Set();
  if (diff) Object.keys(now).forEach((k) => { if (prevVals[k] !== now[k]) changed.add(k); });
  prevVals = now;
  insCode.innerHTML = describe(el, changed);
}

function watch(el) {
  if (mo) mo.disconnect();
  watched = el;
  prevVals = snapshot(el);
  render(el, false);
  mo = new MutationObserver(() => render(el, true));
  mo.observe(el, { attributes: true });
  // Atribut tab tetangga berubah saat memilih, perbarui catatan panel juga.
  const sib = el.getAttribute("aria-controls") && document.getElementById(el.getAttribute("aria-controls"));
  if (sib) mo.observe(sib, { attributes: true, attributeFilter: ["hidden"] });
}

document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (!(el instanceof Element) || el === document.body) return;
  if (ins.contains(el)) return;
  watch(el);
  if (!lastPointer || !ins.classList.contains("docked")) ins.setAttribute("data-live", "");
});
document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (document.activeElement === document.body || !document.activeElement) {
      ins.removeAttribute("data-live");
    }
  }, 0);
});

let keyTimer;
document.addEventListener("keydown", (e) => {
  lastPointer = false;
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
  const name = (e.shiftKey && e.key === "Tab" ? "Shift " : "") + (KEYNAME[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key));
  const k = document.createElement("kbd");
  k.textContent = name;
  const muted = insKeys.querySelector(".muted");
  if (muted) muted.remove();
  insKeys.appendChild(k);
  while (insKeys.children.length > 4) insKeys.firstElementChild.remove();
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => { insKeys.innerHTML = ""; }, 2600);
  if (document.activeElement && document.activeElement !== document.body) ins.setAttribute("data-live", "");
}, true);
document.addEventListener("pointerdown", () => {
  lastPointer = true;
  if (ins.classList.contains("docked")) ins.removeAttribute("data-live");
}, true);

// Saat hero sudah lewat, inspektur melayang di pojok (desktop saja).
const hero = $(".hero");
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([en]) => {
    const wide = innerWidth > 1060;
    ins.classList.toggle("docked", !en.isIntersecting && wide);
    if (!en.isIntersecting && lastPointer) ins.removeAttribute("data-live");
  }, { threshold: 0, rootMargin: "-120px 0px 0px 0px" }).observe($(".ins-slot"));
}

/* ---------- opsi contoh tabs dan accordion ---------- */
const demoTabs = $("#demoTabs");
$("#optVertical").addEventListener("change", (e) => {
  if (e.target.checked) demoTabs.setAttribute("orientation", "vertical"); else demoTabs.removeAttribute("orientation");
});
$("#optManual").addEventListener("change", (e) => {
  if (e.target.checked) demoTabs.setAttribute("activation", "manual"); else demoTabs.removeAttribute("activation");
});
$("#optSingle").addEventListener("change", (e) => $("#demoAcc").toggleAttribute("single", e.target.checked));

/* ---------- catatan event dialog ---------- */
const log = $("#evlog");
let t0 = 0;
function addLog(name, detail, cls = "") {
  if (log.querySelector(".muted")) log.innerHTML = "";
  if (!t0) t0 = performance.now();
  const li = document.createElement("li");
  if (cls) li.className = cls;
  li.innerHTML = `<i>+${((performance.now() - t0) / 1000).toFixed(1)}s</i><b>${name}</b><span>${esc(detail)}</span>`;
  log.prepend(li);
  while (log.children.length > 5) log.lastElementChild.remove();
}
["dlgHapus", "dlgDraft"].forEach((id) => {
  const d = document.getElementById(id);
  d.addEventListener("wc-open", (e) => { if (log.querySelector(".muted") || !log.children.length) t0 = 0; addLog("wc-open", `#${id}, dari "${(e.detail.opener?.textContent || "").trim()}"`); });
  d.addEventListener("wc-beforeclose", (e) => queueMicrotask(() => addLog(e.defaultPrevented ? "wc-beforeclose" : "wc-beforeclose", `reason: ${e.detail.reason}${e.defaultPrevented ? ", dibatalkan" : ""}`, e.defaultPrevented ? "cancel" : "")));
  d.addEventListener("wc-close", (e) => addLog("wc-close", `reason: ${e.detail.reason}`));
});

// Dialog "Ubah judul": tahan penutupan bila ada isian yang belum disimpan.
const draft = $("#dlgDraft"), input = $("#draftInput"), warn = $("#draftWarn");
let initial = input.value, warned = false;
draft.addEventListener("wc-open", () => { input.value = initial; warned = false; warn.hidden = true; requestAnimationFrame(() => input.select()); });
draft.addEventListener("wc-beforeclose", (e) => {
  const dirty = input.value !== initial;
  if (e.detail.reason === "simpan") { initial = input.value; return; }
  if (dirty && !warned && (e.detail.reason === "escape" || e.detail.reason === "backdrop")) {
    e.preventDefault();
    warned = true;
    warn.hidden = false;
  }
});

/* ---------- playground tema ---------- */
const root = document.documentElement.style;
const out = $("#themeOut");
function applyTheme() {
  const accent = $("#themeForm input[name=accent]:checked").value;
  const r = $("#radius").value, d = $("#dur").value;
  root.setProperty("--accent", accent);
  root.setProperty("--radius", r + "px");
  root.setProperty("--dur", d + "ms");
  $("#oRadius").textContent = r + "px";
  $("#oDur").textContent = d + "ms";
  out.innerHTML = highlight(`/* tempel di CSS Anda */\nwc-tabs, wc-accordion, wc-dialog {\n  --wc-accent: ${accent};\n  --wc-radius: ${r}px;\n  --wc-duration: ${d}ms;\n}`, "css");
}
$("#themeForm").addEventListener("input", applyTheme);
applyTheme();

/* ---------- muncul saat discroll ---------- */
if ("IntersectionObserver" in window && !reduce) {
  const items = [];
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    // Bagian yang terlewat saat scroll cepat atau lompat lewat menu ikut ditampilkan.
    for (const el of items) {
      el.classList.add("in");
      io.unobserve(el);
      if (el === e.target) break;
    }
  }), { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
  $$(".facts, .comp-h, .comp-body, .api-tabs, .theme, .steps").forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("rv"); items.push(el); io.observe(el); }
  });
}
