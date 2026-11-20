import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { baseName, getKind } from "./catalog";
import { canvasOf, changeImages, context, imageBlob, loadImage, signatureImage, withOcr } from "./imaging";
import {
  cellKey, columnName, displaySheetValue, extractText, formulaEvaluator, readSheets, readWord, safeText, sheetFromRows, textHtml,
  visualPdfWord, writeSheets, writeWord,
} from "./office";
import { a4, appendImage, appendPdf, compressPdf, imagesPdf, ocrWords, pdfOutput, pdfString, qpdf, readPdfText, renderOutputs, selectPages, textPdf, wrapText } from "./pdf";
import { findProtectedDocument, protectedDocumentMessage } from "./protected-document";
import { pageSpace, stampPlacement } from "./pdf-placement";
import { readSlides, renderSlide } from "./slides";
import { download, shareFile, type Output, type Preferences } from "./workspace";

export type ToolValues = Record<string, string | boolean | undefined>;
type ToolResult = { outputs?: Output[]; text?: string };
const textOutput = (name: string, content: string, type = "text/plain;charset=utf-8"): Output => ({ name, blob: new Blob([content], { type }) });
const formatMoney = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

async function officePdf(file: File, preferences: Preferences) {
  const type = getKind(file.name, file.type);
  const options = { letter: preferences.paper === "Letter", margin: preferences.margin === "narrow" ? 28 : 52, size: preferences.textSize, lineHeight: preferences.lineHeight };
  if (type === "word") return richOfficePdf(await readWord(file, file.name), options);
  if (type === "excel") {
    const { sheets } = await readSheets(file, file.name);
    const calculate = await formulaEvaluator(sheets);
    const combined = await PDFDocument.create();
    for (const sheet of sheets) {
      const occupied = Object.entries(sheet.cells).filter(([, cell]) => cell.value !== "").map(([key]) => key.split(":").map(Number));
      const rows = [...new Set(occupied.map(([row]) => row))].sort((a, b) => a - b);
      const columns = [...new Set(occupied.map(([, column]) => column))].sort((a, b) => a - b);
      if (!rows.length) {
        await appendPdf(combined, pdfOutput("sheet", await textPdf(sheet.name, "", options)).blob);
        continue;
      }
      for (let columnStart = 0; columnStart < columns.length; columnStart += 7) {
        const group = columns.slice(columnStart, columnStart + 7);
        const wrapper = document.createElement("div");
        const title = document.createElement("h2");
        title.textContent = sheet.name;
        wrapper.append(title);
        const table = document.createElement("table");
        const header = table.insertRow();
        for (const label of ["#", ...group.map(columnName)]) {
          const cell = document.createElement("th");
          cell.textContent = label;
          header.append(cell);
        }
        for (const rowNumber of rows) {
          const row = table.insertRow();
          row.insertCell().textContent = String(rowNumber);
          for (const column of group) {
            const original = sheet.cells[cellKey(rowNumber, column)];
            const cell = document.createElement(original?.bold ? "th" : "td");
            if (original?.fill) cell.dataset.fill = original.fill;
            cell.textContent = displaySheetValue(calculate(sheet.name, rowNumber, column), original?.format, preferences.currency);
            row.append(cell);
          }
        }
        wrapper.append(table);
        await appendPdf(combined, pdfOutput("sheet", await richOfficePdf(wrapper.innerHTML, { ...options, size: 10, gridlines: preferences.gridlines })).blob);
      }
    }
    return combined.save();
  }
  if (type === "slides") {
    const document = await PDFDocument.create();
    for (const slide of await readSlides(file)) {
      const canvas = await renderSlide(slide);
      const image = await document.embedPng(await (await imageBlob(canvas, "image/png")).arrayBuffer());
      const width = slide.width * .75;
      const height = slide.height * .75;
      document.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    }
    if (!document.getPageCount()) throw new Error("Tidak ada slide dalam berkas ini.");
    return document.save();
  }
  throw new Error("Format Office tidak didukung.");
}

