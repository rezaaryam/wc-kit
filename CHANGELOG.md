# Catatan perubahan

## 1.0.0 (25 Oktober 2026)

- Rilis pertama.
- `<wc-tabs>`: peran tablist, tab, dan tabpanel; navigasi panah, Home, End; tab nonaktif dilewati; aktivasi otomatis atau manual; orientasi vertikal; indikator beranimasi; tab baru disinkronkan otomatis; event `wc-change`.
- `<wc-accordion>`: dibangun di atas `<details>`; animasi tinggi; mode satu terbuka; navigasi panah; event `wc-toggle`.
- `<wc-dialog>`: dibangun di atas `<dialog>`; fokus kembali ke pembuka; klik latar untuk menutup; mode `persistent`; kunci scroll; animasi keluar; lembar dari bawah di layar kecil; event `wc-open`, `wc-beforeclose` (bisa dibatalkan), dan `wc-close`.
- Tema lewat variabel CSS, menghormati `prefers-reduced-motion`.
- 21 tes di browser sungguhan, dijalankan di Chromium, Firefox, dan WebKit lewat GitHub Actions, ditambah 2 tes konsistensi versi dan salinan docs.
