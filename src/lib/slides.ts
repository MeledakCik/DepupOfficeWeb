import { canvasOf, context, loadImage } from "./imaging";

type ShapeBox = { x: number; y: number; width: number; height: number; angle: number };
type Paragraph = { text: string; size: number; bold: boolean; italic: boolean; color?: string; align: CanvasTextAlign };
type Shape = ShapeBox & ({ kind: "picture"; blob: Blob } | { kind: "text"; lines: Paragraph[]; fill?: string; middle: boolean });
export type Slide = { text: string; shapes: Shape[]; width: number; height: number; background: string };

const elements = (node: Document | Element | undefined, name: string) => Array.from(node?.getElementsByTagNameNS("*", name) ?? []);
const child = (node: Element | undefined, name: string) => Array.from(node?.children ?? []).find((element) => element.localName === name);
const dimension = (value: string | null | undefined) => Number(value) / 9525;
const parse = (xml: string) => new DOMParser().parseFromString(xml, "text/xml");
const isSlide = /^ppt\/slides\/slide\d+\.xml$/i;

function solidColor(node: Element | undefined) {
  const value = child(child(node, "solidFill"), "srgbClr")?.getAttribute("val");
  return value && /^[\da-f]{6}$/i.test(value) ? "#" + value : undefined;
}

function paragraphs(node: Element) {
  return elements(node, "p").map((line): Paragraph => {
    const props = child(line, "pPr");
    const style = child(child(line, "r"), "rPr") ?? child(props, "defRPr");
    const size = Number(style?.getAttribute("sz")) / 75;
    const alignment = props?.getAttribute("algn");
    const bullet = child(props, "buChar")?.getAttribute("char");
    return { text: (bullet ? bullet + " " : "") + elements(line, "t").map((text) => text.textContent ?? "").join(""),
      size: Number.isFinite(size) && size > 0 ? Math.min(size, 250) : 24,
      bold: ["1", "true"].includes(style?.getAttribute("b") ?? ""), italic: ["1", "true"].includes(style?.getAttribute("i") ?? ""),
      color: solidColor(style), align: alignment === "ctr" ? "center" : alignment === "r" ? "right" : "left" };
  });
}

function placeholderShape(shape: Element, layout: Document | undefined) {
  const placeholder = elements(shape, "ph")[0];
  if (!placeholder) return;
  const index = placeholder.getAttribute("idx");
  const kind = placeholder.getAttribute("type") ?? "obj";
  return elements(layout, "sp").find((candidate) => {
    const other = elements(candidate, "ph")[0];
    return other && (index !== null ? other.getAttribute("idx") === index : (other.getAttribute("type") ?? "obj") === kind);
  });
}

function box(node: Element, layout: Document | undefined): ShapeBox | undefined {
  const transform = child(child(node, "spPr"), "xfrm") ?? child(child(placeholderShape(node, layout), "spPr"), "xfrm");
  const origin = child(transform, "off");
  const extent = child(transform, "ext");
  const width = dimension(extent?.getAttribute("cx"));
  const height = dimension(extent?.getAttribute("cy"));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  return { x: dimension(origin?.getAttribute("x")) || 0, y: dimension(origin?.getAttribute("y")) || 0,
    width, height, angle: (Number(transform?.getAttribute("rot")) || 0) / 60000 };
}

function relationships(document?: Document) {
  return new Map(elements(document, "Relationship").filter((relation) => relation.getAttribute("TargetMode") !== "External")
    .map((relation) => [relation.getAttribute("Id") ?? "", relation.getAttribute("Target") ?? ""]));
}

function partPath(path: string, target: string) {
  if (!target || target.includes("\\") || /^[\w+.-]+:/.test(target) || target.startsWith("//")) return "";
  return new URL(target, "https://presentation.invalid/" + path).pathname.slice(1);
}

