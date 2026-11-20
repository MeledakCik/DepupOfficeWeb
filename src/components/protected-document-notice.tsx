"use client";

import { Download, LockKeyhole } from "lucide-react";
import { protectedDocumentMessage } from "@/lib/protected-document";
import { download } from "@/lib/workspace";

export default function ProtectedDocumentNotice({ name, data }: { name: string; data: Blob }) {
  return <div className="stack">
    <span className="badge other" aria-hidden="true"><LockKeyhole size={20} /></span>
    <p className="notice" role="status"><strong>{name}</strong><br />{protectedDocumentMessage}</p>
    <p className="tool-description">Unduh berkas asli, lalu pilih PDF tersebut dari folder Unduhan di Depup Office pada Android. Aplikasi Android menangani pembatasan tangkapan layar dan penyuntingan.</p>
    <button type="button" className="button primary" onClick={() => {
      const filename = /\.pdf$/i.test(name) ? name : name + ".pdf";
      download(data.slice(0, data.size, "application/pdf"), filename);
    }}><Download size={17} /> Unduh berkas asli</button>
  </div>;
}