export async function richOfficePdf(html: string, options: { letter?: boolean; margin?: number; size?: number; lineHeight?: number; gridlines?: boolean } = {}) {
  const source = new DOMParser().parseFromString(html, "text/html").body;
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [width, height] = options.letter ? [612, 792] : a4;
  const margin = options.margin ?? 48;
  let page = doc.addPage([width, height]);
  let y = height - margin;
  function room(space: number) {
    if (y - space < margin) { page = doc.addPage([width, height]); y = height - margin; }
  }
  for (const block of Array.from(source.childNodes)) {
    const element = block instanceof HTMLElement ? block : undefined;
    const tag = element?.tagName ?? "P";
    const size = /^H[1-4]$/.test(tag) ? 22 - Number(tag[1]) * 2 : options.size ?? 11;
    const font = /^H[1-4]$/.test(tag) || element?.querySelector("b,strong") ? bold : normal;
    const align = element?.style.textAlign || element?.getAttribute("align") || "left";
    if (block instanceof HTMLTableElement) {
      const cells = Math.max(1, ...Array.from(block.rows).map((row) => row.cells.length));
      const cellWidth = (width - margin * 2) / cells;
      const rowFont = Math.min(11, size);
      for (const row of Array.from(block.rows)) {
        const entries = Array.from(row.cells).map((cell) => {
          const font = cell.tagName === "TH" ? bold : normal;
          const value = cell.dataset.fill;
          const fill = /^#[\da-f]{6}$/i.test(value ?? "") ? Number.parseInt(value!.slice(1), 16) : undefined;
          return { font, fill, lines: wrapText(pdfString(cell.textContent ?? "", font), font, rowFont, Math.max(8, cellWidth - 10)) };
        });
        const rowHeight = Math.min(height - margin * 2, Math.max(23, ...entries.map(({ lines }) => lines.length * 13 + 8)));
        room(rowHeight);
        for (let index = 0; index < entries.length; index++) {
          const x = margin + index * cellWidth;
          const { fill, font, lines } = entries[index];
          const color = fill === undefined ? undefined : rgb((fill >> 16) / 255, (fill >> 8 & 255) / 255, (fill & 255) / 255);
          if (color || options.gridlines !== false) page.drawRectangle({ x, y: y - rowHeight, width: cellWidth, height: rowHeight,
            color, borderColor: rgb(.73, .75, .79), borderWidth: options.gridlines === false ? 0 : .5 });
          const ink = color && .2126 * color.red + .7152 * color.green + .0722 * color.blue < .45 ? rgb(1, 1, 1) : rgb(.08, .08, .08);
          lines.slice(0, Math.floor((rowHeight - 7) / 13)).forEach((line, i) => page.drawText(line, { x: x + 5, y: y - 12 - i * 13, size: rowFont, font, color: ink }));
        }
        y -= rowHeight;
      }
    } else {
      let body = block.textContent ?? "";
      if (element) {
        const copy = element.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
        copy.querySelectorAll("li").forEach((item) => { item.prepend("• "); item.append("\n"); });
        body = copy.textContent ?? "";
      }
      for (const paragraph of body.split("\n")) {
        for (const line of wrapText(pdfString(paragraph, font), font, size, width - 2 * margin)) {
          const step = size * (options.lineHeight ?? 1.45);
          room(step);
          const measured = font.widthOfTextAtSize(line, size);
          const x = align === "center" ? (width - measured) / 2 : align === "right" ? width - margin - measured : margin;
          y -= size;
          if (line) page.drawText(line, { x, y, size, font });
          y -= step - size;
        }
      }
      const images = element instanceof HTMLImageElement ? [element] : Array.from(element?.querySelectorAll("img") ?? []);
      for (const image of images) {
        const url = image.getAttribute("src") ?? "";
        if (!/^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i.test(url)) continue;
        const canvas = await loadImage(await (await fetch(url)).blob(), 1500);
        const jpeg = await doc.embedJpg(await (await imageBlob(canvas)).arrayBuffer());
        const box = jpeg.scaleToFit(width - 2 * margin, Math.min(height - 2 * margin - 5, 440));
        room(box.height);
        page.drawImage(jpeg, { x: margin, y: y - box.height, ...box });
        y -= box.height;
      }
    }
    y -= 5;
  }
  return doc.save();
}

