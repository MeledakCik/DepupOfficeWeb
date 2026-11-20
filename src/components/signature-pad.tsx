"use client";

import { useRef, type PointerEvent } from "react";

export default function SignaturePad({ onChange }: { onChange: (blob?: Blob) => void }) {
  const surface = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return [(event.clientX - bounds.left) * canvas.width / bounds.width, (event.clientY - bounds.top) * canvas.height / bounds.height] as const;
  }
  return <div className="stack">
    <canvas ref={surface} width={1000} height={300} className="signature-pad" aria-label="Kanvas tanda tangan"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const ctx = event.currentTarget.getContext("2d");
        if (!ctx) return;
        drawing.current = true;
        const [x, y] = point(event);
        ctx.strokeStyle = "#111c36"; ctx.fillStyle = "#111c36"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y);
      }}
      onPointerMove={(event) => {
        if (!drawing.current) return;
        const ctx = event.currentTarget.getContext("2d");
        ctx?.lineTo(...point(event)); ctx?.stroke();
      }}
      onLostPointerCapture={() => {
        if (!drawing.current) return;
        drawing.current = false;
        const canvas = surface.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (pixels.data[(y * canvas.width + x) * 4 + 3]) {
            left = Math.min(x, left); right = Math.max(x, right);
            top = Math.min(y, top); bottom = Math.max(y, bottom);
          }
        }
        if (left > right || top > bottom) return;
        const trim = document.createElement("canvas");
        trim.width = right - left + 13; trim.height = bottom - top + 13;
        trim.getContext("2d")?.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 6, 6, right - left + 1, bottom - top + 1);
        trim.toBlob((blob) => onChange(blob ?? undefined), "image/png");
      }} />
    <button type="button" className="text-button" onClick={() => {
      const canvas = surface.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      onChange(undefined);
    }}>Bersihkan tanda tangan</button>
  </div>;
}
