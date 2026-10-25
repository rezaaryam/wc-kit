/*!
 * wc-kit 1.0.0
 * Komponen web yang bisa diakses: <wc-tabs>, <wc-accordion>, <wc-dialog>.
 * Tanpa dependensi, tanpa framework. MIT License, Reza Arya Maulana.
 */

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Membaca --wc-duration dalam milidetik. 0 tetap 0, bukan jatuh ke nilai bawaan. */
function duration(el, fallback) {
  const v = parseFloat(getComputedStyle(el).getPropertyValue("--wc-duration"));
  return Number.isNaN(v) ? fallback : v;
}

let uid = 0;
/** Memberi id unik bila elemen belum punya. */
function ensureId(el, prefix) {
  if (!el.id) el.id = `${prefix}-${++uid}`;
  return el.id;
}

const FOCUSABLE = [
  "a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])", "textarea:not([disabled])", "iframe", "summary",
  "[contenteditable]:not([contenteditable=false])", "[tabindex]:not([tabindex='-1'])"
].join(",");

function emit(el, name, detail, cancelable = false) {
  const ev = new CustomEvent(name, { bubbles: true, composed: true, cancelable, detail });
  return el.dispatchEvent(ev);
}

/* ======================================================================
 * <wc-tabs>
 *
 *   <wc-tabs label="Pengaturan akun">
 *     <wc-tab>Profil</wc-tab>
 *     <wc-tab>Keamanan</wc-tab>
 *     <wc-panel>...</wc-panel>
 *     <wc-panel>...</wc-panel>
 *   </wc-tabs>
 *
 * Atribut: selected (indeks), activation="manual", orientation="vertical", label
 * Event:   wc-change { index, tab, panel }
 * ====================================================================== */
export class WcTabs extends HTMLElement {
  static get observedAttributes() { return ["selected", "orientation", "label"]; }

  constructor() {
    super();
    this._onKey = this._onKey.bind(this);
    this._onClick = this._onClick.bind(this);
    this._sync = this._sync.bind(this);
  }

  connectedCallback() {
    if (!this._list) {
      this._list = document.createElement("div");
      this._list.className = "wc-tablist";
      this._list.setAttribute("role", "tablist");
      this._list.setAttribute("part", "tablist");
      this._list.addEventListener("keydown", this._onKey);
      this._list.addEventListener("click", this._onClick);
      this._indicator = document.createElement("span");
      this._indicator.className = "wc-indicator";
      this._indicator.setAttribute("aria-hidden", "true");
      this._list.appendChild(this._indicator);
    }
    // Anak bisa ditambah atau dihapus kapan saja; kita sinkronkan ulang.
    this._mo = new MutationObserver(() => { if (!this._syncing) this._sync(); });
    this._mo.observe(this, { childList: true });
    this._ro = "ResizeObserver" in window ? new ResizeObserver(() => this._moveIndicator()) : null;
    if (this._ro) this._ro.observe(this._list);
    this._sync();
  }

