import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { devices, webkit } from "playwright";

const baseUrl = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
const browser = await webkit.launch();
const page = await browser.newPage({ ...devices["iPhone 13"], colorScheme: "dark", reducedMotion: "reduce" });
page.setDefaultTimeout(12_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const pdf = await PDFDocument.create();
pdf.addPage().drawText("Dokumen uji DepUp");
const file = {
  name: "Uji DepUp.pdf", mimeType: "application/pdf",
  buffer: process.env.BRAND_PDF ? await readFile(process.env.BRAND_PDF) : Buffer.from(await pdf.save()),
};
const dialog = page.getByRole("dialog");
const nav = page.getByRole("navigation", { name: "Navigasi utama" });
const close = () => dialog.getByRole("button", { name: "Tutup", exact: true }).click();
const rendered = () => dialog.getByRole("img", { name: "Tampilan halaman 1" }).waitFor();

try {
  await page.goto(baseUrl.href);
  await page.getByRole("heading", { name: /Dokumen beres/ }).waitFor();
  await page.waitForFunction(() => document.querySelector("picture img").currentSrc.includes("glass-pages-480.webp"));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole("link", { name: "Buka ruang kerja", exact: true }).first().click();
  await nav.getByRole("button", { name: "Alat", exact: true }).click();

  const search = page.getByLabel("Cari alat", { exact: true });
  await search.fill("Kompres PDF");
  await page.getByRole("button", { name: /^Kompres PDF/ }).click();
  await dialog.getByLabel("Target ukuran maksimum (KB)").waitFor();
  await close();

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("banner").getByRole("button", { name: "Buka berkas", exact: true }).click(),
  ]);
  await chooser.setFiles(file);
  await rendered();
  await close();
  await nav.getByRole("button", { name: "Dokumen", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Uji DepUp\.pdf/ }).first().click();
  await rendered();
  await close();

  await nav.getByRole("button", { name: "Alat", exact: true }).click();
  await search.fill("Pustaka tanda tangan");
  await page.getByRole("button", { name: /^Pustaka tanda tangan/ }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    canvas.getContext("2d").fillRect(8, 8, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await dialog.getByLabel("Impor tanda tangan atau stempel").setInputFiles({
    name: "Cap DepUp.png", mimeType: "image/png", buffer: Buffer.from(png, "base64"),
  });
  await dialog.getByRole("button", { name: "Unduh Cap DepUp", exact: true }).waitFor();
  await close();
  await page.getByRole("button", { name: /^Pustaka tanda tangan/ }).click();
  await dialog.getByRole("button", { name: "Unduh Cap DepUp", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("WebKit profil iPhone 13 lulus untuk landing, pemilih berkas, pembaca PDF, dan persistensi dokumen serta tanda tangan.");
} catch (error) {
  console.error("Galat halaman", errors, await page.locator("dialog, .toast").allTextContents().catch(() => []));
  throw error;
} finally {
  await browser.close();
}
