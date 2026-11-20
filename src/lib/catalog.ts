import {
  Archive, AudioLines, Barcode, BookOpen, CalendarDays, Camera, ChartNoAxesCombined, Combine, Contact,
  Download, File, FileImage, FilePenLine, FileSpreadsheet, FileText, Files, Folder, House, Image,
  Images, LayoutGrid, ListChecks, LockKeyhole, Maximize, NotebookPen, PanelsTopLeft, Printer,
  QrCode, ScanLine, Scissors, Search, Share2, ShieldCheck, Signature, Sparkles, Stamp, Tags, UserRound,
  WandSparkles,
} from "lucide-react";

export const navigation = [
  { id: "beranda", label: "Beranda", icon: House },
  { id: "dokumen", label: "Dokumen", icon: Folder },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "alat", label: "Alat", icon: LayoutGrid },
  { id: "saya", label: "Saya", icon: UserRound },
] as const;

export type Section = typeof navigation[number]["id"];
export type Kind = "pdf" | "word" | "excel" | "image" | "slides" | "other";

export const kinds = {
  pdf: { label: "PDF", icon: FileText, accept: ".pdf" },
  word: { label: "Word", icon: FilePenLine, accept: ".docx,.docm,.dotx,.doc,.txt,.md" },
  excel: { label: "Excel", icon: FileSpreadsheet, accept: ".xlsx,.xlsm,.xltx,.xls,.csv,.tsv" },
  image: { label: "Gambar", icon: Image, accept: "image/*" },
  slides: { label: "Presentasi", icon: PanelsTopLeft, accept: ".pptx,.ppsx,.potx" },
  other: { label: "Lainnya", icon: Folder, accept: "" },
} satisfies Record<Kind, { label: string; icon: typeof File; accept: string }>;

export function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function baseName(name: string) {
  return extension(name) ? name.slice(0, name.lastIndexOf(".")) : name;
}

export function getKind(name: string, mime = ""): Kind {
  const ext = extension(name);
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["docx", "docm", "dotx", "doc", "txt", "md"].includes(ext) || mime.includes("wordprocessingml")) return "word";
  if (["xlsx", "xlsm", "xltx", "xls", "csv", "tsv"].includes(ext) || mime.includes("spreadsheetml")) return "excel";
  if (["pptx", "ppsx", "potx"].includes(ext) || mime.includes("presentationml")) return "slides";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"].includes(ext)) return "image";
  return "other";
}

const pdf = kinds.pdf.accept;
const images = kinds.image.accept;
const office = ".docx,.docm,.dotx,.xlsx,.xlsm,.xltx,.xls,.csv,.tsv,.pptx,.ppsx,.potx,.txt";

