import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import Excel from "exceljs";
import Zip from "jszip";
import * as XLS from "@e965/xlsx";

const url = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL ?? "chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: "light", timezoneId: "Asia/Jakarta", permissions: ["camera"] });
const page = await context.newPage();
page.setDefaultTimeout(14_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const dialog = page.getByRole("dialog");
const nav = page.getByRole("navigation", { name: "Navigasi utama" });
const fileInput = page.getByLabel("Impor berkas", { exact: true });
const close = () => dialog.getByRole("button", { name: "Tutup", exact: true }).click();
const checked = (test) => console.log("✓ " + test);
const shown = (locator) => locator.waitFor({ state: "visible" });
const button = (target, name) => target.getByRole("button", { name, exact: typeof name === "string" });
const combobox = (target, name) => target.getByRole("combobox", { name, exact: true });
async function choose(target, label, option) {
  await combobox(target, label).click();
  await target.getByRole("option", { name: option, exact: true }).click();
}
const navigate = (name) => button(nav, name).click();
const openTool = async (title) => {
  await navigate("Alat");
  await page.getByLabel("Cari alat", { exact: true }).fill(title);
  await button(page, new RegExp("^" + title)).first().click();
  await shown(dialog.getByRole("heading", { name: title, exact: true }));
};
const upload = (file) => dialog.getByLabel("Pilih berkas dari perangkat").setInputFiles(file);
const processTool = () => button(dialog, "Proses berkas").click();
const capture = async (control) => {
  const [download] = await Promise.all([page.waitForEvent("download"), control.click()]);
  return readFile(await download.path());
};

async function samplePdf(content) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of content) {
    const page = doc.addPage([415, 560]);
    if (text) page.drawText(text, { x: 50, y: 470, font, size: 19 });
  }
  return Buffer.from(await doc.save());
}
const original = await samplePdf(["Depup Office pengujian", "", "Halaman ketiga"]);
const second = await samplePdf(["Dokumen kedua"]);
const pdfFile = { name: "Contoh.pdf", mimeType: "application/pdf", buffer: original };

