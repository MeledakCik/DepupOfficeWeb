import type { IParagraphOptions, Paragraph, Table, TextRun, ImageRun } from "docx";
import type { CellValue, Workbook } from "exceljs";
import { extension, getKind } from "./catalog";
import { imageBlob, loadImage, recognize, withOcr } from "./imaging";
import { readSlides } from "./slides";
import type { Output, Preferences } from "./workspace";

export const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const xlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function safeText(text: string) {
  return text.replace(/[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/g, "");
}

export function textHtml(text: string) {
  const items = text.split(/\r?\n/);
  return items.map((item) => "<p>" + (item.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? "") || "<br>") + "</p>").join("");
}

export async function sanitizeHtml(html: string) {
  const { default: purify } = await import("dompurify");
  const safeFragment = purify.sanitize(html, {
    ALLOWED_TAGS: ["p", "div", "br", "h1", "h2", "h3", "h4", "b", "strong", "i", "em", "u", "s", "strike", "span", "font", "blockquote", "ol", "ul", "li", "hr", "table", "thead", "tbody", "tr", "td", "th", "img", "a"],
    ALLOWED_ATTR: ["src", "alt", "style", "align", "color", "size", "face", "colspan", "rowspan"],
    RETURN_DOM_FRAGMENT: true,
  });
  const styles = ["textAlign", "fontWeight", "fontStyle", "textDecoration", "color", "fontSize", "fontFamily", "backgroundColor"] as const;
  for (const element of safeFragment.querySelectorAll<HTMLElement>("[style]")) {
    const original = styles.map((property) => element.style[property]);
    element.removeAttribute("style");
    styles.forEach((property, index) => { if (original[index]) element.style[property] = original[index]; });
  }
  for (const image of safeFragment.querySelectorAll("img")) if (!/^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i.test(image.getAttribute("src") ?? "")) image.remove();
  const root = document.createElement("div");
  root.append(safeFragment);
  return root.innerHTML;
}

export async function readWord(blob: Blob, name: string) {
  if (["txt", "md"].includes(extension(name))) return textHtml(safeText(await blob.text()));
  if (extension(name) === "doc") throw new Error("Format Word .doc lama perlu dikonversi ke .docx terlebih dahulu.");
  const { default: mammoth } = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  return sanitizeHtml(result.value);
}