async function idPhoto(file: File, format: string, color: string) {
  const [cmWidth, cmHeight] = format.split("x").map(Number);
  const source = await loadImage(file);
  const canvas = canvasOf(cmWidth * 110, cmHeight * 110);
  const ctx = context(canvas);
  const ratio = Math.max(canvas.width / source.width, canvas.height / source.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, (canvas.width - source.width * ratio) / 2, (canvas.height - source.height * ratio) / 2, source.width * ratio, source.height * ratio);
  if (color !== "#ffffff") {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const channels = color.match(/[0-9a-f]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [255, 255, 255];
    for (let i = 0; i < pixels.data.length; i += 4) {
      const values = pixels.data.subarray(i, i + 3);
      if (Math.min(...values) > 218 && Math.max(...values) - Math.min(...values) < 26) pixels.data.set(channels, i);
    }
    ctx.putImageData(pixels, 0, 0);
  }
  const photo = await imageBlob(canvas);
  const doc = await PDFDocument.create();
  const image = await doc.embedJpg(await photo.arrayBuffer());
  const page = doc.addPage([...a4]);
  const width = cmWidth * 72 / 2.54;
  const height = cmHeight * 72 / 2.54;
  for (let y = a4[1] - 30 - height; y > 28; y -= height + 10) {
    for (let x = 30; x + width < a4[0] - 29; x += width + 10) {
      page.drawImage(image, { x, y, width, height });
      page.drawRectangle({ x, y, width, height, borderWidth: .4, borderColor: rgb(.35, .35, .35) });
    }
  }
  return [pdfOutput("Pasfoto-" + format, await doc.save()), { name: "Pasfoto-" + format + ".jpg", blob: photo }];
}

async function chart(file: File, title: string, chartType: string) {
  const { sheets } = await readSheets(file, file.name);
  const first = sheets[0];
  const calculate = await formulaEvaluator(sheets);
  const rows: { name: string; amount: number }[] = [];
  for (let index = 1; index <= first.rows && rows.length < 24; index++) {
    const name = calculate(first.name, index, 1);
    const amount = calculate(first.name, index, 2);
    if (name != null && typeof amount === "number" && Number.isFinite(amount)) rows.push({ name: String(name), amount });
  }
  if (!rows.length) throw new Error("Gunakan label di kolom A dan angka di kolom B.");
  const canvas = canvasOf(1050, 660);
  const ctx = context(canvas);
  const colors = ["#1652f6", "#009989", "#f97316", "#a855f7", "#db2777", "#6b7280"];
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#142548"; ctx.font = "bold 28px sans-serif"; ctx.fillText(title || "Grafik " + baseName(file.name), 40, 52, 960);
  if (chartType === "pie") {
    const total = rows.reduce((sum, row) => sum + Math.max(row.amount, 0), 0);
    if (!total) throw new Error("Grafik lingkaran memerlukan nilai positif.");
    let start = -Math.PI / 2;
    rows.forEach(({ name, amount }, index) => {
      const angle = Math.max(0, amount) / total * Math.PI * 2;
      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath(); ctx.moveTo(340, 334); ctx.arc(340, 334, 225, start, start + angle); ctx.closePath(); ctx.fill();
      start += angle;
      ctx.fillRect(650, 99 + index * 22, 13, 13);
      ctx.fillStyle = "#142548"; ctx.font = "15px sans-serif"; ctx.fillText(name + " · " + amount, 676, 110 + index * 22, 330);
    });
  } else {
    const max = Math.max(1, ...rows.map((row) => row.amount));
    const min = Math.min(0, ...rows.map((row) => row.amount));
    const position = (value: number) => 550 - (value - min) / (max - min) * 435;
    const step = 930 / rows.length;
    ctx.strokeStyle = "#9daac7";
    ctx.beginPath(); ctx.moveTo(74, position(0)); ctx.lineTo(1004, position(0)); ctx.stroke();
    ctx.font = "14px sans-serif";
    if (chartType === "line") {
      ctx.beginPath(); ctx.strokeStyle = colors[0]; ctx.lineWidth = 4;
      rows.forEach((row, index) => ctx.lineTo(74 + (index + .5) * step, position(row.amount))); ctx.stroke();
    }
    rows.forEach((row, index) => {
      const x = 74 + index * step;
      const y = position(row.amount);
      ctx.fillStyle = colors[index % colors.length];
      if (chartType === "line") { ctx.beginPath(); ctx.arc(x + step / 2, y, 6, 0, 2 * Math.PI); ctx.fill(); }
      else ctx.fillRect(x + step * .18, Math.min(y, position(0)), step * .64, Math.max(1, Math.abs(y - position(0))));
      ctx.fillStyle = "#142548"; ctx.textAlign = "center"; ctx.fillText(row.name, x + step / 2, 585, step - 4);
      ctx.fillText(String(row.amount), x + step / 2, y + (row.amount < 0 ? 15 : -8));
    });
  }
  return { name: baseName(file.name) + "-grafik.png", blob: await imageBlob(canvas, "image/png") };
}

function tableRows(words: ReturnType<typeof ocrWords>) {
  const height = words.map(({ bbox }) => bbox.y1 - bbox.y0).sort((a, b) => a - b);
  const typical = height[Math.floor(height.length / 2)] || 12;
  const sorted = [...words].sort((a, b) => a.bbox.y1 - b.bbox.y1);
  const lines: { baseline: number; words: ReturnType<typeof ocrWords> }[] = [];
  for (const word of sorted) {
    const last = lines.at(-1);
    if (last && Math.abs(last.baseline - word.bbox.y1) < typical * .53) last.words.push(word);
    else lines.push({ baseline: word.bbox.y1, words: [word] });
  }
  return lines.map((line) => {
    const columns: string[] = [];
    let right = -Infinity;
    for (const word of line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
      if (word.bbox.x0 - right > typical * 1.05) columns.push(word.text);
      else columns[columns.length - 1] += " " + word.text;
      right = word.bbox.x1;
    }
    return columns;
  });
}

export async function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.title = "Pratinjau cetak";
  frame.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;right:0;border:0;opacity:0";
  frame.src = url;
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
    catch { window.open(url, "_blank", "noopener"); }
  };
  document.body.append(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 5 * 60_000);
}

