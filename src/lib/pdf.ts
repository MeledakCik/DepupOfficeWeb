import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { baseName } from "./catalog";
import { canvasOf, context, imageBlob, loadImage, withOcr } from "./imaging";
import { isDepupProtectedDocument, protectedDocumentMessage } from "./protected-document";
import type { Output } from "./workspace";

export const a4 = [595.28, 841.89] as const;
const mime = "application/pdf";

export async function readPdf(blob: Blob, password?: string) {
  if (await isDepupProtectedDocument(blob)) throw new Error(protectedDocumentMessage);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/runtime/pdf/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()), password,
    cMapUrl: "/runtime/pdf/cmaps/", cMapPacked: true,
    standardFontDataUrl: "/runtime/pdf/standard_fonts/",
    wasmUrl: "/runtime/pdf/wasm/", iccUrl: "/runtime/pdf/iccs/",
  });
  try { return Object.assign(await task.promise, { destroy: () => task.destroy() }); }
  catch (error) { await task.destroy().catch(() => {}); throw error; }
}

export async function pdfCanvas(page: PDFPageProxy, longest = 1600) {
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: longest / Math.max(unscaled.width, unscaled.height) });
  const canvas = canvasOf(viewport.width, viewport.height);
  const ctx = context(canvas);
  await page.render({ canvas, canvasContext: ctx, viewport, background: "#fff" }).promise;
  return canvas;
}

export async function pdfPageText(page: PDFPageProxy) {
  const pageText = await page.getTextContent();
  return pageText.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
}

export async function readPdfText(blob: Blob, password?: string) {
  const pdf = await readPdf(blob, password);
  try {
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      pages.push(await pdfPageText(page));
      page.cleanup();
    }
    return pages;
  } finally { await pdf.destroy(); }
}

export function pdfOutput(name: string, bytes: Uint8Array | ArrayBuffer): Output {
  return { name: name.endsWith(".pdf") ? name : name + ".pdf", blob: new Blob([bytes instanceof Uint8Array ? Uint8Array.from(bytes) : bytes], { type: mime }) };
}

export function pdfString(text: string, font: PDFFont) {
  return Array.from(text.replace(/\t/g, "    ").replace(/[‐‑‒–—]/g, "-")).map((character) => {
    try { font.encodeText(character); return character; } catch { return "?"; }
  }).join("");
}

export function wrapText(sentence: string, font: PDFFont, size: number, width: number) {
  const words = sentence.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(next, size) <= width) { current = next; continue; }
    if (current) lines.push(current);
    current = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(current + character, size) > width) { lines.push(current); current = ""; }
      current += character;
    }
  }
  lines.push(current);
  return lines;
}

export async function textPdf(title: string, text: string, options: { letter?: boolean; margin?: number; size?: number; lineHeight?: number } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = options.letter ? [612, 792] : [...a4];
  const [width, height] = pageSize;
  const margin = options.margin ?? 48;
  const size = options.size ?? 11;
  const step = size * (options.lineHeight ?? 1.5);
  let page = doc.addPage(pageSize);
  let y = height - margin;
  if (title) {
    for (const line of wrapText(pdfString(title, bold), bold, 21, width - 2 * margin)) {
      page.drawText(line, { x: margin, y, size: 21, font: bold });
      y -= 25;
    }
    y -= 9;
  }
  for (const paragraph of text.split(/\r?\n/)) {
    for (const line of wrapText(pdfString(paragraph, font), font, size, width - 2 * margin)) {
      if (y < margin) { page = doc.addPage(pageSize); y = height - margin; }
      if (line) page.drawText(line, { x: margin, y, size, font, color: rgb(.1, .12, .15) });
      y -= step;
    }
  }
  return doc.save();
}

export async function appendImage(doc: PDFDocument, input: Blob, sizing: "A4" | "Letter" | "photo" = "A4") {
  const canvas = await loadImage(input);
  const image = await doc.embedJpg(await (await imageBlob(canvas)).arrayBuffer());
  const frame: [number, number] = sizing === "photo" ? [canvas.width * .65, canvas.height * .65] :
    sizing === "Letter" ? (image.width > image.height ? [792, 612] : [612, 792]) :
      image.width > image.height ? [a4[1], a4[0]] : [...a4];
  const page = doc.addPage(frame);
  const margin = sizing === "photo" ? 0 : 18;
  const box = image.scaleToFit(frame[0] - margin * 2, frame[1] - margin * 2);
  const x = (frame[0] - box.width) / 2;
  const y = (frame[1] - box.height) / 2;
  page.drawImage(image, { x, y, ...box });
  return { page, x, y, ...box, canvas };
}

export async function appendPdf(doc: PDFDocument, source: Blob) {
  const origin = await PDFDocument.load(await source.arrayBuffer());
  for (const page of await doc.copyPages(origin, origin.getPageIndices())) doc.addPage(page);
}

type OcrWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
export function ocrWords(result: { blocks: null | { paragraphs: { lines: { words: OcrWord[] }[] }[] }[] }) {
  return result.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words))) ?? [];
}

export function addTextLayer(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont, words: OcrWord[], area: {
  x: number; y: number; width: number; height: number; canvas: HTMLCanvasElement;
}) {
  for (const { text, bbox } of words) {
    const word = pdfString(text, font);
    if (!word) continue;
    const scaleX = area.width / area.canvas.width;
    const scaleY = area.height / area.canvas.height;
    const maxSize = (bbox.x1 - bbox.x0) * scaleX / Math.max(1, font.widthOfTextAtSize(word, 1));
    const size = Math.max(2, Math.min(maxSize, (bbox.y1 - bbox.y0) * scaleY));
    page.drawText(word, { x: area.x + bbox.x0 * scaleX, y: area.y + area.height - bbox.y1 * scaleY, font, size, opacity: 0 });
  }
}

export async function imagesPdf(images: Blob[], sizing: "A4" | "Letter" | "photo" = "A4", ocr = false, progress?: (text: string) => void) {
  const doc = await PDFDocument.create();
  if (ocr) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    await withOcr(async (worker) => {
      for (const image of images) {
        const area = await appendImage(doc, image, sizing);
        const result = await worker.recognize(area.canvas, {}, { blocks: true });
        addTextLayer(area.page, font, ocrWords(result.data), area);
      }
    }, progress);
  } else {
    for (const image of images) await appendImage(doc, image, sizing);
  }
  return doc.save();
}

export function selectPages(value: string, count: number) {
  const indexes: number[] = [];
  for (const token of value.split(",").map((item) => item.trim())) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error("Tulis nomor atau rentang halaman, misalnya 1, 3-5.");
    const from = Number(match[1]);
    const to = Number(match[2] ?? from);
    if (from < 1 || to < 1 || Math.max(from, to) > count) throw new Error("Nomor halaman di luar rentang 1–" + count + ".");
    const direction = from <= to ? 1 : -1;
    for (let page = from; page !== to + direction; page += direction) {
      indexes.push(page - 1);
      if (indexes.length > Math.max(5000, count)) throw new Error("Terlalu banyak halaman dipilih.");
    }
  }
  return indexes;
}

export async function qpdf(blob: Blob, args: string[]) {
  const input = await blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker("/qpdf-worker.js");
    const timer = setTimeout(() => finish(() => reject(new Error("Pengolahan PDF melebihi batas waktu."))), 120_000);
    function finish(action: () => void) { clearTimeout(timer); worker.terminate(); action(); }
    worker.onerror = () => finish(() => reject(new Error("Mesin PDF tidak dapat dimuat.")));
    worker.onmessage = ({ data }: MessageEvent<{ output?: Uint8Array<ArrayBuffer>; error?: string }>) => finish(() => {
      if (data.output) resolve(data.output.buffer);
      else reject(new Error(data.error ?? "PDF gagal diproses."));
    });
    worker.postMessage({ input, args }, [input]);
  });
}

export async function compressPdf(input: File, target: number, raster: boolean, progress?: (text: string) => void) {
  let best = pdfOutput(baseName(input.name) + "-kompres", await input.arrayBuffer());
  if (best.blob.size <= target) return best;
  progress?.("Merapikan struktur PDF…");
  const smaller = await qpdf(input, ["--object-streams=generate", "--recompress-flate", "--compression-level=9"]);
  if (smaller.byteLength < best.blob.size) best = pdfOutput(best.name, smaller);
  if (!raster || best.blob.size <= target) return best;
  const source = await readPdf(input);
  try {
    for (const [length, quality] of [[1400, .70], [1100, .52], [850, .37], [620, .26], [440, .18]]) {
      const doc = await PDFDocument.create();
      for (let i = 1; i <= source.numPages; i++) {
        progress?.("Mengecilkan halaman " + i + " dari " + source.numPages + "…");
        const page = await source.getPage(i);
        const shape = page.getViewport({ scale: 1 });
        const canvas = await pdfCanvas(page, length);
        const image = await doc.embedJpg(await (await imageBlob(canvas, "image/jpeg", quality)).arrayBuffer());
        doc.addPage([shape.width, shape.height]).drawImage(image, { x: 0, y: 0, width: shape.width, height: shape.height });
        page.cleanup();
      }
      const next = await doc.save();
      if (next.length < best.blob.size) best = pdfOutput(best.name, next);
      if (best.blob.size <= target) break;
    }
    return best;
  } finally { await source.destroy(); }
}

