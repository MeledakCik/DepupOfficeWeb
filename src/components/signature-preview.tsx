"use client";

import { useEffect, useRef, useState } from "react";
import { imageBlob, signatureImage } from "@/lib/imaging";
import { pdfCanvas, readPdf } from "@/lib/pdf";
import { stampPlacement } from "@/lib/pdf-placement";
import { LocalImage } from "./media";

type Source = Awaited<ReturnType<typeof readPdf>>;
type Preview = { blob: Blob; width: number; height: number };
type Placement = { page: number; scale: number; x: number; y: number; angle: number; ink: string };

export default function SignaturePreview({ file, signature, values, onMove }: {
  file: File; signature: Blob; values: Placement; onMove: (x: number, y: number) => void;
}) {
  const [document, setDocument] = useState<{ file: File; source: Source }>();
  const [view, setView] = useState<{ source: Source; page: number; preview: Preview }>();
  const [stamp, setStamp] = useState<{ signature: Blob; ink: string; preview: Preview }>();
  const [error, setError] = useState("");
  const surface = useRef<HTMLDivElement>(null);
  const grab = useRef<{ left: number; top: number; x: number; y: number } | null>(null);
  const { page, scale, x, y, angle, ink } = values;
  const source = document?.file === file ? document.source : undefined;

  useEffect(() => {
    let owning = true;
    let loaded: Source | undefined;
    void readPdf(file).then(async (result) => {
      if (!owning) { await result.destroy(); return; }
      loaded = result;
      setDocument({ file, source: result });
      setError("");
    }).catch(() => { if (owning) setError("Pratinjau PDF tidak dapat dimuat."); });
    return () => { owning = false; void loaded?.destroy().catch(() => {}); };
  }, [file]);

  useEffect(() => {
    if (!source || !Number.isInteger(page) || page < 1 || page > source.numPages) return;
    let current = true;
    void source.getPage(page).then(async (pdfPage) => {
      try {
        const canvas = await pdfCanvas(pdfPage, 1120);
        const blob = await imageBlob(canvas);
        if (current) {
          setView({ source, page, preview: { blob, width: canvas.width, height: canvas.height } });
          setError("");
        }
      } finally { pdfPage.cleanup(); }
    }).catch(() => { if (current) setError("Halaman PDF tidak dapat ditampilkan."); });
    return () => { current = false; };
  }, [source, page]);

  useEffect(() => {
    let current = true;
    void signatureImage(signature, ink).then(async (canvas) => {
      const blob = await imageBlob(canvas, "image/png");
      if (current) setStamp({ signature, ink, preview: { blob, width: canvas.width, height: canvas.height } });
    }).catch(() => { if (current) setError("Gambar tanda tangan tidak dapat dimuat."); });
    return () => { current = false; };
  }, [signature, ink]);

  if (error) return <p className="notice" role="status">{error}</p>;
  if (source && (page < 1 || page > source.numPages || !Number.isInteger(page))) {
    return <p className="notice" role="status">Pilih nomor halaman dari 1 sampai {source.numPages}.</p>;
  }
  if (!view || view.source !== source || view.page !== page || stamp?.signature !== signature || stamp.ink !== ink) {
    return <p className="notice" role="status">Menyiapkan pratinjau tanda tangan…</p>;
  }
  const preview = view.preview;
  const placement = stampPlacement(preview, stamp.preview.width / stamp.preview.height, scale, x, y, angle);
  const percent = (value: number, total: number) => value / total * 100 + "%";
  function move(nextX: number, nextY: number) {
    onMove(Math.min(100, Math.max(0, Math.round(nextX))), Math.min(100, Math.max(0, Math.round(nextY))));
  }

  return <div className="stack">
    <p className="tool-description">Geser tanda tangan pada halaman {page} dari {source.numPages}, atau gunakan tombol panah saat tanda tangan dipilih.</p>
    <div ref={surface} className="signature-preview" style={{ aspectRatio: preview.width / preview.height }}>
      <LocalImage blob={preview.blob} alt={"Pratinjau halaman " + page} />
      <button type="button" className="signature-stamp" aria-label="Geser tanda tangan"
        style={{ left: percent(placement.centerX, preview.width), top: percent(placement.centerY, preview.height),
          width: percent(placement.width, preview.width), height: percent(placement.height, preview.height),
          transform: "translate(-50%, -50%) rotate(" + angle + "deg)" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          grab.current = { left: event.clientX, top: event.clientY, x, y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const bounds = surface.current?.getBoundingClientRect();
          const origin = grab.current;
          if (!bounds || !origin) return;
          const rangeX = bounds.width * (1 - placement.dx / preview.width);
          const rangeY = bounds.height * (1 - placement.dy / preview.height);
          move(origin.x + (event.clientX - origin.left) * 100 / Math.max(1, rangeX),
            origin.y + (event.clientY - origin.top) * 100 / Math.max(1, rangeY));
        }}
        onLostPointerCapture={() => { grab.current = null; }}
        onKeyDown={(event) => {
          const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!direction) return;
          event.preventDefault();
          const step = event.shiftKey ? 10 : 2;
          move(x + direction[0] * step, y + direction[1] * step);
        }}>
        <LocalImage blob={stamp.preview.blob} alt="" />
      </button>
    </div>
  </div>;
}