export async function runTool(id: string, files: File[], values: ToolValues, preferences: Preferences, progress?: (text: string) => void, signature?: Blob): Promise<ToolResult> {
  if (id !== "share" && id !== "export" && await findProtectedDocument(files)) throw new Error(protectedDocumentMessage);
  const first = files[0];
  const stem = first ? baseName(first.name) : "";
  const text = (key: string, fallback = "") => typeof values[key] === "string" ? String(values[key]).trim() : fallback;
  const number = (key: string, fallback: number) => {
    const value = Number(text(key, String(fallback)));
    return text(key) && Number.isFinite(value) ? value : fallback;
  };
  const out = (...outputs: Output[]) => ({ outputs });
  const pdf = (name: string, bytes: Uint8Array | ArrayBuffer) => out(pdfOutput(name, bytes));
  const title = text("title");

  if (id === "note") return pdf(title || "Catatan", await textPdf(title, text("body")));
  if (id === "share") return { text: await shareFile(first, first.name) ? "Berkas dibagikan." : "Berkas diunduh dan siap dibagikan." };
  if (id === "export") { download(first, first.name); return { text: "Unduhan dimulai." }; }
  if (id === "print") { await printPdf(first); return { text: "Dialog cetak dibuka." }; }
  if (id === "image-pdf") return pdf("Gambar-gabungan", await imagesPdf(files));
  if (id === "batch-pdf") {
    const results: Output[] = [];
    for (const file of files) results.push(pdfOutput(baseName(file.name) + "-foto", await imagesPdf([file])));
    return out(...results);
  }
  if (id === "merge" || id === "merge-any") {
    if (files.length < 2) throw new Error("Pilih minimal dua berkas.");
    const doc = await PDFDocument.create();
    for (const file of files) {
      const kind = getKind(file.name, file.type);
      if (kind === "pdf") await appendPdf(doc, file);
      else if (id === "merge-any" && kind === "image") await appendImage(doc, file);
      else if (id === "merge-any") await appendPdf(doc, pdfOutput("temporary", await officePdf(file, preferences)).blob);
      else throw new Error("Pilih hanya berkas PDF.");
    }
    return pdf("PDF-gabungan", await doc.save());
  }
  if (id === "office-pdf") return pdf(stem, await officePdf(first, preferences));
  if (id === "pdf-word") return out(text("layout", "editable") === "visual" ? await visualPdfWord(first, stem) :
    await writeWord(textHtml((await readPdfText(first)).join("\n\n")), stem, preferences, true));
  if (id === "exe-pdf") {
    const bytes = new Uint8Array(await first.arrayBuffer());
    const view = new DataView(bytes.buffer);
    if (bytes.length < 64 || view.getUint16(0, false) !== 0x4d5a) throw new Error("Berkas ini bukan program Windows.");
    const all = new TextDecoder("latin1").decode(bytes);
    const start = all.indexOf("%PDF-");
    const end = all.lastIndexOf("%%EOF");
    if (start < 0 || end < start) throw new Error("PDF polos tidak ditemukan dalam berkas EXE.");
    const extracted = bytes.slice(start, end + 5);
    await PDFDocument.load(extracted);
    return pdf(stem, extracted);
  }
  if (id === "compress") {
    const result = await compressPdf(first, number("target", 500) * 1024, Boolean(values.raster), progress);
    return { outputs: [result], text: result.blob.size <= number("target", 500) * 1024 ? "Ukuran target tercapai." : "Batas ukuran belum tercapai. Hasil terkecil tersedia." };
  }
  if (["pdf-jpg", "extract-images", "searchable", "blank"].includes(id)) return out(...await renderOutputs(first, id as Parameters<typeof renderOutputs>[1], progress));
  if (id === "protect" || id === "unlock") {
    if (id === "protect") {
      const password = String(values.password ?? "");
      if (password.length < 8) throw new Error("Gunakan kata sandi minimal 8 karakter.");
      const owner = crypto.randomUUID();
      const permissions = values.restrict ? ["--print=none", "--modify=none", "--extract=n"] : [];
      return pdf(stem + "-terlindungi", await qpdf(first, ["--encrypt", password, owner, "256", ...permissions, "--"]));
    }
    const password = String(values.password ?? "");
    if (!password) throw new Error("Masukkan kata sandi pembuka.");
    return pdf(stem + "-dibuka", await qpdf(first, ["--password=" + password, "--decrypt"]));
  }
  if (["split", "watermark", "number", "sign"].includes(id)) {
    let doc = await PDFDocument.load(await first.arrayBuffer());
    if (id === "split") {
      const order = text("pages") ? selectPages(text("pages"), doc.getPageCount()) : doc.getPageIndices();
      const next = await PDFDocument.create();
      for (const page of await next.copyPages(doc, order)) next.addPage(page);
      doc = next;
    }
    if (id === "watermark" || id === "number") {
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();
      pages.forEach((page, index) => {
        const frame = pageSpace(page);
        const { width, height, point, rotation } = frame;
        const ink = rgb(.2, .27, .42);
        if (id === "number") {
          if (index === 0 && values.skipCover) return;
          const pageNumber = index + 1;
          const label = text("sequence") === "number" ? String(pageNumber) : text("sequence") === "page"
            ? "Halaman " + pageNumber : "Hal. " + pageNumber + " dari " + pages.length;
          const size = 10;
          const length = font.widthOfTextAtSize(label, size);
          const margin = Math.min(28, width / 10);
          const position = text("position");
          const x = position === "left" ? margin : position === "right" ? width - margin - length : (width - length) / 2;
          page.drawText(label, { ...point(x, height - 24), size, font, rotate: degrees(rotation), color: ink });
          if (title) page.drawText(pdfString(title, font), {
            ...point(margin, 24), size, font, rotate: degrees(rotation), maxWidth: width - margin * 2,
          });
          return;
        }

        const label = pdfString(text("body"), font);
        const arrangement = text("placement", "diagonal");
        const tint = text("watermarkColor");
        const color = tint === "red" ? rgb(.75, .12, .15) : tint === "blue" ? rgb(.12, .32, .73) : ink;
        const diagonal = arrangement === "diagonal";
        const unit = Math.max(1, font.widthOfTextAtSize(label, 1));
        const size = Math.min(arrangement === "footer" ? 16 : 52, width * .72 / unit, diagonal ? height / unit : Infinity);
        const length = font.widthOfTextAtSize(label, size);
        const left = (width - length * (diagonal ? Math.cos(31 * Math.PI / 180) : 1)) / 2;
        const baseline = arrangement === "footer" ? height - 26 : height * .52 + (diagonal ? length * Math.sin(31 * Math.PI / 180) / 2 : 0);
        page.drawText(label, {
          ...point(left, baseline),
          size, font, rotate: degrees(rotation + (diagonal ? 31 : 0)), opacity: number("opacity", 25) / 100, color,
        });
      });
    }
    if (id === "sign") {
      if (!signature) throw new Error("Gambar atau pilih tanda tangan terlebih dahulu.");
      const canvas = await signatureImage(signature, text("ink"));
      const stamp = await doc.embedPng(await (await imageBlob(canvas, "image/png")).arrayBuffer());
      const [pageIndex] = selectPages(String(number("page", 1)), doc.getPageCount());
      const page = doc.getPage(pageIndex);
      const frame = pageSpace(page);
      const angle = number("angle", 0);
      const { width, height, bottomLeft } = stampPlacement(frame, stamp.width / stamp.height,
        number("scale", 24), number("x", 65), number("y", 80), angle);
      page.drawImage(stamp, { ...frame.point(bottomLeft.x, bottomLeft.y), width, height, rotate: degrees(frame.rotation - angle) });
    }
    return pdf(stem + "-" + id, await doc.save());
  }
  if (["image-compress", "transparent", "deshadow", "batch-watermark"].includes(id)) return out(...await changeImages(files, id, text("body"), number("quality", 75) / 100));
  if (id === "id-photo") return out(...await idPhoto(first, text("format", "3x4"), text("color", "#ffffff")));
  if (id === "chart") return out(await chart(first, title, text("format", "bar")));
  if (["ocr", "business-card", "table-excel", "receipt"].includes(id)) {
    const canvas = await loadImage(first);
    const page = await withOcr(async (worker) => (await worker.recognize(canvas, {}, { blocks: id === "table-excel" })).data, progress);
    const recognized = safeText(page.text.trim());
    if (!recognized) throw new Error("Belum ada teks yang dikenali. Coba foto dengan cahaya lebih baik.");
    if (id === "ocr") return { text: recognized, outputs: [textOutput(stem + "-teks.txt", recognized)] };
    if (id === "business-card") {
      const escape = (value: string) => value.replace(/[\\,;]/g, (char) => "\\" + char).replace(/\r?\n/g, "\\n");
      const contact = recognized.split("\n").find((line) => line.trim()) ?? "Kontak";
      const email = recognized.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
      const phone = recognized.match(/(?:\+?\d[\d .()-]{6,}\d)/)?.[0]?.replace(/[ .()-]/g, "") ?? "";
      return { text: recognized, outputs: [textOutput(stem + ".vcf", ["BEGIN:VCARD", "VERSION:3.0", "FN:" + escape(contact), "TEL:" + escape(phone), "EMAIL:" + escape(email), "END:VCARD"].join("\r\n"), "text/vcard")] };
    }
    const visualRows = id === "table-excel" ? tableRows(ocrWords(page)).map((row) => row.map(safeText)) : [];
    const rows = visualRows.length ? visualRows : recognized.split("\n").filter(Boolean).map((line) => {
      if (id === "receipt") {
        const amount = line.match(/(\d[\d.,]*)\s*$/);
        return amount ? [line.slice(0, amount.index).trim(), amount[1]] : [line, ""];
      }
      return line.trim().split(/\s{2,}|\t|\|/);
    });
    if (id === "receipt") rows.unshift(["Keterangan", "Nominal"]);
    return { text: recognized, outputs: [await writeSheets([sheetFromRows(rows, "OCR", true)], stem + "-ocr")] };
  }
  if (id === "summary" || id === "voice") {
    const source = await extractText(first);
    if (!source.trim()) throw new Error("Tidak ada teks. Gunakan alat OCR jika berkas berisi hasil scan.");
    if (id === "voice") return { text: source };
    const sentences = source.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter((line) => line.length >= 35);
    const frequency = new Map<string, number>();
    const words = (line: string) => line.toLowerCase().match(/[\p{L}]{5,}/gu) ?? [];
    for (const sentence of sentences) for (const word of words(sentence)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
    const pick = sentences.map((sentence, index) => ({ sentence, index, weight: words(sentence).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) / Math.max(5, words(sentence).length) }))
      .sort((a, b) => b.weight - a.weight).slice(0, number("count", 5)).sort((a, b) => a.index - b.index);
    const summary = pick.length ? pick.map(({ sentence }, index) => (index + 1) + ". " + sentence).join("\n\n") : source.slice(0, 1000);
    return { text: summary, outputs: [pdfOutput(stem + "-ringkasan", await textPdf("Ringkasan " + stem, summary))] };
  }
  if (id === "qr") {
    if (text("action", "generate") === "scan") {
      if (!first) throw new Error("Pilih foto yang berisi QR atau barcode.");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const url = URL.createObjectURL(first);
      try {
        const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
        return { text: result.getText() };
      } catch { throw new Error("Kode tidak ditemukan dalam foto ini."); }
      finally { URL.revokeObjectURL(url); }
    }
    const { default: QRCode } = await import("qrcode");
    const canvas = canvasOf(480, 480);
    await QRCode.toCanvas(canvas, text("body"), { width: 480, margin: 3, errorCorrectionLevel: "M" });
    return out({ name: "QR-Depup.png", blob: await imageBlob(canvas, "image/png") });
  }
  if (id === "barcode") {
    const { default: barcode } = await import("jsbarcode");
    const canvas = canvasOf(500, 280);
    const symbol = canvasOf(400, 120);
    try { barcode(symbol, text("code"), { format: "CODE128", margin: 8, height: 65, width: 2 }); }
    catch { throw new Error("Masukkan nilai barcode Code 128 yang valid."); }
    const ctx = context(canvas);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 500, 280);
    ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.font = "bold 24px sans-serif"; ctx.fillText(title, 250, 37, 450);
    ctx.font = "bold 36px sans-serif"; ctx.fillText(formatMoney(number("price", 0)), 250, 83, 450);
    ctx.drawImage(symbol, 25, 105, 450, 143);
    const png = await imageBlob(canvas, "image/png");
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(await png.arrayBuffer());
    const page = doc.addPage([...a4]);
    for (let y = 716; y >= 32; y -= 102) for (let x = 32; x <= 325; x += 176) {
      page.drawImage(image, { x, y, width: 167, height: 94 });
      page.drawRectangle({ x, y, width: 167, height: 94, borderWidth: .45, borderColor: rgb(.8, .81, .83) });
    }
    return out({ name: "Label-harga.png", blob: png }, pdfOutput("Label-harga-A4", await doc.save()));
  }
  if (id === "invoice") {
    const lines = text("body").split("\n").filter((line) => line.trim()).map((line) => {
      const [name, count, price] = line.split("|").map((part) => part.trim());
      if (!name || !count || !price || !Number.isFinite(Number(count)) || !Number.isFinite(Number(price)) || Number(count) <= 0 || Number(price) < 0) throw new Error("Gunakan format Barang | Jumlah | Harga untuk setiap baris.");
      return { name, count: Number(count), price: Number(price) };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.count * line.price, 0);
    const discount = Math.min(subtotal, number("discount", 0));
    const linesText = lines.map((line) => line.name + "   × " + line.count + "    " + formatMoney(line.price) + "    " + formatMoney(line.count * line.price)).join("\n");
    const printable = pdfOutput(title || "Nota", await textPdf(title || "Nota", "Pelanggan: " + text("customer") + "\nTanggal: " + text("date") + "\n\n" + linesText + "\n\nSubtotal: " + formatMoney(subtotal) + "\nPotongan: " + formatMoney(discount) + "\nTotal: " + formatMoney(subtotal - discount)));
    if (!first) return out(printable);
    const doc = await PDFDocument.load(await printable.blob.arrayBuffer());
    const logo = await doc.embedPng(await (await imageBlob(await loadImage(first), "image/png")).arrayBuffer());
    const box = logo.scaleToFit(90, 45);
    doc.getPage(0).drawImage(logo, { x: a4[0] - box.width - 46, y: a4[1] - box.height - 30, ...box });
    return pdf(title || "Nota", await doc.save());
  }
  if (id === "planner") {
    const lines = text("body").split("\n").filter((row) => row.trim()).map((row) => row.split("|").map((part) => part.trim()));
    const spreadsheet = await writeSheets([sheetFromRows([["Tanggal", "Waktu", "Agenda", "Status"], ...lines], "Agenda", true)], title || "Agenda");
    return out(spreadsheet, pdfOutput(title || "Agenda", await textPdf(title || "Agenda", lines.map((line) => line.join("    |    ")).join("\n"))));
  }
  if (id === "catalog") {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const details = text("body").split("\n").filter(Boolean);
    for (let i = 0; i < files.length; i++) {
      const canvas = await loadImage(files[i], 1400);
      const image = await document.embedJpg(await (await imageBlob(canvas)).arrayBuffer());
      const page = document.addPage([...a4]);
      page.drawText(pdfString(title || "Katalog", bold), { x: 44, y: 773, size: 22, font: bold });
      const box = image.scaleToFit(500, 460);
      page.drawImage(image, { x: (a4[0] - box.width) / 2, y: 741 - box.height, ...box });
      let y = 716 - box.height;
      for (const line of wrapText(pdfString(details[i] || baseName(files[i].name), font), font, 14, 503).slice(0, 12)) {
        page.drawText(line, { x: 44, y, font, size: 14 });
        y -= 21;
      }
    }
    return pdf(title || "Katalog", await document.save());
  }
  throw new Error("Alat ini tidak dikenali.");
}
