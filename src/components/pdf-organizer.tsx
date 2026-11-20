"use client";

import { ChevronDown, ChevronUp, Download, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { baseName } from "@/lib/catalog";
import { pdfCanvas, pdfOutput, readPdf } from "@/lib/pdf";
import { download, type Output } from "@/lib/workspace";

type Plan = { page: number; angle: number };
type Source = Awaited<ReturnType<typeof readPdf>>;

export default function PdfOrganizer({ file, save, reset }: { file: File; save: (output: Output) => Promise<unknown>; reset: () => void }) {
  const [pdf, setPdf] = useState<Source>();
  const [plan, setPlan] = useState<Plan[]>([]);
  const [selected, setSelected] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const picked = plan.find(({ page }) => page === selected);

  useEffect(() => {
    let live = true;
    let source: Source | undefined;
    void readPdf(file).then(async (entry) => {
      source = entry;
      if (!live) { await entry.destroy(); return; }
      setPdf(entry);
      setPlan(Array.from({ length: entry.numPages }, (_, index) => ({ page: index + 1, angle: 0 })));
    }).catch(() => { if (live) setError("PDF tidak dapat dibuka. Periksa berkas dan kata sandinya."); });
    return () => { live = false; void source?.destroy().catch(() => {}); };
  }, [file]);
  useEffect(() => {
    if (!pdf || !picked) return;
    let live = true;
    void pdf.getPage(selected).then((page) => pdfCanvas(page, 620)).then((canvas) => {
      if (!live) return;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Pratinjau halaman " + selected);
      preview.current?.replaceChildren(canvas);
    }).catch(() => { if (live) setError("Pratinjau tidak dapat ditampilkan."); });
    return () => { live = false; };
  }, [pdf, selected, picked]);

  function move(index: number, target: number) {
    setPlan((previous) => {
      const result = [...previous];
      [result[index], result[target]] = [result[target], result[index]];
      return result;
    });
    setMessage("");
  }
  async function exportPdf(toDisk: boolean) {
    setWorking(true); setError(""); setMessage("");
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const source = await PDFDocument.load(await file.arrayBuffer());
      const result = await PDFDocument.create();
      const pages = await result.copyPages(source, plan.map(({ page }) => page - 1));
      pages.forEach((page, index) => {
        page.setRotation(degrees((page.getRotation().angle + plan[index].angle) % 360));
        result.addPage(page);
      });
      const output = pdfOutput(baseName(file.name) + "-tersusun", await result.save());
      if (toDisk) download(output.blob, output.name);
      else { await save(output); setMessage("PDF tersusun berhasil disimpan."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF gagal disimpan."); }
    finally { setWorking(false); }
  }
  return <div className="stack">
    <p className="notice">{file.name}{pdf ? " · " + plan.length + " dari " + pdf.numPages + " halaman" : ""}</p>
    {pdf && <>
      {picked && <div ref={preview} className="media-stage organizer-preview" style={{ "--turn": picked.angle + "deg" } as React.CSSProperties} />}
      <div className="organizer-list" aria-label="Urutan halaman PDF">{plan.map((item, index) => (
        <div className="order-row" key={item.page}>
          <button aria-pressed={selected === item.page} className="button secondary organize-select" onClick={() => setSelected(item.page)}>Hal. {item.page}{item.angle ? " · " + item.angle + "°" : ""}</button>
          <button className="icon-button" aria-label={"Naikkan halaman " + item.page} disabled={index === 0} onClick={() => move(index, index - 1)}><ChevronUp size={17} /></button>
          <button className="icon-button" aria-label={"Turunkan halaman " + item.page} disabled={index === plan.length - 1} onClick={() => move(index, index + 1)}><ChevronDown size={17} /></button>
          <button className="icon-button" aria-label={"Putar halaman " + item.page} onClick={() => {
            setPlan((previous) => previous.map((entry) => entry.page === item.page ? { ...entry, angle: (entry.angle + 90) % 360 } : entry));
            setSelected(item.page); setMessage("");
          }}><RotateCcw size={17} /></button>
          <button className="icon-button" aria-label={"Hapus halaman " + item.page} onClick={() => {
            const rest = plan.filter((entry) => entry.page !== item.page);
            setPlan(rest); setMessage(""); if (selected === item.page) setSelected(rest[0]?.page ?? 1);
          }}><Trash2 size={17} /></button>
        </div>
      ))}</div>
      <div className="actions">
        <button className="button primary" disabled={!plan.length || working} onClick={() => void exportPdf(false)}><Save size={17} /> Simpan PDF</button>
        <button className="button secondary" disabled={!plan.length || working} onClick={() => void exportPdf(true)}><Download size={17} /> Unduh PDF</button>
        <button className="text-button" onClick={() => { setPlan(Array.from({ length: pdf.numPages }, (_, index) => ({ page: index + 1, angle: 0 }))); setSelected(1); setMessage(""); }}>Reset urutan</button>
      </div>
    </>}
    <button className="text-button" onClick={reset}>Ganti PDF</button>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}
  </div>;
}