  disconnectedCallback() {
    if (this._mo) this._mo.disconnect();
    if (this._ro) this._ro.disconnect();
  }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._list || oldV === newV) return;
    if (name === "selected") this.select(+newV, { focus: false, silent: true });
    else this._sync();
  }

  get tabs() { return this._list ? Array.from(this._list.querySelectorAll(":scope > wc-tab")) : []; }
  get panels() { return Array.from(this.querySelectorAll(":scope > wc-panel")); }
  get selectedIndex() { return this._index ?? 0; }
  get vertical() { return this.getAttribute("orientation") === "vertical"; }
  get manual() { return this.getAttribute("activation") === "manual"; }

  _sync() {
    this._syncing = true;
    // Pindahkan setiap <wc-tab> ke dalam tablist, sesuai urutan dokumen.
    const loose = Array.from(this.querySelectorAll(":scope > wc-tab"));
    if (!this._list.isConnected) this.prepend(this._list);
    loose.forEach((t) => this._list.insertBefore(t, this._indicator));

    const tabs = this.tabs, panels = this.panels;
    this._list.setAttribute("aria-orientation", this.vertical ? "vertical" : "horizontal");
    if (this.hasAttribute("label")) this._list.setAttribute("aria-label", this.getAttribute("label"));

    tabs.forEach((tab, i) => {
      const panel = panels[i];
      tab.setAttribute("role", "tab");
      ensureId(tab, "wc-tab");
      if (panel) {
        panel.setAttribute("role", "tabpanel");
        ensureId(panel, "wc-panel");
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("aria-labelledby", tab.id);
        // Panel tanpa elemen yang bisa difokus tetap harus bisa dicapai dengan Tab.
        if (!panel.querySelector(FOCUSABLE)) panel.setAttribute("tabindex", "0");
        else panel.removeAttribute("tabindex");
      }
      if (tab.hasAttribute("disabled")) tab.setAttribute("aria-disabled", "true");
      else tab.removeAttribute("aria-disabled");
    });

    let want = this.hasAttribute("selected") ? +this.getAttribute("selected") : this._index ?? 0;
    if (!(want >= 0 && want < tabs.length) || tabs[want]?.hasAttribute("disabled")) {
      want = tabs.findIndex((t) => !t.hasAttribute("disabled"));
    }
    this._syncing = false;
    if (want >= 0) this.select(want, { focus: false, silent: true, force: true });
    this.setAttribute("data-ready", "");
  }

  /** Pilih tab ke-i. Mengembalikan false bila tab tidak ada atau nonaktif. */
  select(i, { focus = true, silent = false, force = false } = {}) {
    const tabs = this.tabs, panels = this.panels;
    const tab = tabs[i];
    if (!tab || tab.hasAttribute("disabled")) return false;
    const changed = i !== this._index;
    if (!changed && !force) { if (focus) tab.focus(); return true; }
    this._index = i;
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (panels[j]) panels[j].hidden = !on;
    });
    this._syncing = true;
    if (this.getAttribute("selected") !== String(i)) this.setAttribute("selected", i);
    this._syncing = false;
    if (focus) tab.focus();
    this._moveIndicator();
    if (changed && !silent) emit(this, "wc-change", { index: i, tab, panel: panels[i] || null });
    return true;
  }

  _moveIndicator() {
    const tab = this.tabs[this._index ?? 0];
    if (!tab || !this._indicator) return;
    const s = this._list.style;
    if (this.vertical) {
      s.setProperty("--wc-ind-pos", tab.offsetTop + "px");
      s.setProperty("--wc-ind-size", tab.offsetHeight + "px");
    } else {
      s.setProperty("--wc-ind-pos", tab.offsetLeft + "px");
      s.setProperty("--wc-ind-size", tab.offsetWidth + "px");
    }
  }

  _onClick(e) {
    const tab = e.target.closest("wc-tab");
    if (!tab || tab.parentNode !== this._list) return;
    this.select(this.tabs.indexOf(tab));
  }

  _onKey(e) {
    const tabs = this.tabs;
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    const next = this.vertical ? "ArrowDown" : "ArrowRight";
    const prev = this.vertical ? "ArrowUp" : "ArrowLeft";
    const enabled = (i) => !tabs[i].hasAttribute("disabled");
    const step = (dir) => {
      let i = cur;
      for (let n = 0; n < tabs.length; n++) {
        i = (i + dir + tabs.length) % tabs.length;
        if (enabled(i)) return i;
      }
      return cur;
    };
    let to = null;
    if (e.key === next) to = step(1);
    else if (e.key === prev) to = step(-1);
    else if (e.key === "Home") to = tabs.findIndex((_, i) => enabled(i));
    else if (e.key === "End") to = tabs.length - 1 - [...tabs].reverse().findIndex((t) => !t.hasAttribute("disabled"));
    else if ((e.key === "Enter" || e.key === " ") && this.manual) {
      e.preventDefault();
      this.select(cur);
      return;
    } else return;

    e.preventDefault();
    if (this.manual) {
      // Mode manual: panah hanya memindahkan fokus. Enter atau Spasi memilih.
      tabs.forEach((t, j) => (t.tabIndex = j === to ? 0 : -1));
      tabs[to].focus();
    } else {
      this.select(to);
    }
  }
}

