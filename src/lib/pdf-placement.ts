import type { PDFPage } from "pdf-lib";

export function pageSpace(page: PDFPage) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const horizontal = [Math.max(media.x, crop.x), Math.min(media.x + media.width, crop.x + crop.width)];
  const vertical = [Math.max(media.y, crop.y), Math.min(media.y + media.height, crop.y + crop.height)];
  const [left, right] = horizontal[1] > horizontal[0] ? horizontal : [media.x, media.x + media.width];
  const [bottom, top] = vertical[1] > vertical[0] ? vertical : [media.y, media.y + media.height];
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const swap = rotation === 90 || rotation === 270;

  function point(x: number, y: number) {
    if (rotation === 90) return { x: left + y, y: bottom + x };
    if (rotation === 180) return { x: right - x, y: bottom + y };
    if (rotation === 270) return { x: right - y, y: top - x };
    return { x: left + x, y: top - y };
  }
  return { width: swap ? top - bottom : right - left, height: swap ? right - left : top - bottom, rotation, point };
}

export function stampPlacement(page: { width: number; height: number }, ratio: number, scale: number, x: number, y: number, angle: number) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const size = Math.min(page.width * scale / 100, page.height * .30 * ratio);
  const spanX = Math.abs(cos) + Math.abs(sin) / ratio;
  const spanY = Math.abs(sin) + Math.abs(cos) / ratio;
  const width = Math.min(size, page.width / spanX, page.height / spanY);
  const height = width / ratio;
  const dx = width * spanX;
  const dy = width * spanY;
  const centerX = dx / 2 + (page.width - dx) * x / 100;
  const centerY = dy / 2 + (page.height - dy) * y / 100;
  return { width, height, dx, dy, centerX, centerY,
    bottomLeft: { x: centerX - width / 2 * cos - height / 2 * sin, y: centerY - width / 2 * sin + height / 2 * cos } };
}
