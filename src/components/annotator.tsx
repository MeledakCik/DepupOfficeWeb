"use client";

import { ChevronLeft, ChevronRight, Download, Highlighter, NotebookPen, Pencil, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { baseName } from "@/lib/catalog";
import { context, imageBlob } from "@/lib/imaging";
import type { readPdf } from "@/lib/pdf";
import { download, type Output } from "@/lib/workspace";

type Source = Awaited<ReturnType<typeof readPdf>>;
type Point = [number, number];
type Mark = { tool: "pen" | "highlight" | "note"; color: string; points: Point[]; text?: string };

function render(canvas: HTMLCanvasElement, marks: Mark[]) {
  const ctx = context(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const mark of marks) {
    ctx.strokeStyle = mark.color;
    ctx.fillStyle = mark.color;
    ctx.globalAlpha = mark.tool === "highlight" ? .32 : 1;
    ctx.lineWidth = mark.tool === "highlight" ? 20 : 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (mark.tool === "note") {
      ctx.font = "bold 21px sans-serif";
      ctx.fillText(mark.text ?? "", ...mark.points[0], canvas.width - mark.points[0][0] - 3);
    } else {
      ctx.beginPath();
      ctx.moveTo(...mark.points[0]);
      mark.points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      if (mark.points.length === 1) ctx.lineTo(mark.points[0][0] + .1, mark.points[0][1] + .1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export default function Annotator({ file, save, reset }: { file: File; save: (output: Output) => Promise<unknown>; reset: () => void }) {
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<Source>();
  const [page, setPage] = useState(1);
  const [markTool, setTool] = useState<Mark["tool"]>("pen");
  const [color, setColor] = useState("#174de9");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [rendered, setRendered] = useState(0);
  const marks = useRef(new Map<number, Mark[]>());
  const sizes = useRef(new Map<number, [number, number]>());
  const active = useRef<Mark | null>(null);

  useEffect(() => {
    let current = true;
    let document: Source | undefined;
    void import("@/lib/pdf").then(async ({ readPdf }) => {
      document = await readPdf(file);
      if (current) setSource(document);
      else await document.destroy();
    }).catch(() => { if (current) setError("PDF tidak dapat dibuka. Gunakan berkas tanpa kata sandi."); });
    return () => { current = false; void document?.destroy().catch(() => {}); };
  }, [file]);

  useEffect(() => {
    if (!source) return;
    let current = true;
    void import("@/lib/pdf").then(async ({ pdfCanvas }) => {
      const raw = await source.getPage(page);
      const preview = await pdfCanvas(raw, 1100);
      if (!current || !base.current || !overlay.current) return;
      const original = base.current;
      original.width = overlay.current.width = preview.width;
      original.height = overlay.current.height = preview.height;
      context(original).drawImage(preview, 0, 0);
      sizes.current.set(page, [preview.width, preview.height]);
      render(overlay.current, marks.current.get(page) ?? []);
      setRendered(page);
    }).catch(() => { if (current) setError("Halaman gagal ditampilkan."); });
    return () => { current = false; };
  }, [source, page]);

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - bounds.left) * event.currentTarget.width / bounds.width, (event.clientY - bounds.top) * event.currentTarget.height / bounds.height];
  }

  async function exportFile(toDisk: boolean) {
    if (!source || !Array.from(marks.current.values()).some((items) => items.length)) { setError("Tambahkan anotasi pada halaman terlebih dahulu."); return; }
    setBusy(true); setStatus(""); setError("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const { pdfOutput } = await import("@/lib/pdf");
      const { canvasOf } = await import("@/lib/imaging");
      const output = await PDFDocument.load(await file.arrayBuffer());
      for (const [index, items] of marks.current.entries()) {
        if (!items.length) continue;
        const [width, height] = sizes.current.get(index)!;
        const stamp = canvasOf(width, height);
        render(stamp, items);
        const image = await output.embedPng(await (await imageBlob(stamp, "image/png")).arrayBuffer());
        const page = output.getPage(index - 1);
        const rotation = page.getRotation().angle % 360;
        if (rotation) {
          const { degrees } = await import("pdf-lib");
          const w = page.getWidth(), h = page.getHeight();
          const normalized = (rotation + 360) % 360;
          page.drawImage(image, {
            x: normalized === 90 || normalized === 180 ? w : 0,
            y: normalized === 180 || normalized === 270 ? h : 0,
            width: normalized === 180 ? w : h, height: normalized === 180 ? h : w, rotate: degrees(normalized),
          });
        } else page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }
      const result = pdfOutput(baseName(file.name) + "-anotasi", await output.save());
      if (toDisk) download(result.blob, result.name);
      else { await save(result); setStatus("Anotasi tersimpan di ruang kerja."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF gagal disimpan."); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    <div className="editor-toolbar">
      {([["pen", "Pena", Pencil], ["highlight", "Stabilo", Highlighter], ["note", "Catatan", NotebookPen]] as const).map(([id, label, Icon]) =>
        <button key={id} aria-pressed={id === markTool} onClick={() => { setTool(id); setColor(id === "highlight" ? "#ffbd13" : "#174de9"); }}><Icon size={16} /> {label}</button>)}
      <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Warna anotasi" />
      <button onClick={() => { marks.current.get(page)?.pop(); if (overlay.current) render(overlay.current, marks.current.get(page) ?? []); }}><RotateCcw size={17} /> Urungkan</button>
    </div>
    {markTool === "note" && <label>Teks catatan<input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="Tulis, lalu ketuk halaman untuk meletakkan catatan." /></label>}
    <div className="media-stage">
      {!source && !error && <p role="status">Memuat PDF…</p>}
      <div className="annotation-board" hidden={!rendered}><canvas ref={base} aria-hidden="true" />
        <canvas ref={overlay} aria-label={"Kanvas anotasi halaman " + page} onPointerDown={(event) => {
          if (rendered !== page || (markTool === "note" && !note.trim())) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          active.current = { tool: markTool, color, points: [point(event)], text: note.trim() };
          marks.current.set(page, [...(marks.current.get(page) ?? []), active.current]);
          render(event.currentTarget, marks.current.get(page) ?? []);
        }} onPointerMove={(event) => {
          if (!active.current || active.current.tool === "note") return;
          active.current.points.push(point(event));
          render(event.currentTarget, marks.current.get(page) ?? []);
        }} onLostPointerCapture={() => { active.current = null; }} />
      </div>
    </div>
    <div className="actions">
      <button className="icon-button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={19} /></button>
      <span>{source ? page + " / " + source.numPages : "—"}</span>
      <button className="icon-button" aria-label="Halaman berikutnya" disabled={!source || page >= source.numPages} onClick={() => setPage(page + 1)}><ChevronRight size={19} /></button>
      <button className="button primary" disabled={!source || busy} onClick={() => void exportFile(false)}><Save size={17} /> Simpan PDF</button>
      <button className="button secondary" disabled={!source || busy} onClick={() => void exportFile(true)}><Download size={17} /> Unduh PDF</button>
      <button className="text-button" onClick={reset}>Ganti PDF</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {status && <p className="success" role="status">{status}</p>}
  </div>;
}