/* ======================================================================
 * <wc-accordion>
 *
 *   <wc-accordion single>
 *     <details><summary>Pertanyaan</summary><div>Jawaban</div></details>
 *     ...
 *   </wc-accordion>
 *
 * Tanpa JavaScript, <details> tetap bekerja seperti biasa. Komponen ini
 * menambahkan animasi tinggi, mode satu-terbuka, dan navigasi panah.
 * Atribut: single
 * Event:   wc-toggle { details, open, index }
 * ====================================================================== */
export class WcAccordion extends HTMLElement {
  constructor() {
    super();
    this._onClick = this._onClick.bind(this);
    this._onKey = this._onKey.bind(this);
  }

  connectedCallback() {
    this.addEventListener("click", this._onClick);
    this.addEventListener("keydown", this._onKey);
    this._mo = new MutationObserver(() => this._sync());
    this._mo.observe(this, { childList: true });
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._onClick);
    this.removeEventListener("keydown", this._onKey);
    if (this._mo) this._mo.disconnect();
  }

  get items() { return Array.from(this.querySelectorAll(":scope > details")); }
  get single() { return this.hasAttribute("single"); }

  _sync() {
    this.items.forEach((d) => {
      const s = d.querySelector(":scope > summary");
      if (!s) return;
      ensureId(s, "wc-sum");
      s.setAttribute("aria-expanded", String(d.open));
      const body = d.querySelector(":scope > :not(summary)");
      if (body) {
        ensureId(body, "wc-acc");
        s.setAttribute("aria-controls", body.id);
        body.setAttribute("role", "region");
        body.setAttribute("aria-labelledby", s.id);
      }
    });
    if (this.single) {
      const open = this.items.filter((d) => d.open);
      open.slice(1).forEach((d) => this._setOpen(d, false, false));
    }
    this.setAttribute("data-ready", "");
  }

  /** Buka atau tutup item ke-i (atau elemen <details>). */
  toggle(target, force) {
    const d = typeof target === "number" ? this.items[target] : target;
    if (!d) return;
    const open = force ?? !d.open;
    if (open === d.open && !d._wcAnim) return;
    if (open && this.single) this.items.forEach((o) => { if (o !== d && o.open) this._setOpen(o, false, true); });
    this._setOpen(d, open, true);
  }
  open(i) { this.toggle(i, true); }
  close(i) { this.toggle(i, false); }

  _setOpen(d, open, animate) {
    const s = d.querySelector(":scope > summary");
    const done = () => {
      d.open = open;
      d.style.height = d.style.overflow = "";
      d._wcAnim = null;
      d.removeAttribute("data-anim");
    };
    if (s) s.setAttribute("aria-expanded", String(open));
    d.toggleAttribute("data-open", open);
    if (d._wcAnim) d._wcAnim.cancel();

    if (!animate || reduceMotion() || !d.animate) {
      done();
    } else {
      const cs = getComputedStyle(d);
      const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const from = d.offsetHeight;
      if (open) d.open = true;
      // Tinggi tertutup = summary + padding + border. Tinggi terbuka = seluruh isi + border.
      const to = open ? d.scrollHeight + borders
        : s.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + borders;
      d.style.overflow = "hidden";
      d.setAttribute("data-anim", open ? "open" : "close");
      const dur = duration(this, 260);
      d._wcAnim = d.animate({ height: [from + "px", to + "px"] }, { duration: dur, easing: "cubic-bezier(.2,.7,.2,1)" });
      d._wcAnim.onfinish = done;
      d._wcAnim.oncancel = () => { d.style.height = d.style.overflow = ""; };
    }
    emit(this, "wc-toggle", { details: d, open, index: this.items.indexOf(d) });
  }

  _onClick(e) {
    const s = e.target.closest("summary");
    if (!s || s.parentElement?.parentElement !== this) return;
    e.preventDefault(); // kita yang mengatur buka-tutup, supaya bisa dianimasikan
    this.toggle(s.parentElement);
  }

  _onKey(e) {
    const sums = this.items.map((d) => d.querySelector(":scope > summary")).filter(Boolean);
    const i = sums.indexOf(document.activeElement);
    if (i < 0) return;
    let to = null;
    if (e.key === "ArrowDown") to = (i + 1) % sums.length;
    else if (e.key === "ArrowUp") to = (i - 1 + sums.length) % sums.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = sums.length - 1;
    if (to === null) return;
    e.preventDefault();
    sums[to].focus();
  }
}

