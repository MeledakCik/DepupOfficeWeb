"use client";

import dynamic from "next/dynamic";
import { Download, ScanLine, Share2 } from "lucide-react";
import { useState } from "react";
import { type Kind } from "@/lib/catalog";
import { download, formatSize, shareFile, type Output, type Preferences, type StoredDocument } from "@/lib/workspace";
import { LocalImage } from "./media";

const loading = () => <p role="status">Memuat editor…</p>;
const Word = dynamic(() => import("./word-editor"), { ssr: false, loading });
const Sheet = dynamic(() => import("./sheet-editor"), { ssr: false, loading });
const Pdf = dynamic(() => import("./pdf-viewer"), { ssr: false, loading });
const Presentation = dynamic(() => import("./presentation"), { ssr: false, loading });
type Launch = (id: string, files?: File[]) => void;

export default function Editor({ document: record, kind, template, preferences, save, launch }: {
  document?: StoredDocument; kind: Kind; template?: string; preferences: Preferences;
  save: (output: Output) => Promise<unknown>; launch: Launch;
}) {
  const [status, setStatus] = useState("");
  if (kind === "word") return <Word record={record} template={template} preferences={preferences} save={save} />;
  if (kind === "excel") return <Sheet record={record} template={template} preferences={preferences} save={save} />;
  if (!record) return null;
  if (kind === "pdf") return <Pdf record={record} preferences={preferences} launch={launch} />;
  const file = new File([record.data], record.name, { type: record.mime });
  return <div className="stack">
    {kind === "image" ? <div className="media-stage"><LocalImage blob={record.data} alt={record.name} className="preview-image" /></div> :
      kind === "slides" ? <Presentation file={record.data} /> : <p className="notice">Pratinjau tidak tersedia untuk format ini. Anda tetap dapat mengunduh atau membagikannya.</p>}
    <p className="block-muted">{formatSize(record.size)}</p>
    <div className="actions">
      <button className="button primary" onClick={() => download(record.data, record.name)}><Download size={17} /> Unduh berkas</button>
      <button className="button secondary" onClick={async () => {
        try { setStatus(await shareFile(record.data, record.name) ? "Berkas dibagikan." : "Berkas diunduh dan siap dibagikan."); }
        catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Berkas gagal dibagikan."); }
      }}><Share2 size={17} /> Bagikan</button>
      {kind === "image" && <button className="button secondary" onClick={() => launch("ocr", [file])}><ScanLine size={17} /> Ambil teks</button>}
      {kind === "slides" && <button className="button secondary" onClick={() => launch("office-pdf", [file])}>Ekspor PDF</button>}
    </div>
    {status && <p className="notice" role="status">{status}</p>}
  </div>;
}