try {
  await page.goto(url.href, { waitUntil: "networkidle" });
  await shown(page.getByRole("heading", { name: /Dokumen beres/ }));
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow landing pada " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const sculpture = page.locator("picture img");
  await page.waitForFunction(() => document.querySelector("picture img").currentSrc.includes("480.webp"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await sculpture.evaluate((img) => getComputedStyle(img.parentElement).animationName), "none");
  await page.getByRole("link", { name: "Jelajahi fitur" }).click();
  assert.equal(new URL(page.url()).hash, "#fitur");
  await page.getByRole("link", { name: /Scan dokumen ke PDF/ }).click();
  await page.getByRole("link", { name: "Buka pemindai", exact: true }).click();
  await shown(page.getByRole("heading", { name: "Scan dokumen" }));
  await page.goto(new URL("/#alat", url).href);
  await page.waitForURL("**/office/#alat");
  await shown(page.getByRole("heading", { name: "Alat", exact: true }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await navigate("Beranda");
  checked("Landing responsif, gambar mobile, reduced motion, tautan fitur, dan tautan lama");
  await shown(page.getByRole("heading", { name: /Selamat/ }));
  for (const width of [320, 390, 768, 959, 960, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow horizontal pada " + width);
    assert.equal(await nav.count(), 1);
    assert.equal(await nav.getByRole("button").count(), 5);
    assert.equal(await button(nav, "Beranda").getAttribute("aria-current"), "page");
    const first = await button(nav, "Beranda").boundingBox();
    const last = await button(nav, "Saya").boundingBox();
    const formats = await page.locator(".dashboard-formats").boundingBox();
    if (width >= 960) {
      const recent = await page.getByRole("region", { name: "Baru dibuka" }).boundingBox();
      const scanner = await page.getByRole("region", { name: "Scan dokumen" }).boundingBox();
      assert.ok(last.y >= first.y + first.height && first.x === last.x, "Sidebar desktop " + width);
      assert.ok(first.x + first.width <= recent.x && recent.x + recent.width <= formats.x + 1, "Panel desktop " + width);
      assert.ok(Math.abs(recent.y - scanner.y) < 2 && recent.x + recent.width <= scanner.x, "Dokumen dan pemindai berdampingan " + width);
      assert.equal(await nav.evaluate((node) => getComputedStyle(node).boxShadow), "none");
    } else {
      assert.ok(last.x > first.x && Math.abs(first.y - last.y) < 2 && first.y > 800, "Navigasi bawah " + width);
    }
  }
  await button(page, "Ganti tema").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await button(page, "Ganti tema").click();
  await page.keyboard.press("Control+k");
  assert.ok(await page.getByLabel("Cari dokumen", { exact: true }).evaluate((input) => document.activeElement === input));
  checked("Beranda responsif, tema, dan pintasan pencarian");

  await navigate("Saya");
  assert.equal(await button(nav, "Saya").getAttribute("aria-current"), "page", "Navigasi aktif sesuai halaman pengaturan");
  const settingsPanels = page.locator(".settings-grid > .settings");
  const desktopSettings = await Promise.all((await settingsPanels.all()).map((panel) => panel.boundingBox()));
  assert.equal(desktopSettings.length, 4, "Empat panel pengaturan");
  assert.ok(Math.abs(desktopSettings[0].y - desktopSettings[1].y) < 2, "Tampilan dan format sejajar pada desktop");
  assert.ok(Math.abs(desktopSettings[2].y - desktopSettings[3].y) < 2 && desktopSettings[2].y > desktopSettings[0].y, "Penyimpanan dan dukungan mengisi baris kedua");
  await page.getByLabel("Animasi antarmuka").uncheck();
  await page.getByLabel("Blur antarmuka").uncheck();
  await page.getByLabel("Efek kaca").uncheck();
  await page.reload({ waitUntil: "load" });
  await shown(page.getByRole("heading", { name: "Saya" }));
  assert.equal(await page.getByLabel("Animasi antarmuka").isChecked(), false);
  assert.equal(await page.locator(".topbar").evaluate((bar) => getComputedStyle(bar).backdropFilter), "none");
  assert.equal(await page.locator(".workspace-view").evaluate((view) => getComputedStyle(view).animationName), "none");
  assert.equal(await page.getByRole("slider", { name: /Kepekatan kaca/ }).isDisabled(), true);
  await button(page, "Pulihkan tampilan bawaan").click();
  const tone = page.getByRole("slider", { name: /Kepekatan kaca/ });
  await tone.press("End");
  assert.equal(await page.locator("html").evaluate((root) => root.style.getPropertyValue("--glass-opacity")), "98%");
  await button(page, "Pulihkan tampilan bawaan").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSettings = await Promise.all((await settingsPanels.all()).map((panel) => panel.boundingBox()));
  assert.ok(mobileSettings.every((panel, index) => index === 0 || panel.y > mobileSettings[index - 1].y), "Panel pengaturan bertumpuk rapi pada ponsel");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Pengaturan tanpa overflow pada ponsel");
  await page.setViewportSize({ width: 1920, height: 950 });
  await navigate("Alat");
  const categories = combobox(page, "Kategori alat");
  await categories.press("ArrowDown");
  await categories.press("ArrowDown");
  await categories.press("Enter");
  assert.match(await categories.innerText(), /Kelola PDF/);
  await shown(button(page, /^Gabung PDF/));
  assert.equal(await button(page, /^Nota & kuitansi/).count(), 0);
  await page.getByLabel("Cari alat", { exact: true }).fill("tanpa hasil");
  await shown(page.getByText("Tidak ada alat yang cocok."));
  await button(page, "Tampilkan semua alat").click();
  assert.match(await categories.innerText(), /Semua alat/);
  await shown(button(page, /^Nota & kuitansi/));
  await navigate("Beranda");
  checked("Preferensi tampilan tersimpan, filter kategori dan pencarian alat dapat direset");

  await button(page, /^Dokumen Word Menulis/).click();
  await dialog.getByLabel("Nama dokumen").fill("Uji surat");
  await dialog.getByRole("textbox", { name: "Isi dokumen" }).fill("Surat pengujian Depup Office.");
  await button(dialog, "Simpan DOCX").click();
  await shown(dialog.getByText("Salinan DOCX tersimpan."));
  const word = await capture(button(dialog, "Unduh DOCX"));
  const zippedWord = await Zip.loadAsync(word);
  assert.match(await zippedWord.file("word/document.xml").async("string"), /Surat pengujian Depup Office/);
  await close();
  await fileInput.setInputFiles({ name: "Surat-impor.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: word });
  await shown(dialog.getByRole("textbox", { name: "Isi dokumen" }).getByText("Surat pengujian Depup Office."));
  await close();
  checked("Buat, ekspor, simpan, dan buka ulang DOCX");

  await button(page, /^Spreadsheet Mengolah/).click();
  await dialog.getByLabel("Nama spreadsheet").fill("Hitung barang");
  for (const [key, value] of Object.entries({ A1: "7", A2: "11", A3: "=SUM(A1:A2)", A4: "=A3*2" })) {
    await dialog.getByLabel(key, { exact: true }).fill(value);
  }
  await button(dialog, "Simpan XLSX").click();
  await shown(dialog.getByText("Salinan XLSX tersimpan."));
  const sheet = await capture(button(dialog, "Unduh XLSX"));
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(sheet);
  assert.equal(workbook.worksheets[0].getCell("A3").result, 18);
  assert.equal(workbook.worksheets[0].getCell("A4").result, 36);
  await close();
  const legacy = XLS.utils.book_new();
  XLS.utils.book_append_sheet(legacy, XLS.utils.aoa_to_sheet([["Nama", "Nominal"], ["Depup", 2026]]), "Lembar lama");
  await fileInput.setInputFiles({ name: "Excel97.xls", mimeType: "application/vnd.ms-excel", buffer: XLS.write(legacy, { type: "buffer", bookType: "biff8" }) });
  await shown(dialog.getByRole("table", { name: "Lembar Lembar lama" }));
  assert.equal(await dialog.getByLabel("B2", { exact: true }).inputValue(), "2026");
  await close();
  checked("XLS lama, ekspor XLSX, dan rumus bertingkat");

  await openTool("Office ke PDF");
  await upload({ name: "Rumus.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: sheet });
  await processTool();
  const worksheetPdf = await capture(button(dialog, "Unduh"));
  await close();
  await fileInput.setInputFiles({ ...pdfFile, name: "Tabel Excel.pdf", buffer: worksheetPdf });
  await dialog.getByLabel("Cari teks PDF").fill("36");
  await button(dialog, "Cari").click();
  await shown(button(dialog, "Hal. 1"));
  await close();
  checked("Ekspor Excel sebagai tabel PDF dengan hasil rumus");

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("depup-preferences") ?? "{}");
    delete saved.pdfLayout;
    localStorage.setItem("depup-preferences", JSON.stringify({ ...saved, continuous: false }));
  });
  await page.reload({ waitUntil: "networkidle" });
  const landscape = await PDFDocument.create();
  for (let index = 1; index <= 12; index++) landscape.addPage([1280, 720]).drawText("Halaman uji " + index);
  await fileInput.setInputFiles({ ...pdfFile, name: "Uji gulir.pdf", buffer: Buffer.from(await landscape.save()) });
  await shown(dialog.locator("canvas[aria-label='Tampilan halaman 1']"));
  const readingArea = dialog.getByRole("region", { name: "Halaman dokumen PDF" });
  const pageNumber = dialog.getByLabel("Nomor halaman", { exact: true });
  const pdfLayout = combobox(dialog, "Tata letak PDF");
  assert.match(await pdfLayout.innerText(), /Gulir terus/);
  assert.equal(await button(dialog, "Daftar halaman").getAttribute("aria-expanded"), "false");
  assert.ok(await readingArea.evaluate((view) => view.scrollHeight > view.clientHeight));
  await readingArea.hover();
  await page.mouse.wheel(0, 510);
  await page.waitForFunction(() => document.querySelector('[aria-label="Nomor halaman"]')?.value === "2");
  assert.equal(await dialog.evaluate((window) => window.scrollTop), 0);
  await pageNumber.fill("10");
  await pageNumber.press("Enter");
  await shown(dialog.getByRole("img", { name: "Tampilan halaman 10", exact: true }));
  assert.equal(await pageNumber.inputValue(), "10");
  await pdfLayout.click();
  await pdfLayout.press("Escape");
  assert.equal(await pdfLayout.getAttribute("aria-expanded"), "false");
  assert.equal(await dialog.isVisible(), true);
  await choose(dialog, "Tata letak PDF", "Satu halaman");
  assert.equal(await readingArea.locator(".pdf-page").count(), 1);
  await button(dialog, "Halaman berikutnya").click();
  await shown(dialog.getByRole("img", { name: "Tampilan halaman 11", exact: true }));
  await choose(dialog, "Tata letak PDF", "Gulir terus");
  assert.equal(await pageNumber.inputValue(), "11");
  await button(dialog, "Daftar halaman").click();
  await button(dialog, "Buka halaman 12").click();
  await shown(dialog.getByRole("img", { name: "Tampilan halaman 12", exact: true }));
  assert.equal(await pageNumber.inputValue(), "12");
  await close();
  checked("Gulir PDF landscape, loncat 2 digit, daftar halaman, dan perpindahan tata letak");

  await fileInput.setInputFiles(pdfFile);
  await shown(dialog.locator("canvas[aria-label='Tampilan halaman 1']"));
  await page.setViewportSize({ width: 390, height: 844 });
  if (await button(dialog, "Tutup daftar halaman").isVisible()) await button(dialog, "Tutup daftar halaman").click();
  const firstSheet = readingArea.locator(".pdf-page").first();
  const beforeZoom = await firstSheet.evaluate((element) => element.clientWidth);
  await button(dialog, "Perbesar halaman").click();
  assert.ok(await firstSheet.evaluate((element) => element.clientWidth) > beforeZoom);
  assert.ok(await readingArea.evaluate((view) => view.scrollWidth > view.clientWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByLabel("Cari teks PDF").fill("ketiga");
  await button(dialog, "Cari").click();
  await shown(button(dialog, "Hal. 3"));
  assert.equal(await pageNumber.inputValue(), "3");
  await close();
  await navigate("Dokumen");
  const row = page.getByRole("row").filter({ hasText: "Contoh.pdf" });
  await shown(page.getByRole("columnheader", { name: "Terakhir dibuka" }));
  await button(row, "Tandai berkas").click();
  await choose(page, "Tampilan dokumen", "Ditandai");
  await shown(row);
  await row.getByLabel("Tindakan untuk Contoh.pdf").click();
  await button(row, "Sematkan").click();
  await shown(row.getByText(/Disematkan/));
  await page.reload({ waitUntil: "networkidle" });
  await shown(row);
  await page.getByLabel("Cari dokumen", { exact: true }).fill("pengujian");
  await button(page, "Cari dalam isi").click();
  await shown(row);
  await shown(row.locator(".search-snippet").filter({ hasText: /pengujian/i }));
  await button(page, "Bersihkan pencarian").click();
  await shown(page.getByRole("heading", { name: "Pencarian terakhir" }));
  await button(page, "pengujian").click();
  await shown(row.locator(".search-snippet"));
  await button(page, "Bersihkan pencarian").click();
  await button(page, "Hapus riwayat pencarian").click();
  assert.equal(await page.getByRole("heading", { name: "Pencarian terakhir" }).count(), 0);
  await row.getByLabel("Tindakan untuk Contoh.pdf").click();
  await button(row, "Olah berkas").click();
  await shown(button(dialog, "Pisah PDF"));
  await close();
  checked("Pembaca PDF, penanda, cuplikan dan riwayat pencarian, serta olah berkas dari daftar");

  for (const [tool, files, count] of [
    ["Gabung PDF", [pdfFile, { name: "Kedua.pdf", mimeType: "application/pdf", buffer: second }], 4],
    ["Pisah PDF", pdfFile, 2],
    ["Hapus halaman kosong", pdfFile, 2],
  ]) {
    await openTool(tool);
    await upload(files);
    if (tool === "Pisah PDF") await dialog.getByLabel("Urutan atau rentang halaman").fill("3, 1");
    await processTool();
    assert.equal((await PDFDocument.load(await capture(button(dialog, "Unduh")))).getPageCount(), count);
    await close();
  }
  checked("Gabung, pisah, dan hapus halaman kosong PDF");

  await openTool("Susun halaman");
  await upload(pdfFile);
  await button(dialog, "Turunkan halaman 1").click();
  await button(dialog, "Hapus halaman 2").click();
  await button(dialog, "Putar halaman 3").click();
  const sorted = await PDFDocument.load(await capture(button(dialog, "Unduh PDF")));
  assert.equal(sorted.getPageCount(), 2);
  assert.equal(sorted.getPage(1).getRotation().angle, 90);
  await close();
  checked("Susun ulang dan putar halaman satu per satu");

  await openTool("Nomor halaman");
  await upload(pdfFile);
  await choose(dialog, "Format penomoran", "Halaman X");
  await choose(dialog, "Posisi nomor", "Kanan bawah");
  await dialog.getByLabel("Lewati halaman sampul pertama").check();
  await processTool();
  const numbered = await capture(button(dialog, "Unduh"));
  await close();
  await fileInput.setInputFiles({ ...pdfFile, name: "Nomor-uji.pdf", buffer: numbered });
  await dialog.getByLabel("Cari teks PDF").fill("Halaman 2");
  await button(dialog, "Cari").click();
  await shown(button(dialog, "Hal. 2"));
  await close();
  await openTool("Kompres PDF");
  await upload(pdfFile);
  await button(dialog, "200 KB").click();
  assert.equal(await dialog.getByLabel("Target ukuran maksimum (KB)").inputValue(), "200");
  await processTool();
  await shown(dialog.getByText("Ukuran target tercapai."));
  await close();
  checked("Penomoran PDF dengan posisi dan lewati sampul serta preset kompresi");

  await openTool("Lindungi PDF");
  await upload(pdfFile);
  await dialog.getByLabel("Kata sandi pembuka", { exact: true }).fill("SandiUjiDepup2026");
  await dialog.getByLabel(/Batasi cetak/).check();
  await processTool();
  const locked = await capture(button(dialog, "Unduh"));
  assert.ok(locked.includes(Buffer.from("/Encrypt")));
  await close();
  await fileInput.setInputFiles({ ...pdfFile, name: "Terlindungi.pdf", buffer: locked });
  await dialog.getByLabel("Kata sandi PDF").fill("SandiUjiDepup2026");
  await button(dialog, "Buka PDF").click();
  await shown(dialog.locator("canvas[aria-label='Tampilan halaman 1']"));
  assert.equal(await button(dialog, "Cetak").count(), 0);
  await close();
  checked("Enkripsi PDF, pembukaan dengan sandi, dan izin cetak");

  const native = await PDFDocument.load(second);
  native.catalog.set(PDFName.of("DepupSecureData"), native.context.register(native.context.stream("Data uji")));
  const nativeBytes = Buffer.from(await native.save({ useObjectStreams: false }));
  const nativeFile = { ...pdfFile, name: "PDF-khusus.pdf", buffer: nativeBytes };
  const nativeMessage = "Dokumen ini hanya dapat dibuka di aplikasi Depup Office.";

  await fileInput.setInputFiles(nativeFile);
  await shown(dialog.getByRole("heading", { name: "Dokumen Terlindungi Depup", exact: true }));
  await shown(dialog.getByText(nativeMessage));
  assert.equal(await dialog.locator("canvas, input[type=password]").count(), 0);
  assert.deepEqual(await capture(button(dialog, "Unduh berkas asli")), nativeBytes);
  await close();

  await navigate("Dokumen");
  await page.reload({ waitUntil: "load" });
  const nativeRow = page.getByRole("row").filter({ hasText: nativeFile.name });
  await shown(nativeRow.getByText(/Dokumen Terlindungi Depup/));
  await button(nativeRow, /^PDF-khusus\.pdf/).click();
  await shown(dialog.getByText(nativeMessage));
  await close();

  await openTool("Pisah PDF");
  await upload(nativeFile);
  await shown(dialog.getByText(nativeMessage));
  assert.equal(await button(dialog, "Proses berkas").count(), 0);
  await button(dialog, "Pilih berkas lain").click();
  await shown(dialog.getByLabel("Pilih berkas dari perangkat"));
  await close();

  await button(page, "Pilih berkas dulu").click();
  await dialog.getByLabel("Pilih berkas untuk alat").setInputFiles({
    name: "PDF-khusus.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(await native.save()),
  });
  await shown(dialog.getByText(nativeMessage));
  await close();
  checked("Dokumen Terlindungi Depup terdeteksi dari isi berkas, diarahkan ke aplikasi, dan diunduh utuh");

  await navigate("Scan");
  const scan = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 570;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black"; ctx.font = "bold 42px Arial"; ctx.fillText("Depup Office", 90, 140);
    ctx.font = "36px Arial"; ctx.fillText("Dokumen pengujian pemindai.", 90, 235);
    return canvas.toDataURL("image/png").split(",")[1];
  }), "base64");
  await page.getByLabel("Pilih foto", { exact: true }).setInputFiles({ name: "Pindaian.png", mimeType: "image/png", buffer: scan });
  await shown(page.getByRole("img", { name: "Pratinjau halaman scan" }));
  await button(page, "Ambil teks").click();
  await page.getByLabel("Teks hasil OCR").waitFor({ timeout: 120_000 });
  assert.match(await page.getByLabel("Teks hasil OCR").inputValue(), /Depup Office/i);
  await page.getByLabel(/Tanam teks OCR/).check();
  await button(page, "Buat PDF").click();
  await button(page, "Unduh").waitFor({ timeout: 120_000 });
  const scanned = await capture(button(page, "Unduh"));
  assert.equal((await PDFDocument.load(scanned)).getPageCount(), 1);
  await fileInput.setInputFiles({ ...pdfFile, name: "Scan-ocr.pdf", buffer: scanned });
  await dialog.getByLabel("Cari teks PDF").fill("Depup");
  await button(dialog, "Cari").click();
  await shown(button(dialog, "Hal. 1"));
  await close();
  checked("OCR gambar dan ekspor PDF dengan teks yang bisa dicari");

  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, "Sensur data").click();
  const frame = page.getByTestId("scan-redaction");
  await frame.scrollIntoViewIfNeeded();
  const bounds = await frame.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .07, bounds.y + bounds.height * .16);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .52, bounds.y + bounds.height * .28, { steps: 6 });
  await page.mouse.up();
  await shown(page.getByText("1 area disensor"));
  await button(page, "Sensur data").click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 1440, height: 900 });
  await choose(page, "Ekspor sebagai", "Word (DOCX)");
  await button(page, "Buat DOCX").click();
  await button(page, "Unduh").waitFor({ timeout: 120_000 });
  const scanWord = await Zip.loadAsync(await capture(button(page, "Unduh")));
  const scanText = await scanWord.file("word/document.xml").async("string");
  assert.match(scanText, /Dokumen pengujian/i);
  assert.doesNotMatch(scanText, /Depup Office/i);

  await button(page, "Putar halaman").click();
  await choose(page, "Isi Word", "Foto per halaman");
  await button(page, "Buat DOCX").click();
  const photoWord = await Zip.loadAsync(await capture(button(page, "Unduh")));
  const photo = Object.values(photoWord.files).find((entry) => /^word\/media\/.+\.jpg$/.test(entry.name));
  assert.ok(photo);
  const photoBytes = Buffer.from(await photo.async("nodebuffer"));
  const maskedPixel = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: "image/jpeg" }));
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return Array.from(ctx.getImageData(Math.floor(canvas.width * .78), Math.floor(canvas.height * .30), 1, 1).data);
  }, photoBytes.toString("base64"));
  assert.ok(maskedPixel.slice(0, 3).every((channel) => channel < 35), "Sensur harus ikut tersimpan pada foto yang diputar");
  await button(page, "Ambil ulang").click();
  await page.waitForFunction(() => document.querySelector("video")?.videoWidth > 0);
  await button(page, "Ambil halaman").click();
  await page.waitForFunction(() => !!document.querySelector(".scan-redaction img") && !document.querySelector(".scan-masked-thumb"));
  assert.equal(await button(page, /^Pilih halaman /).count(), 1);
  assert.equal(await page.getByText("1 area disensor").count(), 0);
  await page.getByLabel("Ganti foto halaman").setInputFiles({ name: "Foto pengganti.png", mimeType: "image/png", buffer: scan });
  await shown(page.getByRole("img", { name: "Pratinjau halaman scan" }));
  assert.equal(await button(page, /^Pilih halaman /).count(), 1);
  checked("Sensur tetap pada halaman yang diputar, hasil OCR bersih, ekspor DOCX, dan ambil ulang");

  await openTool("Ambil gambar");
  await upload({ ...pdfFile, name: "Scan-ocr.pdf", buffer: scanned });
  await processTool();
  const embedded = await capture(button(dialog, "Unduh"));
  assert.deepEqual(embedded.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await close();
  await openTool("Pembersih bayangan");
  await upload({ name: "Pindaian.png", mimeType: "image/png", buffer: scan });
  await processTool();
  const cleaned = await capture(button(dialog, "Unduh"));
  assert.deepEqual(cleaned.subarray(0, 3), Buffer.from([255, 216, 255]));
  await close();
  checked("Ekstraksi gambar PDF dan pengolahan foto");

  await openTool("Tanda tangan PDF");
  await upload(pdfFile);
  await dialog.getByLabel("Kanvas tanda tangan").scrollIntoViewIfNeeded();
  const signCanvas = await dialog.getByLabel("Kanvas tanda tangan").boundingBox();
  await page.mouse.move(signCanvas.x + 36, signCanvas.y + 41);
  await page.mouse.down();
  await page.mouse.move(signCanvas.x + 103, signCanvas.y + 67, { steps: 8 });
  await page.mouse.move(signCanvas.x + 170, signCanvas.y + 25, { steps: 8 });
  await page.mouse.up();
  await shown(dialog.getByText("Tanda tangan siap ditempel."));
  const stamp = button(dialog, "Geser tanda tangan");
  await shown(stamp);
  await stamp.press("ArrowLeft");
  assert.equal(await dialog.getByLabel("Posisi dari kiri (%)").inputValue(), "63");
  await choose(dialog, "Warna tanda tangan", "Biru");
  await shown(stamp);
  await processTool();
  const signed = await capture(button(dialog, "Unduh"));
  assert.equal((await PDFDocument.load(signed)).getPageCount(), 3);
  assert.ok(signed.includes(Buffer.from("/Subtype /Image")));
  await close();
  checked("Gambar, pindahkan, ubah warna, dan tempel tanda tangan pada PDF");

  const deck = new Zip();
  const names = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  deck.file("ppt/presentation.xml", '<p:presentation ' + names + '><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>');
  deck.file("ppt/_rels/presentation.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>');
  for (const [index, text] of [[1, "Tampilan akhir"], [2, "Tampilan awal"]]) {
    deck.file("ppt/slides/slide" + index + ".xml", '<p:sld ' + names + '><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="6100000" cy="1000000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="2600"/><a:t>' + text + '</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>');
  }
  await fileInput.setInputFiles({ name: "Slideshow.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: await deck.generateAsync({ type: "nodebuffer" }) });
  await shown(dialog.getByRole("img", { name: "Slide 1" }));
  assert.equal(await dialog.locator(".presentation-stage p.sr-only").textContent(), "Tampilan awal");
  await button(dialog, "Putar otomatis").click();
  await shown(dialog.getByLabel("Waktu presentasi"));
  await shown(dialog.getByRole("img", { name: "Slide 2" }));
  assert.equal(await dialog.locator(".presentation-stage p.sr-only").textContent(), "Tampilan akhir");
  await button(dialog, "Ekspor PDF").click();
  await processTool();
  const slidesPdf = await PDFDocument.load(await capture(button(dialog, "Unduh")));
  assert.equal(slidesPdf.getPageCount(), 2);
  assert.deepEqual(slidesPdf.getPage(0).getSize(), { width: 720, height: 540 });
  await close();
  checked("Urutan dan rasio slide PPTX, timer, pemutaran otomatis, serta ekspor PDF");

  await openTool("QR & barcode");
  await dialog.getByLabel("Teks atau tautan").fill("Depup QR pengujian");
  await button(dialog, "Buat kode QR").click();
  const qr = await capture(button(dialog, "Unduh"));
  await choose(dialog, "Mode QR", "Pindai foto");
  await upload({ name: "QR.png", mimeType: "image/png", buffer: qr });
  await button(dialog, "Pindai kode").click();
  await shown(dialog.getByText("Depup QR pengujian", { exact: true }));
  await close();
  checked("Buat QR dan dekode gambar QR");

  await openTool("Brankas berkas");
  await dialog.getByLabel("Pilih berkas untuk dikunci").setInputFiles(pdfFile);
  await dialog.getByLabel("Kata sandi", { exact: true }).fill("SandiUjiBrankas2026");
  await button(dialog, "Enkripsi & simpan").click();
  await shown(dialog.getByText("Berkas ditambahkan ke Brankas."));
  await button(dialog, "Buka").click();
  await dialog.getByLabel("Kata sandi", { exact: true }).fill("Sandi salah");
  await button(dialog, "Buka dan unduh").click();
  await shown(dialog.getByText("Kata sandi salah atau berkas rusak."));
  await dialog.getByLabel("Kata sandi", { exact: true }).fill("SandiUjiBrankas2026");
  assert.deepEqual(await capture(button(dialog, "Buka dan unduh")), original);
  await close();
  checked("Enkripsi dan dekripsi AES-256, termasuk penolakan sandi salah");

  const scannerImage = { name: "Pindaian.png", mimeType: "image/png", buffer: scan };
  const csvFile = { name: "Rekap.csv", mimeType: "text/csv", buffer: Buffer.from("Item,Unit\nKertas,12\nPena,8") };
  const textFile = { name: "Catatan.txt", mimeType: "text/plain", buffer: Buffer.from("Agenda pengujian DepUp meliputi verifikasi pembaca dokumen dan alat konversi.") };
  const embeddedPdf = { name: "Kapsul-uji.exe", mimeType: "application/octet-stream", buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(62), second]) };
  const outputs = [
    { title: "Watermark PDF", file: pdfFile, preset: "DRAFT", expected: ["pdf", 3] },
    { title: "PDF ke JPG", file: pdfFile, expected: ["jpg"], files: 3 },
    { title: "PDF ke Word", file: pdfFile, expected: ["docx", "Depup Office pengujian"] },
    { title: "PDF bisa dicari", file: { ...pdfFile, buffer: scanned }, expected: ["pdf", 1] },
    { title: "Gambar ke PDF", file: [scannerImage, scannerImage], expected: ["pdf", 2] },
    { title: "Gabung berbagai format", file: [pdfFile, csvFile, scannerImage], expected: ["pdf", 5] },
    { title: "EXE ke PDF", file: embeddedPdf, expected: ["pdf", 1] },
    { title: "Buka kunci PDF", file: { ...pdfFile, buffer: locked }, fields: { "Kata sandi pembuka": "SandiUjiDepup2026" }, expected: ["pdf", 3] },
    { title: "Watermark foto massal", file: scannerImage, fields: { "Teks watermark": "DEMO" }, expected: ["jpg"] },
    { title: "Pembuat pasfoto", file: scannerImage, expected: ["pdf", 1], files: 2 },
    { title: "Grafik Excel", file: csvFile, expected: ["png"] },
    { title: "Konversi foto massal", file: scannerImage, expected: ["pdf", 1] },
    { title: "Kompres foto", file: scannerImage, expected: ["jpg"] },
    { title: "TTD transparan", file: scannerImage, expected: ["png"] },
    { title: "Ambil teks dari foto", file: scannerImage, expected: ["txt", "Depup Office"] },
    { title: "Pindai kartu nama", file: scannerImage, expected: ["vcf", "BEGIN:VCARD"] },
    { title: "Pindai tabel ke Excel", file: scannerImage, expected: ["xlsx", /Depup/i] },
    { title: "Pindai struk", file: scannerImage, expected: ["xlsx", /Keterangan/ ] },
    { title: "Label harga & barcode", fields: { Judul: "Pena", "Harga (Rp)": "4000", "Isi barcode": "DU042" }, expected: ["png"], files: 2 },
    { title: "Catatan jadi PDF", fields: { "Isi catatan": "Draft Departemen Operasional" }, expected: ["pdf", 1] },
    { title: "Nota & kuitansi", fields: { "Daftar barang": "Kertas | 2 | 15000" }, expected: ["pdf", 1] },
    { title: "Katalog & portofolio", file: scannerImage, fields: { "Deskripsi produk per baris": "Contoh produk DepUp" }, expected: ["pdf", 1] },
    { title: "Jadwal & perencana", fields: { "Agenda per baris": "21-11-2026 | 09.00 | Rapat DepUp | Dilaksanakan" }, expected: ["xlsx", /Rapat DepUp/], files: 2 },
    { title: "Ringkas dokumen", file: textFile, expected: ["pdf", 1] },
  ];
  for (const { title, file, preset, fields, expected: [format, content], files: count = 1 } of outputs) {
    await openTool(title);
    if (file) await upload(file);
    if (preset) await button(dialog, preset).click();
    for (const [label, value] of Object.entries(fields ?? {})) await dialog.getByLabel(label, { exact: true }).fill(value);
    await processTool();
    const downloads = button(dialog, "Unduh");
    await downloads.first().waitFor({ timeout: 60_000 });
    assert.equal(await downloads.count(), count, title);
    const data = await capture(downloads.first());
    if (format === "pdf") assert.equal((await PDFDocument.load(data)).getPageCount(), content, title);
    if (format === "jpg") assert.equal(data.subarray(0, 3).toString("hex"), "ffd8ff", title);
    if (format === "png") assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", title);
    if (format === "docx") assert.ok((await (await Zip.loadAsync(data)).file("word/document.xml").async("string")).includes(content), title);
    if (format === "xlsx") {
      const workbook = new Excel.Workbook();
      await workbook.xlsx.load(data);
      assert.match(JSON.stringify(workbook.worksheets[0].getSheetValues()), content, title);
    }
    if (format === "txt" || format === "vcf") assert.ok(data.toString().includes(content), title);
    if (title === "PDF ke JPG") {
      const zipped = await Zip.loadAsync(await capture(button(dialog, "Unduh ZIP")));
      assert.equal(Object.keys(zipped.files).length, 3);
    }
    await close();
  }
  checked("24 alat tambahan menghasilkan PDF, JPG, PNG, DOCX, XLSX, VCF, TXT, dan ZIP yang valid");

  await openTool("Anotasi PDF");
  await upload(pdfFile);
  await button(dialog, "Catatan").click();
  await dialog.getByLabel("Teks catatan").fill("Ditinjau DepUp");
  await dialog.getByLabel("Kanvas anotasi halaman 1").click({ position: { x: 120, y: 150 } });
  const annotated = await capture(button(dialog, "Unduh PDF"));
  assert.equal((await PDFDocument.load(annotated)).getPageCount(), 3);
  assert.ok(annotated.includes(Buffer.from("/Subtype /Image")));
  await close();
  await openTool("Pustaka tanda tangan");
  await dialog.getByLabel("Impor tanda tangan atau stempel").setInputFiles({ ...scannerImage, name: "Stempel uji.png" });
  await shown(button(dialog, "Unduh Stempel uji"));
  await close();
  await openTool("Pustaka tanda tangan");
  await shown(button(dialog, "Unduh Stempel uji"));
  await button(dialog, "Hapus Stempel uji").click();
  await shown(dialog.getByText("Belum ada tanda tangan atau stempel tersimpan."));
  await close();
  checked("Anotasi PDF dan persistensi pustaka tanda tangan");

  await openTool("Baca dengan suara");
  await upload(textFile);
  await button(dialog, "Muat teks").click();
  await shown(dialog.getByText(/Agenda pengujian DepUp/));
  await shown(button(dialog, "Baca"));
  await close();
  await openTool("Simpan ke perangkat");
  await upload(pdfFile);
  assert.deepEqual(await capture(button(dialog, "Unduh berkas")), original);
  await close();
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await openTool("Bagikan berkas");
  await upload(pdfFile);
  assert.deepEqual(await capture(button(dialog, "Bagikan")), original);
  await shown(dialog.getByText("Berkas diunduh dan siap dibagikan."));
  await close();
  await openTool("Cetak dokumen");
  await upload(pdfFile);
  await button(dialog, "Cetak").click();
  await shown(dialog.getByText("Dialog cetak dibuka."));
  assert.match(await page.locator("iframe[title='Pratinjau cetak']").getAttribute("src"), /^blob:/);
  await close();
  checked("Baca teks, unduh salinan, fallback berbagi, dan panggilan cetak");

  if (globalThis.process.env.TEST_OFFLINE === "1") {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" });
    await navigate("Dokumen");
    await shown(page.getByRole("row").filter({ hasText: "Contoh.pdf" }));
    await navigate("Scan");
    await shown(button(page, "Aktifkan kamera"));
    await page.getByRole("link", { name: "Halaman DepUp Office" }).click();
    await shown(page.getByRole("heading", { name: /Dokumen beres/ }));
    await page.getByRole("link", { name: "Buka ruang kerja" }).first().click();
    await shown(page.getByRole("heading", { name: /Selamat/ }));
    checked("Landing dan ruang kerja dapat dibuka offline dengan dokumen lokal");
  }
  assert.deepEqual(errors, []);
  console.log("Semua alur pengujian lulus.");
} catch (error) {
  console.error("Galat halaman:", errors, await page.getByRole("alert").allTextContents().catch(() => []));
  throw error;
} finally {
  await browser.close();
}