export async function writeWord(html: string, name: string, preferences: Preferences, plain = false): Promise<Output> {
  const docx = await import("docx");
  const root = new DOMParser().parseFromString(await sanitizeHtml(html), "text/html").body;
  const nodes: (Paragraph | Table)[] = [];
  type RunStyle = { bold?: boolean; italics?: boolean; underline?: object; strike?: boolean; color?: string; size?: number; font?: string; highlight?: "yellow" };
  async function runs(node: Node, style: RunStyle = {}): Promise<(TextRun | ImageRun)[]> {
    if (node.nodeType === Node.TEXT_NODE) return [new docx.TextRun({ text: safeText(node.textContent ?? ""), ...style })];
    if (!(node instanceof HTMLElement)) return [];
    const tag = node.tagName;
    if (tag === "BR") return [new docx.TextRun({ break: 1 })];
    if (node instanceof HTMLImageElement) {
      const file = await (await fetch(node.src)).blob();
      const canvas = await loadImage(file, 1000);
      const jpeg = await imageBlob(canvas);
      const width = Math.min(canvas.width, 480);
      return [new docx.ImageRun({ type: "jpg", data: await jpeg.arrayBuffer(), transformation: { width, height: width / canvas.width * canvas.height } })];
    }
    const colorInput = node.style.color || node.getAttribute("color") || "";
    const rgb = colorInput.match(/\d+/g)?.map((part) => Number(part).toString(16).padStart(2, "0")).slice(0, 3).join("");
    const color = colorInput.startsWith("#") && colorInput.length === 7 ? colorInput.slice(1) : rgb?.length === 6 ? rgb : style.color;
    const styleSize = parseFloat(node.style.fontSize);
    const size = Number.isFinite(styleSize) ? Math.round(styleSize * (node.style.fontSize.endsWith("pt") ? 2 : 1.5)) : style.size;
    const next: RunStyle = {
      ...style, color, size, font: node.style.fontFamily || node.getAttribute("face") || style.font,
      bold: style.bold || ["B", "STRONG", "TH"].includes(tag) || ["bold", "700"].includes(node.style.fontWeight),
      italics: style.italics || ["I", "EM"].includes(tag) || node.style.fontStyle === "italic",
      underline: tag === "U" || node.style.textDecoration.includes("underline") ? {} : style.underline,
      strike: style.strike || ["S", "STRIKE"].includes(tag),
      highlight: node.style.backgroundColor ? "yellow" : style.highlight,
    };
    const list: (TextRun | ImageRun)[] = [];
    for (const child of Array.from(node.childNodes)) list.push(...await runs(child, next));
    return list;
  }
  async function paragraph(node: Node, prefix = "") {
    const element = node instanceof HTMLElement ? node : undefined;
    const tag = element?.tagName ?? "";
    const levels = { H1: docx.HeadingLevel.HEADING_1, H2: docx.HeadingLevel.HEADING_2, H3: docx.HeadingLevel.HEADING_3, H4: docx.HeadingLevel.HEADING_4 };
    const aligned = element?.style.textAlign || element?.getAttribute("align") || "";
    const alignment = ({ left: docx.AlignmentType.LEFT, center: docx.AlignmentType.CENTER, right: docx.AlignmentType.RIGHT, justify: docx.AlignmentType.JUSTIFIED })[aligned];
    const fields: IParagraphOptions = {
      alignment, heading: plain ? undefined : levels[tag as keyof typeof levels],
      spacing: { after: 70, line: Math.round(preferences.lineHeight * 240) },
      children: [...(prefix ? [new docx.TextRun(prefix)] : []), ...await runs(node)],
    };
    return new docx.Paragraph(fields);
  }
  for (const node of Array.from(root.childNodes)) {
    if (node instanceof HTMLTableElement) {
      const rows = [];
      for (const row of Array.from(node.rows)) {
        const cells = [];
        for (const cell of Array.from(row.cells)) cells.push(new docx.TableCell({ columnSpan: cell.colSpan, rowSpan: cell.rowSpan, children: [await paragraph(cell)] }));
        if (cells.length) rows.push(new docx.TableRow({ children: cells }));
      }
      if (rows.length) nodes.push(new docx.Table({ rows, width: { size: 100, type: docx.WidthType.PERCENTAGE } }));
    } else if (node instanceof HTMLOListElement || node instanceof HTMLUListElement) {
      let i = 0;
      for (const item of Array.from(node.children)) nodes.push(await paragraph(item, node.tagName === "OL" ? (++i) + ". " : "• "));
    } else if (node.textContent?.trim() || node instanceof HTMLElement) nodes.push(await paragraph(node));
  }
  const margin = preferences.margin === "narrow" ? 720 : 1440;
  const [width, height] = preferences.paper === "Letter" ? [12240, 15840] : [11906, 16838];
  const document = new docx.Document({
    creator: "Depup Office",
    styles: { default: { document: { run: { size: preferences.textSize * 2, font: "Arial" } } } },
    sections: [{
      properties: { page: { size: { width, height }, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
      children: nodes.length ? nodes : [new docx.Paragraph("")],
    }],
  });
  return { name: name + ".docx", blob: await docx.Packer.toBlob(document) };
}

export async function visualPdfWord(file: File, name: string) {
  const pdf = await import("./pdf");
  const source = await pdf.readPdf(file);
  const docx = await import("docx");
  try {
    const sections = [];
    for (let i = 1; i <= source.numPages; i++) {
      const page = await source.getPage(i);
      const canvas = await pdf.pdfCanvas(page, 1500);
      const blob = await imageBlob(canvas);
      const shape = page.getViewport({ scale: 1 });
      sections.push({
        properties: { page: { size: { width: shape.width * 20, height: shape.height * 20 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
        children: [new docx.Paragraph({ spacing: { after: 0 }, children: [
          new docx.ImageRun({ data: await blob.arrayBuffer(), type: "jpg", transformation: { width: shape.width * 96 / 72 - 3, height: shape.height * 96 / 72 - 4 } }),
        ] })],
      });
      page.cleanup();
    }
    return { name: name + ".docx", blob: await docx.Packer.toBlob(new docx.Document({ sections })) };
  } finally { await source.destroy(); }
}

export async function scannedWord(images: Blob[], name: string, mode: "text" | "photo", preferences: Preferences, progress: (message: string) => void): Promise<Output> {
  if (mode === "text") {
    const pages = await withOcr(async (worker) => {
      const lines: string[] = [];
      for (const image of images) lines.push(safeText((await worker.recognize(image)).data.text).trim());
      return lines;
    }, progress);
    if (!pages.some(Boolean)) throw new Error("OCR tidak menemukan teks. Pilih Foto per halaman untuk menyimpan hasil ini ke Word.");
    return writeWord(textHtml(pages.join("\n\n")), name, preferences, true);
  }

  const docx = await import("docx");
  const [width, height] = preferences.paper === "Letter" ? [12240, 15840] : [11906, 16838];
  const margin = preferences.margin === "narrow" ? 720 : 1440;
  const sections = [];
  for (const [index, image] of images.entries()) {
    progress("Menyiapkan halaman " + (index + 1) + " dari " + images.length + "…");
    const canvas = await loadImage(image, 1600);
    const scale = Math.min((width - 2 * margin) / 15 / canvas.width, (height - 2 * margin - 360) / 15 / canvas.height);
    sections.push({
      properties: { page: { size: { width, height }, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
      children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [
        new docx.ImageRun({ type: "jpg", data: await image.arrayBuffer(), transformation: {
          width: Math.floor(canvas.width * scale), height: Math.floor(canvas.height * scale),
        } }),
      ] })],
    });
  }
  return { name: name + ".docx", blob: await docx.Packer.toBlob(new docx.Document({ creator: "Depup Office", sections })) };
}

export type SheetCell = { value: string; bold?: boolean; italic?: boolean; format?: string; fill?: string };
export type SheetData = { id?: number; name: string; rows: number; columns: number; cells: Record<string, SheetCell> };
export const emptySheet = (name = "Sheet1"): SheetData => ({ name, rows: 16, columns: 8, cells: {} });
export const cellKey = (row: number, column: number) => row + ":" + column;
export function columnName(index: number) {
  let result = "";
  for (let number = index; number > 0; number = Math.floor((number - 1) / 26)) result = String.fromCharCode(65 + (number - 1) % 26) + result;
  return result;
}

function valueOf(value: CellValue): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if ("formula" in value) return "=" + value.formula;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((run) => run.text).join("");
    if ("error" in value) return String(value.error);
    if ("result" in value) return valueOf(value.result);
  }
  return value == null ? "" : String(value);
}

export async function createWorkbook(): Promise<Workbook> {
  const { default: excel } = await import("exceljs");
  return new excel.Workbook();
}

export function readDelimited(input: string, delimiter?: string): string[][] {
  const separator = delimiter ?? (input.split(/\r?\n/, 1)[0]?.includes(";") && !input.split(/\r?\n/, 1)[0]?.includes(",") ? ";" : ",");
  const rows: string[][] = [[]];
  let value = "";
  let quoted = false;
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let offset = 0; offset < text.length; offset++) {
    const char = text[offset];
    if (char === '"') {
      if (quoted && text[offset + 1] === '"') { value += '"'; offset++; }
      else if (quoted || !value) quoted = !quoted;
      else value += char;
    } else if (!quoted && (char === separator || char === "\n")) {
      rows[rows.length - 1].push(value);
      value = "";
      if (char === "\n") rows.push([]);
    } else value += char;
  }
  rows[rows.length - 1].push(value);
  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === "") rows.pop();
  return rows;
}

