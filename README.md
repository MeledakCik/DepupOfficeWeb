# Depup Office Web

DepUp Office Web memakai palet ungu, Lime Pop, dan Midnight serta tipografi Inter Tight dari panduan brand DepUp. Halaman pengenalan tersedia di `/` dan ruang kerja di `/office/`. Navigasi ruang kerja berada di sisi kiri pada desktop dan di bilah bawah pada ponsel. Pengguna dapat mengatur tema, transparansi navigasi dan animasi melalui **Saya → Tampilan**.

## Menjalankan

Gunakan Node.js 24 LTS.

    npm ci
    npm run dev

Buka [localhost:3000](http://localhost:3000). Untuk memeriksa hasil produksi di port yang sama, hentikan server pengembangan terlebih dahulu.

    npm run build
    npm start

Build statis berada di folder `out`. Gunakan hosting HTTPS di root domain agar kamera, enkripsi browser, dan mode offline dapat berfungsi. Next.js menyajikan aplikasi tanpa server pemrosesan dokumen. [Panduan static export Next.js](https://nextjs.org/docs/app/guides/static-exports)

## Fitur

| Area | Alur yang tersedia |
| --- | --- |
| Ruang kerja | Impor berkas atau folder, drag and drop, filter tipe, dokumen terkini, penanda, sematan, riwayat dan cuplikan pencarian, olah berkas dari menu Dokumen, hasil olahan terakhir, ubah nama, hapus, unduh, dan berbagi. |
| Scan | Kamera atau foto, ambil ulang atau ganti foto halaman, lampu pada kamera yang mendukung, beberapa halaman, deteksi tepi, koreksi perspektif manual, filter, rotasi, cermin, pemisah halaman buku, sensur pada hasil ekspor dan OCR, watermark, JPG, PDF, Word sebagai teks atau foto, dan KTP dua sisi. OCR mendukung bahasa Indonesia dan Inggris. |
| Pembaca | PDF dengan zoom, navigasi, pencarian, tampilan baca, teks per halaman dan kata sandi. Pembaca gambar. Presentasi PPTX mempertahankan urutan dan rasio slide serta mendukung lompat slide, putar otomatis, timer, dan layar penuh. |
| Word | Impor DOCX dan teks, penyuntingan berformat, tabel, gambar, cari dan ganti, draf lokal, template, ekspor DOCX, PDF, dan cetak. |
| Excel | Impor XLSX, XLS, CSV, dan TSV. Beberapa lembar, format sel, rumus, pencarian, blok tempel, template, dan ekspor XLSX, CSV, atau PDF berbentuk tabel. |
| PDF | Gabung, pisah, urutkan, putar, hapus halaman, penomoran dengan opsi lewati sampul, kompresi target 200 KB, 500 KB, atau 1 MB, watermark, ekstrak gambar, JPG, Word, dan PDF bisa dicari. |
| Konversi dan produktivitas | Office ke PDF, PDF dan foto gabungan, QR, barcode label harga, pasfoto, grafik, kartu nama ke VCF, foto tabel atau struk ke Excel, nota, katalog, agenda, ringkasan, dan baca suara. |
| Tanda tangan dan privasi | Pustaka tanda tangan/stempel, tanda tangan transparan, geser tanda tangan langsung di pratinjau PDF, pengaturan ukuran/warna/putaran, pena/stabilo/catatan, sandi dan izin PDF, Brankas AES-256-GCM dengan derivasi PBKDF2. |

## Penyimpanan dan kinerja

Berkas dan indeks pencarian tersimpan dalam IndexedDB pada browser dan origin yang sama. Simpan salinan dengan tombol unduh untuk memindahkannya antar-perangkat. Berkas asli yang diimpor tetap tersedia saat menghasilkan salinan suntingan. Brankas memakai basis data lokal terpisah. Nama dan isi berkas Brankas dienkripsi bersama.

Editor, pembaca PDF, pemroses gambar, dan OCR dimuat saat digunakan. Mesin OCR dan model bahasa berasal dari aset build lokal. Pada build produksi, service worker di ruang kerja menyimpan kedua halaman dan aset alat yang sudah dimuat. Buka alat saat terhubung untuk mengunduh aset yang diperlukan sebelum memakainya offline.

## Perbedaan dari Android

- Kamera, jenis suara, menu berbagi, dan cetak mengikuti dukungan browser serta pengaturan perangkat. Pengiriman berkas ke WhatsApp atau aplikasi lain tersedia melalui menu berbagi saat OS mendukungnya. Unduhan menjadi jalur alternatif.
- **Dokumen Terlindungi Depup** dibuka di Depup Office pada Android. Aplikasi Android menangani pembatasan tangkapan layar dan penyuntingan. Web mengenali formatnya dan menyediakan unduhan berkas asli. PDF berkata sandi standar tetap bisa dibuka di web dengan kata sandinya.
- Brankas web memakai kata sandi. Biometrik, proteksi tangkapan layar, anti-tamper APK, dan folder Android merupakan fitur aplikasi native. Alat Lindungi PDF di web menghasilkan PDF bersandi standar.
- DOC dan PPT biner lama dapat disimpan dan diunduh. Buka dengan aplikasi yang mendukung format tersebut. Ekspor Office dan pembaca presentasi mendukung isi serta tata letak dasar. Grup bentuk, tema kompleks, grafik, makro, transisi, dan animasi memerlukan Office untuk tampilan penuh. PDF ke Word menyediakan pilihan teks yang dapat diedit atau halaman hasil render sebagai gambar. [Format presentasi Open XML](https://learn.microsoft.com/en-us/office/open-xml/presentation/working-with-presentations)
- EXE ke PDF mengambil PDF polos yang tertanam. Kapsul terenkripsi dan pembungkus khusus vendor memerlukan aplikasi asal.

## Verifikasi

    npm run lint
    npm run typecheck
    npm run build
    npm test

Uji browser memakai Chrome lokal. Server harus aktif sebelum menjalankan `npm test`. Setel `BASE_URL` untuk port lain dan `TEST_OFFLINE=1` untuk memeriksa build produksi tanpa jaringan.

Untuk memeriksa tampilan dan persistensi berkas pada WebKit dengan profil iPhone, jalankan `npx playwright install webkit` dan `npm run test:webkit`. Uji ini membuat PDF sendiri. Setel `BRAND_PDF` untuk mencoba PDF lokal lain.
