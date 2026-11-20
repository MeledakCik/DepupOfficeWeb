import type { Output } from "./workspace";
import { baseName } from "./catalog";

export type Point = { x: number; y: number };
export type Redaction = Point & { width: number; height: number };
export type Corners = [Point, Point, Point, Point];
export type ScanFilter = "natural" | "gray" | "mono" | "paper";
export const fullCorners: Corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

export function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context(canvas: HTMLCanvasElement) {
  const value = canvas.getContext("2d", { willReadFrequently: true });
  if (!value) throw new Error("Kanvas tidak dapat dibuka di browser ini.");
  return value;
}

export async function loadImage(blob: Blob, longest = 2200) {
  const image = await createImageBitmap(blob);
  try {
    const ratio = Math.min(1, longest / Math.max(image.width, image.height));
    const canvas = canvasOf(image.width * ratio, image.height * ratio);
    context(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { image.close(); }
}

export async function imageBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.86) {
  if (type === "image/jpeg") {
    const ctx = context(canvas);
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Gambar gagal dibuat.")), type, quality));
}

export function transform(source: HTMLCanvasElement, rotation: number, flip: boolean) {
  const quarter = rotation % 180 !== 0;
  const canvas = canvasOf(quarter ? source.height : source.width, quarter ? source.width : source.height);
  const ctx = context(canvas);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  ctx.restore();
  return canvas;
}

export function straighten(source: HTMLCanvasElement, corners: Corners) {
  const [a, b, c, d] = corners.map(({ x, y }) => ({ x: x * (source.width - 1), y: y * (source.height - 1) }));
  const length = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
  const canvas = canvasOf(Math.max(length(a, b), length(d, c)) + 1, Math.max(length(a, d), length(b, c)) + 1);
  if (canvas.width < 20 || canvas.height < 20) throw new Error("Area potong terlalu kecil.");
  const deltaX = a.x - b.x + c.x - d.x;
  const deltaY = a.y - b.y + c.y - d.y;
  const det = (b.x - c.x) * (d.y - c.y) - (d.x - c.x) * (b.y - c.y);
  if (Math.abs(det) < 0.01) throw new Error("Susun empat sudut agar area potong membentuk segi empat.");
  const g = (deltaX * (d.y - c.y) - (d.x - c.x) * deltaY) / det;
  const h = ((b.x - c.x) * deltaY - deltaX * (b.y - c.y)) / det;
  const firstX = b.x - a.x + g * b.x;
  const firstY = b.y - a.y + g * b.y;
  const secondX = d.x - a.x + h * d.x;
  const secondY = d.y - a.y + h * d.y;
  const sourcePixels = context(source).getImageData(0, 0, source.width, source.height);
  const ctx = context(canvas);
  const output = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    const v = y / (canvas.height - 1);
    for (let x = 0; x < canvas.width; x++) {
      const u = x / (canvas.width - 1);
      const divisor = g * u + h * v + 1;
      const sx = Math.max(0, Math.min(source.width - 1, Math.round((firstX * u + secondX * v + a.x) / divisor)));
      const sy = Math.max(0, Math.min(source.height - 1, Math.round((firstY * u + secondY * v + a.y) / divisor)));
      const index = (y * canvas.width + x) * 4;
      const original = (sy * source.width + sx) * 4;
      output.data[index] = sourcePixels.data[original];
      output.data[index + 1] = sourcePixels.data[original + 1];
      output.data[index + 2] = sourcePixels.data[original + 2];
      output.data[index + 3] = sourcePixels.data[original + 3];
    }
  }
  ctx.putImageData(output, 0, 0);
  return canvas;
}

export function detectPaper(source: HTMLCanvasElement): Corners {
  const scale = Math.min(1, 360 / Math.max(source.width, source.height));
  const sample = canvasOf(source.width * scale, source.height * scale);
  const ctx = context(sample);
  ctx.drawImage(source, 0, 0, sample.width, sample.height);
  const { data } = ctx.getImageData(0, 0, sample.width, sample.height);
  const points: Point[] = [];
  for (let y = 2; y < sample.height - 2; y += 3) {
    for (let x = 2; x < sample.width - 2; x += 3) {
      const offset = (y * sample.width + x) * 4;
      const channels = [data[offset], data[offset + 1], data[offset + 2]];
      if (Math.min(...channels) > 158 && Math.max(...channels) - Math.min(...channels) < 60) points.push({ x: x / sample.width, y: y / sample.height });
    }
  }
  if (points.length < 40) return fullCorners;
  const project = [(p: Point) => p.x + p.y, (p: Point) => -p.x + p.y, (p: Point) => -p.x - p.y, (p: Point) => p.x - p.y];
  const corners = project.map((score) => points.reduce((best, next) => score(next) < score(best) ? next : best)) as Corners;
  const [a, b, , d] = corners;
  return b.x - a.x > 0.28 && d.y - a.y > 0.28 ? corners : fullCorners;
}

export function adjust(canvas: HTMLCanvasElement, filter: ScanFilter, brightness = 0, contrast = 0) {
  if (filter === "natural" && !brightness && !contrast) return;
  const ctx = context(canvas);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const factor = 1 + contrast / 100;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const gray = (luminance - 128) * factor + 128 + brightness;
    if (filter === "natural") {
      for (let j = 0; j < 3; j++) data[i + j] = (data[i + j] - 128) * factor + 128 + brightness;
    } else {
      const value = filter === "mono" ? (gray > 151 ? 255 : 0) : filter === "paper" ? (gray - 120) * 1.55 + 182 : gray;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function watermarkImage(canvas: HTMLCanvasElement, text: string) {
  const ctx = context(canvas);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 8);
  ctx.globalAlpha = 0.55;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.max(18, canvas.width / 10) + "px sans-serif";
  ctx.lineWidth = Math.max(1, canvas.width / 370);
  ctx.strokeStyle = "#222";
  ctx.fillStyle = "#fff";
  ctx.strokeText(text, 0, 0, canvas.width * 0.86);
  ctx.fillText(text, 0, 0, canvas.width * 0.86);
  ctx.restore();
}

export function redactImage(canvas: HTMLCanvasElement, areas: Redaction[]) {
  const ctx = context(canvas);
  ctx.fillStyle = "#000";
  for (const area of areas) {
    const left = Math.floor(area.x * canvas.width);
    const top = Math.floor(area.y * canvas.height);
    const right = Math.ceil((area.x + area.width) * canvas.width);
    const bottom = Math.ceil((area.y + area.height) * canvas.height);
    ctx.fillRect(left, top, right - left, bottom - top);
  }
}

export function removePaperShadow(canvas: HTMLCanvasElement) {
  const factor = 90 / Math.max(canvas.width, canvas.height);
  const sample = canvasOf(canvas.width * factor, canvas.height * factor);
  const sampler = context(sample);
  sampler.drawImage(canvas, 0, 0, sample.width, sample.height);
  const { data: pixels } = sampler.getImageData(0, 0, sample.width, sample.height);
  const background = new Uint8Array(sample.width * sample.height);
  const radius = 3;
  const luma = (data: Uint8ClampedArray, index: number) => .299 * data[index] + .587 * data[index + 1] + .114 * data[index + 2];
  for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
    let light = 65;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(sample.height - 1, y + radius); yy++) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(sample.width - 1, x + radius); xx++) {
        light = Math.max(light, luma(pixels, (yy * sample.width + xx) * 4));
      }
    }
    background[y * sample.width + x] = light;
  }
  const ctx = context(canvas);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sx = (sample.width - 1) / Math.max(1, canvas.width - 1);
  const sy = (sample.height - 1) / Math.max(1, canvas.height - 1);
  for (let y = 0; y < canvas.height; y++) {
    const py = y * sy;
    const top = Math.floor(py);
    const bottom = Math.min(sample.height - 1, top + 1);
    const fy = py - top;
    for (let x = 0; x < canvas.width; x++) {
      const px = x * sx;
      const left = Math.floor(px);
      const right = Math.min(sample.width - 1, left + 1);
      const fx = px - left;
      const base = (background[top * sample.width + left] * (1 - fx) + background[top * sample.width + right] * fx) * (1 - fy)
        + (background[bottom * sample.width + left] * (1 - fx) + background[bottom * sample.width + right] * fx) * fy;
      const i = (y * canvas.width + x) * 4;
      const value = Math.min(255, Math.max(0, (luma(image.data, i) / base - .10) * 290));
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export async function changeImages(files: File[], mode: string, text = "", quality = 0.75): Promise<Output[]> {
  const outputs: Output[] = [];
  for (const file of files) {
    const canvas = await loadImage(file, mode === "image-compress" ? 1440 : 2400);
    if (mode === "deshadow") removePaperShadow(canvas);
    if (mode === "batch-watermark") watermarkImage(canvas, text);
    if (mode === "transparent") {
      const ctx = context(canvas);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        const lightestWhite = Math.min(...image.data.subarray(i, i + 3));
        image.data[i + 3] *= Math.min(1, Math.max(0, (247 - lightestWhite) / 100));
      }
      ctx.putImageData(image, 0, 0);
    }
    const png = mode === "transparent";
    outputs.push({ name: baseName(file.name) + "-" + mode + (png ? ".png" : ".jpg"), blob: await imageBlob(canvas, png ? "image/png" : "image/jpeg", quality) });
  }
  return outputs;
}

export async function signatureImage(blob: Blob, color: string) {
  const [image] = await changeImages([new File([blob], "signature.png", { type: blob.type })], "transparent");
  const canvas = await loadImage(image.blob, 1100);
  if (color) {
    const ctx = context(canvas);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
export async function withOcr<T>(work: (worker: OcrWorker) => Promise<T>, progress?: (value: string) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ind", "eng"], 1, {
    workerPath: "/runtime/ocr/worker.min.js",
    corePath: "/runtime/ocr/tesseract-core-lstm.wasm.js",
    langPath: "/runtime/ocr",
    workerBlobURL: false,
    logger: ({ status, progress: value }) => progress?.(status === "recognizing text" ? "Membaca teks " + Math.round(value * 100) + "%" : "Menyiapkan OCR…"),
  });
  try { return await work(worker); }
  finally { await worker.terminate(); }
}

export async function recognize(blob: Blob, progress?: (value: string) => void) {
  return withOcr(async (worker) => (await worker.recognize(blob)).data.text.trim(), progress);
}