export function sheetFromRows(rows: (string | number)[][], name = "Sheet1", literal = false) {
  const sheet = emptySheet(name);
  sheet.rows = Math.max(sheet.rows, rows.length);
  rows.forEach((row, y) => {
    sheet.columns = Math.max(sheet.columns, row.length);
    row.forEach((value, x) => {
      if (value === "") return;
      const text = String(value);
      sheet.cells[cellKey(y + 1, x + 1)] = { value: literal && text.startsWith("=") ? "'" + text : text, bold: y === 0 };
    });
  });
  return sheet;
}

export async function readSheets(blob: Blob, name: string) {
  const ext = extension(name);
  if (ext === "csv" || ext === "tsv") return { sheets: [sheetFromRows(readDelimited(await blob.text(), ext === "tsv" ? "\t" : undefined), "Sheet1", true)] };
  if (ext === "xls") {
    const { read, utils } = await import("@e965/xlsx");
    const legacy = read(await blob.arrayBuffer(), { type: "array", cellFormula: true, cellNF: true });
    const sheets = legacy.SheetNames.map((name) => {
      const worksheet = legacy.Sheets[name];
      const sheet = emptySheet(name);
      for (const [address, value] of Object.entries(worksheet)) {
        if (!/^[A-Z]+\d+$/.test(address)) continue;
        const cell = value as { f?: string; v?: unknown; z?: string };
        const { r, c } = utils.decode_cell(address);
        sheet.rows = Math.max(sheet.rows, r + 1);
        sheet.columns = Math.max(sheet.columns, c + 1);
        const text = cell.f ? "=" + cell.f : String(cell.v ?? "");
        sheet.cells[cellKey(r + 1, c + 1)] = { value: !cell.f && text.startsWith("=") ? "'" + text : text, format: cell.z };
      }
      return sheet;
    });
    return { sheets: sheets.length ? sheets : [emptySheet()] };
  }
  const workbook = await createWorkbook();
  await workbook.xlsx.load(await blob.arrayBuffer() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheets = workbook.worksheets.map((worksheet) => {
    const sheet = { ...emptySheet(worksheet.name), id: worksheet.id };
    sheet.rows = Math.max(sheet.rows, worksheet.rowCount);
    sheet.columns = Math.max(sheet.columns, worksheet.columnCount);
    worksheet.eachRow((row, rowNumber) => row.eachCell((cell, columnNumber) => {
      const original = valueOf(cell.value);
      const value = cell.formula ? "=" + cell.formula : original.startsWith("=") ? "'" + original : original;
      const fill = cell.fill?.type === "pattern" ? cell.fill.fgColor?.argb : undefined;
      sheet.cells[cellKey(rowNumber, columnNumber)] = { value, bold: cell.font?.bold, italic: cell.font?.italic, format: cell.numFmt, fill: fill ? "#" + fill.slice(-6) : undefined };
    }));
    return sheet;
  });
  return { sheets: sheets.length ? sheets : [emptySheet()], workbook };
}

export type FormulaValue = string | number | boolean | null;
export function displaySheetValue(value: FormulaValue, format: string | undefined, currency: string) {
  if (typeof value === "number") {
    if (format === "0.00%") return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 2 }).format(value);
    if (format?.includes(currency)) return new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(value);
    return String(Number.isInteger(value) ? value : Number(value.toPrecision(12)));
  }
  return value == null ? "" : String(value);
}