/* ======================================================================
 * <wc-dialog>
 *
 *   <button data-wc-open="hapus">Hapus</button>
 *   <wc-dialog id="hapus">
 *     <h2>Hapus berkas?</h2>
 *     <p>...</p>
 *     <button data-wc-close>Batal</button>
 *   </wc-dialog>
 *
 * Dibangun di atas <dialog> bawaan (lapisan atas, inert, Escape), lalu
 * ditambah: fokus kembali ke pembuka, klik latar untuk menutup, kunci scroll
 * yang aman di iOS, animasi keluar, dan event yang bisa dibatalkan.
 * Atribut: open, label, persistent (latar dan Escape tidak menutup)
 * Metode:  show(), close(reason), toggle()
 * Event:   wc-open, wc-beforeclose (bisa dibatalkan) { reason }, wc-close { reason }
 * ====================================================================== */
let scrollLocks = 0;
let savedScroll = null;

function lockScroll() {
  if (scrollLocks++ > 0) return;
  const html = document.documentElement;
  const gap = window.innerWidth - html.clientWidth;
  savedScroll = { overflow: html.style.overflow, pad: html.style.paddingRight };
  html.style.overflow = "hidden";
  if (gap > 0) html.style.paddingRight = gap + "px";
  html.setAttribute("data-wc-locked", "");
}
function unlockScroll() {
  if (--scrollLocks > 0 || !savedScroll) return;
  scrollLocks = 0;
  const html = document.documentElement;
  html.style.overflow = savedScroll.overflow;
  html.style.paddingRight = savedScroll.pad;
  html.removeAttribute("data-wc-locked");
  savedScroll = null;
}

export class WcDialog extends HTMLElement {
  static get observedAttributes() { return ["open", "label"]; }

  connectedCallback() {
    if (!this._dlg) {
      const dlg = document.createElement("dialog");
      dlg.className = "wc-dialog";
      dlg.setAttribute("part", "dialog");
      while (this.firstChild) dlg.appendChild(this.firstChild);
      this.appendChild(dlg);
      this._dlg = dlg;

      dlg.addEventListener("cancel", (e) => {
        // Escape: kita tangani sendiri agar ada animasi dan wc-beforeclose.
        e.preventDefault();
        if (!this.hasAttribute("persistent")) this.close("escape");
      });
      dlg.addEventListener("click", (e) => {
        const closer = e.target.closest("[data-wc-close]");
        if (closer && dlg.contains(closer)) { this.close(closer.getAttribute("data-wc-close") || "button"); return; }
        if (e.target !== dlg || this.hasAttribute("persistent")) return;
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        // Klik pada ::backdrop melaporkan target = dialog dengan titik di luar kotaknya.
        if (!inside) this.close("backdrop");
      });
      // Bila dialog ditutup dari luar (misal form method=dialog), rapikan juga.
      dlg.addEventListener("close", () => { if (this._isOpen) this._finishClose(dlg.returnValue || "form"); });
    }
    this._label();
    if (this.hasAttribute("open") && !this._isOpen) this.show();
    this.setAttribute("data-ready", "");
  }

