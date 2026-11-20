import { sheetFromRows } from "./office";

const table = (headers: string[], count: number) => "<table><tr>" + headers.map((item) => "<th>" + item + "</th>").join("") + "</tr>" +
  Array.from({ length: count }, (_, index) => "<tr>" + headers.map((_, column) => "<td>" + (column ? "&nbsp;" : index + 1) + "</td>").join("") + "</tr>").join("") + "</table>";
const p = (text: string) => "<p>" + text + "</p>";
const h = (text: string) => "<h2>" + text + "</h2>";
const middle = (text: string) => '<h2 style="text-align:center">' + text + "</h2>";

const word: Record<string, [string, string]> = {
  lamaran: ["Surat Lamaran", middle("Surat Lamaran Pekerjaan") + p("[Kota], [Tanggal]") + p("Kepada Yth. Tim Rekrutmen<br>[Nama Perusahaan]") +
    p("Dengan hormat,") + p("Saya, [Nama Lengkap], bermaksud melamar untuk posisi [Posisi]. Pengalaman saya dalam [Bidang] mencakup [Keahlian dan pencapaian].") +
    p("Bersama surat ini saya lampirkan CV dan dokumen pendukung. Terima kasih atas waktu dan pertimbangannya.") + p("Hormat saya,<br><br>[Nama Lengkap]")],
  cv: ["CV / Resume", "<h1>[Nama Lengkap]</h1>" + p("[Email] · [Telepon] · [Kota]") + h("Profil") + p("[Ringkasan keahlian dan minat profesional]") +
    h("Pengalaman") + p("<strong>[Posisi] · [Instansi]</strong><br>[Periode]<br>[Tanggung jawab dan pencapaian]") + h("Pendidikan") + p("[Institusi] · [Program] · [Tahun]") + h("Keahlian") + p("[Keahlian utama]")],
  izin: ["Surat Izin", middle("Surat Izin") + p("[Kota], [Tanggal]") + p("Kepada Yth. [Wali kelas / Atasan]<br>[Sekolah / Instansi]") + p("Dengan hormat,") +
    p("Nama: [Nama Lengkap]<br>Kelas / Jabatan: [Kelas atau jabatan]") + p("Saya memohon izin untuk tidak hadir pada [Tanggal] karena [Alasan].") + p("Atas pengertiannya saya ucapkan terima kasih.") + p("Hormat saya,<br><br>[Nama Lengkap]")],
  rtrw: ["Keterangan RT-RW", middle("RT [Nomor] / RW [Nomor]") + p("[Kelurahan] · [Kecamatan] · [Kota]") + middle("Surat Keterangan Domisili") + p("Nomor: [Nomor Surat]") +
    p("Yang bertanda tangan di bawah ini menerangkan bahwa:") + p("Nama: [Nama]<br>NIK: [NIK]<br>Alamat: [Alamat]") +
    p("Yang bersangkutan benar berdomisili di alamat tersebut. Surat ini dibuat untuk [Keperluan].") + p("[Kota], [Tanggal]<br>Ketua RT / RW<br><br>[Nama]")],
  undangan: ["Undangan Rapat", middle("Undangan Rapat") + p("Perihal: Undangan Rapat [Nama Organisasi]") + p("Kepada Yth. [Peserta Rapat]") +
    p("Kami mengundang Bapak/Ibu untuk menghadiri rapat yang akan dilaksanakan pada:") + p("Hari / Tanggal: [Tanggal]<br>Waktu: [Waktu]<br>Tempat: [Tempat]<br>Agenda: [Agenda]") + p("Hormat kami,<br><br>[Ketua / Sekretaris]")],
  notulen: ["Notulen Rapat", middle("Notulen Rapat") + p("[Nama Organisasi]") + p("Tanggal: [Tanggal]<br>Tempat: [Tempat]<br>Pimpinan: [Nama]<br>Notulis: [Nama]") +
    h("Agenda") + p("[Agenda]") + h("Pembahasan dan keputusan") + p("[Ringkasan keputusan]") + h("Tindak lanjut") + table(["No.", "Kegiatan", "Penanggung jawab", "Batas waktu"], 4)],
  hadir: ["Daftar Hadir", middle("Daftar Hadir") + p("Kegiatan: [Nama Kegiatan]<br>Tanggal: [Tanggal]<br>Tempat: [Tempat]") + table(["No.", "Nama", "Jabatan", "Kontak", "Tanda tangan"], 12)],
  proposal: ["Proposal Kegiatan", middle("Proposal Kegiatan") + p("[Nama Organisasi] · [Nama Kegiatan]") + h("Latar belakang") + p("[Konteks kegiatan]") +
    h("Tujuan dan sasaran") + p("[Tujuan]") + h("Pelaksanaan") + p("[Waktu, lokasi, dan susunan acara]") + h("Anggaran") + table(["No.", "Kebutuhan", "Volume", "Harga", "Jumlah"], 5) + h("Penutup") + p("[Penutup dan tanda tangan panitia]")],
};
export const wordTemplate = (id?: string) => word[id ?? ""] ?? ["Dokumen baru", "<p><br></p>"];

export function sheetTemplate(id?: string) {
  if (id === "invoice") return {
    name: "Kuitansi", sheets: [sheetFromRows([["Produk", "Jumlah", "Harga", "Total"], ["", "", "", "=B2*C2"], ["", "", "", "=B3*C3"], ["TOTAL", "", "", "=SUM(D2:D3)"]], "Kuitansi")],
  };
  if (id === "presensi") return {
    name: "Daftar Presensi", sheets: [sheetFromRows([["No.", "Nama", "Tanggal", "Status", "Keterangan"], [1], [2], [3], [4]], "Presensi")],
  };
  return { name: "Spreadsheet baru", sheets: [sheetFromRows([])] };
}