export async function formulaEvaluator(sheets: SheetData[]) {
  const { default: FormulaParser } = await import("fast-formula-parser");
  const visiting = new Set<string>();
  const cached = new Map<string, FormulaValue>();
  type FormulaAddress = { sheet?: string; row: number; col: number };
  const parser = new FormulaParser({
    functions: { WEBSERVICE: () => { throw new Error("Akses jaringan dinonaktifkan."); } },
    onCell: ({ sheet, row, col }: FormulaAddress) => result(sheet ?? sheets[0].name, row, col),
    onRange: ({ sheet, from, to }: { sheet?: string; from: FormulaAddress; to: FormulaAddress }) => {
      const target = sheets.find((item) => item.name === (sheet ?? sheets[0].name));
      if (!target) return [];
      return Array.from({ length: Math.max(0, Math.min(to.row, target.rows, from.row + 2000) - from.row + 1) }, (_, y) =>
        Array.from({ length: Math.max(0, Math.min(to.col, target.columns, from.col + 250) - from.col + 1) }, (_, x) => result(target.name, from.row + y, from.col + x)));
    },
  });
  function result(sheetName: string, row: number, col: number): FormulaValue {
    const key = cellKey(row, col);
    const record = sheets.find((sheet) => sheet.name === sheetName)?.cells[key];
    const value = record?.value ?? "";
    if (!value) return null;
    if (value.startsWith("'")) return value.slice(1);
    if (!value.startsWith("=")) {
      if (/^[+-]?\d+(?:\.\d+)?$/.test(value) && !/^0\d/.test(value)) return Number(value);
      if (value.toUpperCase() === "TRUE") return true;
      if (value.toUpperCase() === "FALSE") return false;
      return value;
    }
    const address = sheetName + "!" + key;
    if (cached.has(address)) return cached.get(address) ?? null;
    if (visiting.has(address) || visiting.size > 150) throw new Error("Referensi melingkar.");
    visiting.add(address);
    try {
      const computed: unknown = parser.parse(value.slice(1), { row, col, sheet: sheetName });
      const final = typeof computed === "number" || typeof computed === "boolean" || typeof computed === "string" ? computed : "#NILAI!";
      cached.set(address, final);
      return final;
    } catch {
      return "#RUMUS!";
    } finally { visiting.delete(address); }
  }
  return result;
}