  disconnectedCallback() {
    if (this._isOpen) { this._isOpen = false; unlockScroll(); }
  }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._dlg) return;
    if (name === "label") this._label();
    if (name === "open") {
      if (newV !== null && !this._isOpen) this.show();
      if (newV === null && this._isOpen && !this._closing) this.close("attribute");
    }
  }

  get dialog() { return this._dlg; }
  get isOpen() { return !!this._isOpen; }

  _label() {
    const dlg = this._dlg;
    if (this.hasAttribute("label")) {
      dlg.setAttribute("aria-label", this.getAttribute("label"));
      dlg.removeAttribute("aria-labelledby");
    } else {
      const h = dlg.querySelector("h1, h2, h3, h4, [data-wc-title]");
      if (h) dlg.setAttribute("aria-labelledby", ensureId(h, "wc-title"));
    }
    const desc = dlg.querySelector("[data-wc-desc]");
    if (desc) dlg.setAttribute("aria-describedby", ensureId(desc, "wc-desc"));
  }

  show(opener) {
    if (this._isOpen) return;
    this._isOpen = true;
    this._opener = opener || document.activeElement;
    this._closing = false;
    this._dlg.removeAttribute("data-closing");
    this._dlg.showModal();
    lockScroll();
    if (!this.hasAttribute("open")) this.setAttribute("open", "");
    const auto = this._dlg.querySelector("[autofocus]") || this._dlg.querySelector(FOCUSABLE);
    if (auto) auto.focus();
    else { this._dlg.tabIndex = -1; this._dlg.focus(); }
    emit(this, "wc-open", { opener: this._opener });
  }

  close(reason = "api") {
    if (!this._isOpen || this._closing) return false;
    if (!emit(this, "wc-beforeclose", { reason }, true)) return false;
    this._closing = true;
    const dlg = this._dlg;
    const dur = reduceMotion() ? 0 : duration(this, 200);
    dlg.setAttribute("data-closing", "");
    const finish = () => { if (this._closing) this._finishClose(reason); };
    if (dur > 0) setTimeout(finish, dur); else finish();
    return true;
  }

  _finishClose(reason) {
    this._closing = false;
    this._isOpen = false;
    const dlg = this._dlg;
    dlg.removeAttribute("data-closing");
    if (dlg.open) dlg.close();
    unlockScroll();
    if (this.hasAttribute("open")) this.removeAttribute("open");
    const back = this._opener;
    this._opener = null;
    if (back && back.isConnected && typeof back.focus === "function") back.focus();
    emit(this, "wc-close", { reason });
  }

  toggle() { this._isOpen ? this.close("toggle") : this.show(); }
}

// Tombol pembuka di mana saja: <button data-wc-open="id-dialog">
function onDocClick(e) {
  const btn = e.target.closest && e.target.closest("[data-wc-open]");
  if (!btn) return;
  const dlg = document.getElementById(btn.getAttribute("data-wc-open"));
  if (dlg && dlg instanceof WcDialog) { e.preventDefault(); dlg.show(btn); }
}

/* ---------- pendaftaran ---------- */
export function define() {
  const reg = [["wc-tabs", WcTabs], ["wc-accordion", WcAccordion], ["wc-dialog", WcDialog]];
  reg.forEach(([name, cls]) => { if (!customElements.get(name)) customElements.define(name, cls); });
  // <wc-tab> dan <wc-panel> hanya penanda; didaftarkan agar :defined berlaku.
  ["wc-tab", "wc-panel"].forEach((n) => { if (!customElements.get(n)) customElements.define(n, class extends HTMLElement {}); });
  if (!document.documentElement.hasAttribute("data-wc-kit")) {
    document.addEventListener("click", onDocClick);
    document.documentElement.setAttribute("data-wc-kit", "");
  }
  document.querySelectorAll("[data-wc-open]").forEach((b) => b.setAttribute("aria-haspopup", "dialog"));
}

export const version = "1.0.0";

define();