export async function readSlides(file: Blob): Promise<Slide[]> {
  const { default: Zip } = await import("jszip");
  const zip = await Zip.loadAsync(await file.arrayBuffer());
  async function xml(path: string) {
    const part = zip.file(path);
    return part ? parse(await part.async("string")) : undefined;
  }
  const presentationPart = "ppt/presentation.xml";
  const [presentation, references] = await Promise.all([xml(presentationPart), xml("ppt/_rels/presentation.xml.rels")]);
  const sizes = elements(presentation, "sldSz")[0];
  const width = dimension(sizes?.getAttribute("cx")) || 960;
  const height = dimension(sizes?.getAttribute("cy")) || 540;
  if (width <= 0 || height <= 0 || Math.max(width, height) / Math.min(width, height) > 30) throw new Error("Ukuran slide tidak valid.");
  const links = relationships(references);
  const ordered = elements(presentation, "sldId").map((entry) => partPath(presentationPart, links.get(entry.getAttribute("r:id") ?? "") ?? ""))
    .filter((path) => isSlide.test(path) && zip.file(path));
  const paths = ordered.length ? ordered : Object.keys(zip.files).filter((path) => isSlide.test(path)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const layouts = new Map<string, Promise<Document | undefined>>();
  return Promise.all(paths.map(async (path) => {
    const [slide, relations] = await Promise.all([xml(path), xml(path.replace("slides/", "slides/_rels/") + ".rels")]);
    const link = relationships(relations);
    const layoutPath = [...link.values()].map((value) => partPath(path, value)).find((value) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(value));
    if (layoutPath && !layouts.has(layoutPath)) layouts.set(layoutPath, xml(layoutPath));
    const layout = layoutPath ? await layouts.get(layoutPath) : undefined;
    const shapes: Shape[] = [];
    const background = solidColor(elements(slide, "bgPr")[0]) ?? solidColor(elements(layout, "bgPr")[0]) ?? "#ffffff";
    const missing: Paragraph[] = [];
    const tree = elements(slide, "spTree")[0];
    for (const node of Array.from(tree?.children ?? [])) {
      if (node.localName === "pic") {
        const embed = elements(node, "blip")[0]?.getAttribute("r:embed") ?? "";
        const imagePath = partPath(path, link.get(embed) ?? "");
        const valid = /^ppt\/media\/[^/]+\.(png|jpe?g|gif|webp|bmp)$/i.exec(imagePath);
        const image = valid && zip.file(imagePath);
        const geometry = box(node, layout);
        if (valid && image && geometry) {
          const ext = valid[1].toLowerCase();
          shapes.push({ ...geometry, kind: "picture", blob: new Blob([await image.async("arraybuffer")], { type: "image/" + (ext === "jpg" ? "jpeg" : ext) }) });
        }
      } else if (node.localName === "sp" || node.localName === "grpSp" || node.localName === "graphicFrame") {
        const lines = paragraphs(node);
        const geometry = box(node, layout);
        if (geometry) shapes.push({ ...geometry, kind: "text", lines, fill: solidColor(child(node, "spPr")), middle: child(child(node, "txBody"), "bodyPr")?.getAttribute("anchor") === "ctr" });
        else missing.push(...lines);
      }
    }
    if (missing.some((line) => line.text.trim())) {
      shapes.push({ x: width * .06, y: height * .08, width: width * .88, height: height * .84, angle: 0, kind: "text", lines: missing, middle: false });
    }
    return { width, height, background, shapes, text: slide ? paragraphs(slide.documentElement).map((row) => row.text).join("\n").trim() : "" };
  }));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (!text.trim()) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? line + " " + word : word;
    if (line && ctx.measureText(candidate).width > width) { lines.push(line); line = word; }
    else line = candidate;
  }
  return [...lines, line];
}

export async function renderSlide(slide: Slide, longest = 1280) {
  const scale = longest / Math.max(slide.width, slide.height);
  const canvas = canvasOf(slide.width * scale, slide.height * scale);
  const ctx = context(canvas);
  ctx.scale(canvas.width / slide.width, canvas.height / slide.height);
  ctx.fillStyle = slide.background;
  ctx.fillRect(0, 0, slide.width, slide.height);
  const defaultColor = Number.parseInt(slide.background.slice(1), 16) < 0x535353 ? "#ffffff" : "#172038";
  for (const shape of slide.shapes) {
    ctx.save();
    ctx.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
    ctx.rotate(shape.angle * Math.PI / 180);
    ctx.translate(-shape.width / 2, -shape.height / 2);
    if (shape.kind === "picture") {
      try {
        const image = await loadImage(shape.blob, longest);
        ctx.drawImage(image, 0, 0, shape.width, shape.height);
      } catch { /* Ignore media unsupported by the browser. */ }
    } else {
      if (shape.fill) { ctx.fillStyle = shape.fill; ctx.fillRect(0, 0, shape.width, shape.height); }
      ctx.beginPath(); ctx.rect(0, 0, shape.width, shape.height); ctx.clip();
      const inset = Math.min(8, shape.width * .05);
      const font = (entry: Paragraph) => (entry.italic ? "italic " : "") + (entry.bold ? "bold " : "") + entry.size + "px Arial, sans-serif";
      const paragraphs = shape.lines.map((paragraph) => {
        ctx.font = font(paragraph);
        return { ...paragraph, rows: wrap(ctx, paragraph.text, shape.width - 2 * inset) };
      });
      const blockHeight = paragraphs.reduce((sum, paragraph) => sum + paragraph.rows.length * paragraph.size * 1.18, 0);
      let y = shape.middle ? Math.max(inset, (shape.height - blockHeight) / 2) : inset;
      ctx.textBaseline = "top";
      for (const paragraph of paragraphs) {
        ctx.font = font(paragraph);
        ctx.fillStyle = paragraph.color ?? defaultColor;
        ctx.textAlign = paragraph.align;
        const x = paragraph.align === "right" ? shape.width - inset : paragraph.align === "center" ? shape.width / 2 : inset;
        for (const line of paragraph.rows) {
          ctx.fillText(line, x, y, shape.width - 2 * inset);
          y += paragraph.size * 1.18;
        }
      }
    }
    ctx.restore();
  }
  return canvas;
}