export async function renderOutputs(file: File, mode: "pdf-jpg" | "extract-images" | "searchable" | "blank", progress?: (text: string) => void) {
  const source = await readPdf(file);
  const outputs: Output[] = [];
  const name = baseName(file.name);
  const doc = await PDFDocument.create();
  try {
    if (mode === "searchable") {
      const raw = await PDFDocument.load(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const copies = await doc.copyPages(raw, raw.getPageIndices());
      await withOcr(async (worker) => {
        for (let i = 0; i < copies.length; i++) {
          const original = await source.getPage(i + 1);
          const page = doc.addPage(copies[i]);
          if (!(await pdfPageText(original)).length) {
            const canvas = await pdfCanvas(original);
            const result = await worker.recognize(canvas, {}, { blocks: true });
            const { width, height } = page.getSize();
            if (page.getRotation().angle !== 0) {
              const photo = await doc.embedJpg(await (await imageBlob(canvas)).arrayBuffer());
              doc.removePage(doc.getPageCount() - 1);
              const visual = original.getViewport({ scale: 1 });
              const flat = doc.addPage([visual.width, visual.height]);
              flat.drawImage(photo, { x: 0, y: 0, width: visual.width, height: visual.height });
              addTextLayer(flat, font, ocrWords(result.data), { x: 0, y: 0, width: visual.width, height: visual.height, canvas });
            } else addTextLayer(page, font, ocrWords(result.data), { x: 0, y: 0, width, height, canvas });
          }
          original.cleanup();
        }
      }, progress);
      return [pdfOutput(name + "-ocr", await doc.save())];
    }
    if (mode === "extract-images") return await extractImages(source, name);
    const keep: number[] = [];
    for (let i = 1; i <= source.numPages; i++) {
      progress?.("Memproses halaman " + i + " dari " + source.numPages + "…");
      const page = await source.getPage(i);
      const canvas = await pdfCanvas(page, mode === "blank" ? 240 : 1800);
      if (mode === "blank") {
        const pixels = context(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
        let nonWhite = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) if (Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 225) nonWhite++;
        if (nonWhite > 0 || (await pdfPageText(page)).length) keep.push(i - 1);
      } else outputs.push({ name: name + "-" + i + ".jpg", blob: await imageBlob(canvas) });
      page.cleanup();
    }
    if (mode === "blank") {
      if (!keep.length) throw new Error("Semua halaman terdeteksi kosong.");
      const raw = await PDFDocument.load(await file.arrayBuffer());
      for (const page of await doc.copyPages(raw, keep)) doc.addPage(page);
      outputs.push(pdfOutput(name + "-tanpa-kosong", await doc.save()));
    }
    return outputs;
  } finally { await source.destroy(); }
}

type PdfImage = { width: number; height: number; data?: Uint8Array; bitmap?: ImageBitmap; kind?: number };
async function extractImages(pdf: PDFDocumentProxy, title: string) {
  const { OPS } = await import("pdfjs-dist");
  const output: Output[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const list = await page.getOperatorList();
    const seen = new Set<string>();
    for (let i = 0; i < list.fnArray.length; i++) {
      let item: PdfImage | undefined;
      const value = list.argsArray[i]?.[0];
      if (list.fnArray[i] === OPS.paintImageXObject || list.fnArray[i] === OPS.paintImageXObjectRepeat) {
        if (typeof value !== "string" || seen.has(value)) continue;
        seen.add(value);
        const resources = value.startsWith("g_") ? page.commonObjs : page.objs;
        item = await new Promise<PdfImage | undefined>((resolve) => {
          const timer = setTimeout(() => resolve(undefined), 5000);
          const complete = (decoded?: PdfImage) => { clearTimeout(timer); resolve(decoded); };
          resources.get(value, complete, () => complete());
        });
      } else if (list.fnArray[i] === OPS.paintInlineImageXObject) item = value;
      if (!item?.width || !item.height) continue;
      const canvas = canvasOf(item.width, item.height);
      const ctx = context(canvas);
      if (item.bitmap) ctx.drawImage(item.bitmap, 0, 0);
      else if (item.data) {
        const pixels = ctx.createImageData(item.width, item.height);
        for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) {
          const pixel = y * item.width + x;
          const offset = pixel * 4;
          if (item.kind === 1) {
            const bit = ((item.data[y * Math.ceil(item.width / 8) + (x >> 3)] >> (7 - x % 8)) & 1) * 255;
            pixels.data.set([bit, bit, bit, 255], offset);
          } else {
            const channels = item.kind === 3 ? 4 : 3;
            pixels.data.set([item.data[pixel * channels], item.data[pixel * channels + 1], item.data[pixel * channels + 2], channels === 4 ? item.data[pixel * channels + 3] : 255], offset);
          }
        }
        ctx.putImageData(pixels, 0, 0);
      } else continue;
      output.push({ name: title + "-gambar-" + (output.length + 1) + ".png", blob: await imageBlob(canvas, "image/png") });
    }
    page.cleanup();
  }
  if (!output.length) throw new Error("Tidak ada gambar tertanam yang dapat diekspor.");
  return output;
}