export async function writeSheets(sheets: SheetData[], name: string, gridlines = true, workbook?: Workbook): Promise<Output> {
  const book = workbook ?? await createWorkbook();
  const calculate = await formulaEvaluator(sheets);
  for (const sheet of sheets) {
    const worksheet = (sheet.id ? book.getWorksheet(sheet.id) : book.getWorksheet(sheet.name)) ?? book.addWorksheet(sheet.name);
    worksheet.name = sheet.name;
    worksheet.views = [{ ...worksheet.views[0], showGridLines: gridlines }];
    for (const [key, entry] of Object.entries(sheet.cells)) {
      const [row, column] = key.split(":").map(Number);
      const cell = worksheet.getCell(row, column);
      if (cell.isMerged && cell.master.address !== cell.address) continue;
      const calculated = calculate(sheet.name, row, column);
      if (entry.value.startsWith("=")) cell.value = { formula: entry.value.slice(1), result: calculated ?? undefined };
      else if (!workbook || valueOf(cell.value) !== entry.value) cell.value = calculated;
      cell.font = { ...cell.font, bold: entry.bold, italic: entry.italic };
      cell.numFmt = entry.format || "General";
      if (entry.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + entry.fill.slice(1).toUpperCase() } };
      if (!workbook && worksheet.getColumn(column).width === undefined) worksheet.getColumn(column).width = 19;
    }
  }
  book.calcProperties.fullCalcOnLoad = true;
  const buffer = await book.xlsx.writeBuffer();
  return { name: name + ".xlsx", blob: new Blob([new Uint8Array(buffer)], { type: xlsxType }) };
}

export async function extractText(file: File) {
  switch (getKind(file.name, file.type)) {
    case "pdf": {
      const { readPdfText } = await import("./pdf");
      return safeText((await readPdfText(file)).join("\n\n"));
    }
    case "image": return recognize(file);
    case "word": return htmlText(await readWord(file, file.name));
    case "excel": {
      const { sheets } = await readSheets(file, file.name);
      return sheets.map((sheet) => Object.values(sheet.cells).map(({ value }) => value).join(" ")).join("\n");
    }
    case "slides": return safeText((await readSlides(file)).map(({ text }) => text).join("\n\n"));
    default: return file.type.startsWith("text/") ? safeText(await file.text()) : "";
  }
}

export function htmlText(html: string) {
  const document = new DOMParser().parseFromString(html.replace(/<br\s*\/?>|<\/(?:p|h[1-6]|div|li|tr)>/gi, "\n").replace(/<\/(?:td|th)>/gi, " | "), "text/html");
  return safeText(document.body.textContent ?? "").trim();
}