export const toolGroups = [
  {
    title: "Kelola PDF", tone: "pdf", items: [
      ["merge", "Gabung PDF", "Satukan beberapa PDF dalam urutan pilihan.", Combine, pdf, true],
      ["split", "Pisah PDF", "Simpan hanya halaman yang Anda pilih.", Scissors, pdf],
      ["organize", "Susun halaman", "Urutkan, putar, atau hapus halaman.", LayoutGrid, pdf],
      ["number", "Nomor halaman", "Tambahkan nomor dan judul di setiap halaman.", ListChecks, pdf],
      ["blank", "Hapus halaman kosong", "Temukan dan buang halaman putih polos.", FileText, pdf],
      ["compress", "Kompres PDF", "Perkecil ukuran PDF sesuai batas unggahan.", Archive, pdf],
      ["pdf-jpg", "PDF ke JPG", "Ubah setiap halaman menjadi gambar.", FileImage, pdf],
      ["extract-images", "Ambil gambar", "Simpan gambar yang tertanam di PDF.", Images, pdf],
      ["annotate", "Anotasi PDF", "Tambahkan catatan, stabilo, atau coretan.", NotebookPen, pdf],
      ["watermark", "Watermark PDF", "Tambahkan teks diagonal ke setiap halaman.", Stamp, pdf],
    ],
  },
  {
    title: "Konversi", tone: "word", items: [
      ["pdf-word", "PDF ke Word", "Ekspor teks atau tampilan halaman ke DOCX.", FilePenLine, pdf],
      ["searchable", "PDF bisa dicari", "Tambahkan lapisan teks OCR ke halaman scan.", Search, pdf],
      ["office-pdf", "Office ke PDF", "Ekspor Word, spreadsheet, atau presentasi.", FileText, office],
      ["image-pdf", "Gambar ke PDF", "Gabungkan beberapa foto menjadi satu PDF.", Images, images, true],
      ["merge-any", "Gabung berbagai format", "Satukan PDF, berkas Office, dan gambar.", Combine, "" , true],
      ["exe-pdf", "EXE ke PDF", "Ambil PDF polos yang tertanam pada berkas EXE.", FileText, ".exe"],
    ],
  },
  {
    title: "Gambar & foto", tone: "image", items: [
      ["batch-watermark", "Watermark foto massal", "Tambahkan teks pada banyak foto sekaligus.", Stamp, images, true],
      ["deshadow", "Pembersih bayangan", "Putihkan latar dan tingkatkan kontras dokumen.", WandSparkles, images],
      ["business-card", "Pindai kartu nama", "Ekstrak kontak dan ekspor ke VCF.", Contact, images],
      ["id-photo", "Pembuat pasfoto", "Susun pasfoto ukuran 2×3, 3×4, atau 4×6 di A4.", UserRound, images],
      ["table-excel", "Pindai tabel ke Excel", "Ubah baris teks pada foto menjadi spreadsheet.", FileSpreadsheet, images],
      ["chart", "Grafik Excel", "Ubah dua kolom data menjadi grafik.", ChartNoAxesCombined, kinds.excel.accept],
      ["batch-pdf", "Konversi foto massal", "Buat satu PDF untuk setiap foto.", Files, images, true],
      ["image-compress", "Kompres foto", "Perkecil gambar sebelum dikirim.", Maximize, images, true],
      ["transparent", "TTD transparan", "Hilangkan latar putih dari gambar tanda tangan.", Signature, images],
      ["ocr", "Ambil teks dari foto", "Kenali teks berbahasa Indonesia dan Inggris.", ScanLine, images],
    ],
  },
  {
    title: "Tanda tangan & keamanan", tone: "excel", items: [
      ["signatures", "Pustaka tanda tangan", "Simpan gambar tanda tangan dan stempel.", Signature],
      ["sign", "Tanda tangan PDF", "Gambar atau pilih tanda tangan dan tempel ke PDF.", Signature, pdf],
      ["protect", "Lindungi PDF", "Atur kata sandi pembuka dan izin PDF standar.", ShieldCheck, pdf],
      ["unlock", "Buka kunci PDF", "Simpan PDF tanpa sandi dengan izin dan kata sandi yang benar.", LockKeyhole, pdf],
      ["vault", "Brankas berkas", "Enkripsi berkas dengan kata sandi.", LockKeyhole],
      ["barcode", "Label harga & barcode", "Buat label harga Code 128 yang siap dicetak.", Barcode],
      ["qr", "QR & barcode", "Buat kode QR atau pindai kode dari foto.", QrCode],
      ["receipt", "Pindai struk", "Ekspor baris dan nominal struk ke Excel.", Camera, images],
    ],
  },
  {
    title: "Produktivitas & ekspor", tone: "word", items: [
      ["note", "Catatan jadi PDF", "Tulis teks bebas dan simpan sebagai PDF.", NotebookPen],
      ["invoice", "Nota & kuitansi", "Buat nota dengan perhitungan total.", Tags],
      ["catalog", "Katalog & portofolio", "Susun informasi dan foto produk.", BookOpen, images, true],
      ["planner", "Jadwal & perencana", "Ekspor agenda ke Excel atau PDF.", CalendarDays],
      ["summary", "Ringkas dokumen", "Ambil poin utama dari PDF atau Word.", Sparkles, ".pdf,.docx,.txt"],
      ["voice", "Baca dengan suara", "Dengarkan isi berkas dengan suara perangkat.", AudioLines, ".pdf,.docx,.xlsx,.csv,.txt"],
      ["share", "Bagikan berkas", "Pilih tujuan dari menu berbagi perangkat.", Share2, ""],
      ["export", "Simpan ke perangkat", "Unduh salinan dari berkas Anda.", Download, ""],
      ["print", "Cetak dokumen", "Cetak melalui dialog browser.", Printer, ".pdf"],
    ],
  },
] as const;

export type Tool = {
  id: string; label: string; description: string; icon: typeof File;
  tone: string; accept?: string; multiple: boolean;
};
export const tools = toolGroups.flatMap(({ tone, items }): Tool[] =>
  items.map(([id, label, description, icon, accept, multiple]) => ({
    id, label, description, icon, tone, accept, multiple: multiple ?? false,
  })),
);

export const templates = [
  ["lamaran", "Surat Lamaran", "Format resmi untuk melamar kerja", "word"],
  ["cv", "CV / Resume", "Riwayat hidup dan pengalaman", "word"],
  ["izin", "Surat Izin", "Izin sekolah atau pekerjaan", "word"],
  ["rtrw", "Keterangan RT/RW", "Surat keterangan domisili", "word"],
  ["undangan", "Undangan Rapat", "Informasi rapat dan agenda", "word"],
  ["notulen", "Notulen Rapat", "Keputusan dan tindak lanjut", "word"],
  ["hadir", "Daftar Hadir", "Tabel peserta dan tanda tangan", "word"],
  ["proposal", "Proposal Kegiatan", "Rencana kegiatan dan anggaran", "word"],
  ["invoice", "Kuitansi / Invoice", "Tabel penjualan dengan rumus total", "excel"],
  ["presensi", "Presensi", "Daftar kehadiran dalam Excel", "excel"],
] as const;
