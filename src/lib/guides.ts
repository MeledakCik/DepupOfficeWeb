import { Archive, Combine, FileImage, FilePenLine, Files, ScanLine } from "lucide-react";
import type { LocalizedPaths, PublicLocale } from "./site";

type GuideCopy = {
  name: string;
  summary: string;
  action: string;
  steps: readonly string[];
  notes: readonly (readonly [question: string, answer: string])[];
};
export type Guide = {
  paths: LocalizedPaths;
  entry: string;
  icon: typeof Files;
  copy: Record<PublicLocale, GuideCopy>;
};

export const guides: readonly Guide[] = [
  {
    paths: { id: "/fitur/gabung-pdf/", en: "/en/tools/merge-pdf/" },
    entry: "/office/#alat/merge",
    icon: Combine,
    copy: {
      id: {
        name: "Gabung PDF online",
        summary: "Satukan lampiran, hasil scan, dan laporan PDF dalam urutan yang Anda pilih. Penggabungan berjalan di browser.",
        action: "Gabungkan PDF",
        steps: ["Pilih minimal dua berkas PDF dari perangkat.", "Susun urutan berkas dengan tombol naik dan turun.", "Tekan Proses berkas. Unduh PDF gabungan atau simpan ke ruang kerja."],
        notes: [
          ["Bagaimana urutan halamannya?", "DepUp Office mengambil semua halaman dari setiap berkas sesuai urutan daftar. Gunakan Pisah PDF atau Susun halaman jika hanya ingin memilih halaman tertentu."],
          ["Apakah bisa menggabungkan PDF bersandi?", "Untuk PDF standar, buat salinan yang sudah dibuka kuncinya dengan kata sandi yang benar sebelum menggabungkan."],
        ],
      },
      en: {
        name: "Merge PDF files online",
        summary: "Combine PDF attachments, scans and reports in the order you choose. The merge runs locally in your browser.",
        action: "Merge PDFs",
        steps: ["Select at least two PDF files with Pilih berkas dari perangkat.", "Use the up and down buttons to set the order.", "Select Proses berkas, then Unduh to download the combined PDF."],
        notes: [
          ["How are the pages ordered?", "DepUp Office takes every page from each file in the order shown in the list. Use Pisah PDF to split or Susun halaman to arrange individual pages."],
          ["Can I merge password-protected PDFs?", "Use the correct password to unlock a standard PDF and save an unlocked copy before merging."],
        ],
      },
    },
  },
  {
    paths: { id: "/fitur/kompres-pdf/", en: "/en/tools/compress-pdf/" },
    entry: "/office/#alat/compress",
    icon: Archive,
    copy: {
      id: {
        name: "Kompres PDF online",
        summary: "Perkecil PDF untuk lampiran atau batas ukuran unggahan. Gunakan target cepat 200 KB, 500 KB, 1 MB, atau masukkan ukuran sendiri.",
        action: "Kompres PDF",
        steps: ["Pilih PDF yang ingin diperkecil.", "Tentukan target ukuran. Izinkan konversi halaman ke gambar jika ukuran lebih penting dari teks yang bisa disalin.", "Tekan Proses berkas. Periksa ukuran dan keterbacaan hasil sebelum mengunduh."],
        notes: [
          ["Apakah target ukuran selalu tercapai?", "Hasil bergantung pada isi dan kompresi PDF asli. Jika target belum tercapai, alat menampilkan hasil terkecil yang tersedia."],
          ["Apa yang terjadi jika halaman diubah menjadi gambar?", "Tampilan halaman tetap tersedia. Teks halaman yang diraster tidak lagi berupa teks yang bisa langsung dipilih."],
        ],
      },
      en: {
        name: "Compress a PDF online",
        summary: "Reduce PDF file size for email attachments or upload limits. Choose a 200 KB, 500 KB or 1 MB preset, or set a custom target.",
        action: "Compress a PDF",
        steps: ["Select the PDF to compress.", "Choose a size target. Allow pages to become images if size matters more than selectable text.", "Select Proses berkas. Check the size and readability of the result before downloading."],
        notes: [
          ["Will the file reach the target size?", "Results depend on the original PDF and how it was compressed. The tool will tell you if it could not reach the target and offer the smallest result it produced."],
          ["What happens when pages become images?", "The page remains visible. Text on rasterized pages is embedded in the image and cannot be directly selected."],
        ],
      },
    },
  },
  {
    paths: { id: "/fitur/pdf-ke-word/", en: "/en/tools/pdf-to-word/" },
    entry: "/office/#alat/pdf-word",
    icon: FilePenLine,
    copy: {
      id: {
        name: "Konversi PDF ke Word (DOCX)",
        summary: "Ekspor teks dari PDF ke dokumen Word yang bisa diedit, atau pertahankan tampilan halaman dengan memasukkannya sebagai gambar.",
        action: "Ubah PDF ke Word",
        steps: ["Pilih berkas PDF.", "Pilih Teks yang dapat diedit atau Tampilan asli sebagai gambar pada Metode ekspor.", "Tekan Proses berkas dan unduh dokumen DOCX. Periksa susunan tabel dan paragraf sebelum membagikan."],
        notes: [
          ["Kapan sebaiknya memilih mode gambar?", "Pilih mode gambar untuk mempertahankan tampilan halaman, seperti formulir dan tata letak banyak kolom. Isi halaman gambar tidak dapat diedit sebagai teks Word."],
          ["Bagaimana jika PDF hanya berisi hasil scan?", "Tambahkan lapisan teks dengan alat PDF bisa dicari sebelum memilih ekspor teks. Periksa hasil OCR, terutama nama, angka, dan tabel."],
        ],
      },
      en: {
        name: "Convert PDF to Word (DOCX)",
        summary: "Extract PDF text into an editable Word document, or preserve the look of each page by exporting it as an image in DOCX.",
        action: "Convert PDF to Word",
        steps: ["Select a PDF file.", "Under Metode ekspor, choose Teks yang dapat diedit for editable text or Tampilan asli sebagai gambar for page images.", "Select Proses berkas and download the DOCX. Review paragraphs and tables before sharing."],
        notes: [
          ["When should I use page images?", "Use page images for forms or multi-column layouts where appearance matters. The images are embedded in the Word file and cannot be edited as text."],
          ["What if the PDF is a scan?", "Use PDF bisa dicari to add a searchable text layer before exporting editable text. Review the OCR output for names, numbers and tables."],
        ],
      },
    },
  },
  {
    paths: { id: "/fitur/gambar-ke-pdf/", en: "/en/tools/image-to-pdf/" },
    entry: "/office/#alat/image-pdf",
    icon: FileImage,
    copy: {
      id: {
        name: "Ubah JPG dan PNG ke PDF",
        summary: "Gabungkan foto, tangkapan layar, atau gambar dokumen ke satu PDF. Susun gambar sebelum membuat berkas.",
        action: "Buat PDF dari gambar",
        steps: ["Pilih satu atau beberapa gambar seperti JPG dan PNG.", "Letakkan setiap gambar pada posisi yang diinginkan menggunakan tombol naik dan turun.", "Tekan Proses berkas untuk membuat PDF, lalu simpan atau unduh hasilnya."],
        notes: [
          ["Apakah beberapa foto bisa digabung?", "Ya. Setiap gambar menjadi satu halaman PDF sesuai urutan daftar."],
          ["Bagaimana jika foto kertas miring?", "Gunakan pemindai dokumen untuk memperbaiki sudut, mengubah kontras, atau menutupi informasi tertentu sebelum menyimpan."],
        ],
      },
      en: {
        name: "Convert JPG and PNG to PDF",
        summary: "Turn photos, screenshots and document images into one PDF. Reorder the images before creating the file.",
        action: "Create a PDF from images",
        steps: ["Select one or more JPG or PNG images.", "Use the up and down controls to put the images in order.", "Select Proses berkas to create the PDF. Download or save the result."],
        notes: [
          ["Can I put multiple photos in one PDF?", "Yes. Each image becomes a page in the same order as the file list."],
          ["What if the document photo is skewed?", "Use the document scanner to correct perspective, adjust contrast or redact information before saving."],
        ],
      },
    },
  },
  {
    paths: { id: "/fitur/scan-dokumen/", en: "/en/tools/scan-to-pdf/" },
    entry: "/office/#scan",
    icon: ScanLine,
    copy: {
      id: {
        name: "Scan dokumen ke PDF",
        summary: "Pindai kertas dengan kamera atau foto yang sudah ada. Rapikan sudut, sensor informasi sensitif, dan ekspor sebagai PDF.",
        action: "Buka pemindai",
        steps: ["Tekan Aktifkan kamera atau pilih foto yang sudah ada.", "Periksa sudut potong, urutan halaman, dan bagian yang perlu disensor.", "Pilih PDF. Aktifkan opsi OCR jika ingin hasil scan dapat dicari, lalu tekan Buat PDF."],
        notes: [
          ["Mengapa browser meminta izin kamera?", "Izin diperlukan untuk memperoleh gambar dari kamera. Gunakan situs HTTPS atau localhost. Pilih foto jika perangkat tidak memiliki kamera atau izin ditolak."],
          ["Bahasa apa yang bisa dikenali OCR?", "DepUp Office menyediakan pengenalan teks bahasa Indonesia dan Inggris. Ketepatan dipengaruhi oleh ketajaman foto serta kualitas cetakan."],
        ],
      },
      en: {
        name: "Scan documents to PDF",
        summary: "Scan paper with your camera or use existing photos. Correct the crop, redact sensitive details and export the result as a PDF.",
        action: "Open the scanner",
        steps: ["Select Aktifkan kamera to use your camera, or Pilih foto to use an existing photo.", "Review the crop, page order and any areas you need to redact.", "Choose PDF as the export format. Turn on OCR for searchable text, then select Buat PDF."],
        notes: [
          ["Why does the browser ask for camera access?", "The scanner needs permission to capture images. Use the app over HTTPS or localhost. Choose an existing photo if your camera is unavailable."],
          ["Which languages can OCR recognize?", "The scanner provides Indonesian and English text recognition. Accurate results depend on clear photos and legible source text."],
        ],
      },
    },
  },
  {
    paths: { id: "/fitur/editor-word-excel/", en: "/en/tools/word-excel-editor/" },
    entry: "/office/#beranda",
    icon: Files,
    copy: {
      id: {
        name: "Editor Word dan Excel di browser",
        summary: "Edit dokumen DOCX dan spreadsheet XLSX, buat berkas baru dari template, lalu simpan hasilnya di perangkat.",
        action: "Buka editor dokumen",
        steps: ["Dari Beranda, pilih Word atau Excel untuk membuka berkas. Untuk berkas baru, pilih Dokumen Word atau Spreadsheet pada bagian Buat baru.", "Edit teks dan tabel pada Word, atau isi sel dan rumus pada spreadsheet.", "Simpan atau unduh hasilnya. Buka kembali salinan untuk memeriksa tata letak dan rumus yang penting."],
        notes: [
          ["Format impor apa yang didukung?", "Gunakan DOCX untuk dokumen berformat, atau XLSX, XLS, dan CSV untuk spreadsheet. Berkas DOC lama dapat disimpan dan diunduh dari ruang kerja."],
          ["Apakah semua format dan rumus Office didukung?", "Editor mendukung pemformatan dan rumus yang umum. Periksa tata letak kompleks, rumus tingkat lanjut, serta hasil ekspor sebelum dipakai."],
        ],
      },
      en: {
        name: "Edit Word and Excel files in your browser",
        summary: "Edit DOCX documents and XLSX spreadsheets, start from a template, and save your work on your device.",
        action: "Open the document editor",
        steps: ["On Beranda, choose Word or Excel to open a file. Under Buat baru, select Dokumen Word or Spreadsheet to start a new one.", "Edit text and tables in a document, or edit cells and formulas in a spreadsheet.", "Save or download the result. Reopen the copy to check important formatting and formulas."],
        notes: [
          ["Which file formats can I import?", "Use DOCX for formatted documents and XLSX, XLS or CSV for spreadsheets. Older DOC files can be stored and downloaded from the workspace."],
          ["Does the editor support all Office formatting and formulas?", "The editor supports common formatting options and formulas. Check complex layouts, advanced formulas and exported results before using them."],
        ],
      },
    },
  },
];

export function guideSlugs(locale: PublicLocale) {
  return guides.map((guide) => ({ slug: guide.paths[locale].split("/").at(-2)! }));
}

export function findGuide(locale: PublicLocale, slug: string) {
  return guides.find((guide) => guide.paths[locale].split("/").at(-2) === slug);
}
