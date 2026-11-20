"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Download, FileText, ImagePlus, Italic, List, ListOrdered, Printer, Redo2, Save, Search, Table2, Underline, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { baseName } from "@/lib/catalog";
import { readWord, sanitizeHtml, writeWord } from "@/lib/office";
import { wordTemplate } from "@/lib/templates";
import { download, type Output, type Preferences, type StoredDocument } from "@/lib/workspace";

type EditorProps = { record?: StoredDocument; template?: string; preferences: Preferences; save: (output: Output) => Promise<unknown> };
const actions = [
  ["bold", "Tebal", Bold], ["italic", "Miring", Italic], ["underline", "Garis bawah", Underline],
  ["justifyLeft", "Rata kiri", AlignLeft], ["justifyCenter", "Rata tengah", AlignCenter], ["justifyRight", "Rata kanan", AlignRight],
  ["insertUnorderedList", "Daftar poin", List], ["insertOrderedList", "Daftar nomor", ListOrdered],
  ["undo", "Urungkan", Undo2], ["redo", "Ulangi", Redo2],
] as const;

export default function WordEditor({ record, template, preferences, save }: EditorProps) {
  const [templateName, templateHtml] = wordTemplate(template);
  const [name, setName] = useState(record ? baseName(record.name) : templateName.replace(/\//g, "-"));
  const [count, setCount] = useState({ words: 0, characters: 0 });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [ready, setReady] = useState(false);
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const selection = useRef<Range | null>(null);
  const autosave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraft = useRef<string | undefined>(undefined);
  const draftId = "depup-word-draft:" + (record?.id ?? template ?? "blank");

  function updateCount() {
    const text = stage.current?.innerText.trim() ?? "";
    setCount({ words: text ? text.split(/\s+/).length : 0, characters: text.length });
  }
  useEffect(() => {
    let active = true;
    void (record ? readWord(record.data, record.name) : Promise.resolve(templateHtml)).then((html) => {
      if (!active || !stage.current) return;
      stage.current.innerHTML = html || "<p><br></p>";
      setReady(true);
      updateCount();
      try { setHasDraft(Boolean(localStorage.getItem(draftId))); } catch {}
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Dokumen tidak dapat dibuka."); });
    return () => { active = false; };
  }, [record, templateHtml, draftId]);

  useEffect(() => {
    function changed() {
      const current = window.getSelection();
      if (current?.rangeCount && stage.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
    }
    document.addEventListener("selectionchange", changed);
    return () => {
      document.removeEventListener("selectionchange", changed);
      clearTimeout(autosave.current);
      if (pendingDraft.current) {
        try { localStorage.setItem(draftId, pendingDraft.current); } catch {}
      }
    };
  }, [draftId]);

  function changed() {
    updateCount();
    setStatus("");
    clearTimeout(autosave.current);
    const html = stage.current?.innerHTML;
    if (!html) return;
    pendingDraft.current = JSON.stringify({ name, html });
    autosave.current = setTimeout(() => {
      try { if (pendingDraft.current) localStorage.setItem(draftId, pendingDraft.current); }
      catch { /* Large documents remain editable and can be saved or downloaded. */ }
    }, 250);
  }
  function focus() {
    stage.current?.focus();
    const current = window.getSelection();
    if (selection.current && stage.current?.contains(selection.current.commonAncestorContainer)) {
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
  }
  function command(action: string, value?: string) {
    if (!ready) return;
    focus();
    document.execCommand(action, false, value);
    changed();
  }
  async function insertImage(file: File) {
    try {
      const { loadImage, imageBlob } = await import("@/lib/imaging");
      const blob = await imageBlob(await loadImage(file, 1180));
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject; reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob);
      });
      command("insertImage", data);
    } catch { setError("Gambar tidak dapat dimasukkan."); }
  }
  function replace(all: boolean) {
    const element = stage.current;
    if (!element || !find) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let found = 0;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue ?? "";
      if (!value.includes(find)) continue;
      if (all) {
        const parts = value.split(find);
        found += parts.length - 1;
        node.nodeValue = parts.join(replacement);
      } else {
        const end = value.indexOf(find);
        const range = document.createRange();
        range.setStart(node, end); range.setEnd(node, end + find.length);
        selection.current = range;
        focus();
        (node.parentElement ?? element).scrollIntoView({ block: "nearest" });
        found++;
        break;
      }
    }
    if (all && found) changed();
    setStatus(found ? (all ? found + " bagian diganti." : "Teks ditemukan.") : "Teks tidak ditemukan.");
  }
  async function exportFile(action: "save" | "download" | "pdf" | "print") {
    if (!stage.current) return;
    setWorking(true); setError(""); setStatus("");
    try {
      const title = name.trim().replace(/[\\/:*?"<>|]/g, "-") || "Dokumen";
      if (action === "save" || action === "download") {
        const output = await writeWord(stage.current.innerHTML, title, preferences);
        if (action === "download") download(output.blob, output.name);
        else { await save(output); clearTimeout(autosave.current); pendingDraft.current = undefined; try { localStorage.removeItem(draftId); } catch {} setHasDraft(false); setStatus("Salinan DOCX tersimpan."); }
      } else {
        const [{ richOfficePdf, printPdf }, { pdfOutput }] = await Promise.all([import("@/lib/tool-engine"), import("@/lib/pdf")]);
        const output = pdfOutput(title, await richOfficePdf(await sanitizeHtml(stage.current.innerHTML), {
          letter: preferences.paper === "Letter", margin: preferences.margin === "narrow" ? 25 : 57, size: preferences.textSize, lineHeight: preferences.lineHeight,
        }));
        if (action === "print") await printPdf(output.blob);
        else { await save(output); setStatus("Salinan PDF tersimpan."); }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dokumen gagal diekspor."); }
    finally { setWorking(false); }
  }
  return <div className="stack">
    {!ready && !error && <p role="status" className="notice">Memuat dokumen…</p>}
    {hasDraft && <div className="actions"><button className="button secondary" onClick={async () => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftId) ?? "{}") as { name?: string; html?: string };
        if (stage.current && draft.html) stage.current.innerHTML = await sanitizeHtml(draft.html);
        if (draft.name) setName(draft.name);
        updateCount();
        setHasDraft(false);
      } catch { setError("Draf gagal dipulihkan."); }
    }}>Pulihkan draf</button><button className="button secondary" onClick={() => { try { localStorage.removeItem(draftId); } catch {} setHasDraft(false); }}>Abaikan draf</button></div>}
    {ready && <>
      <label>Nama dokumen<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="editor-toolbar" aria-label="Pemformatan teks">
        <select aria-label="Gaya paragraf" defaultValue="p" onChange={(event) => command("formatBlock", event.target.value)}><option value="p">Paragraf</option><option value="h1">Judul 1</option><option value="h2">Judul 2</option><option value="blockquote">Kutipan</option></select>
        <select aria-label="Font teks" defaultValue="Arial" onChange={(event) => command("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Courier New</option></select>
        {actions.map(([action, label, Icon]) => <button type="button" aria-label={label} title={label} key={action} onMouseDown={(event) => event.preventDefault()} onClick={() => command(action)}><Icon size={17} /></button>)}
        <input type="color" defaultValue="#171717" aria-label="Warna teks" onChange={(event) => command("foreColor", event.target.value)} />
        <button title="Sisipkan tabel" aria-label="Sisipkan tabel" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertHTML", '<table><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>')}><Table2 size={17} /></button>
        <button title="Sisipkan gambar" aria-label="Sisipkan gambar" onClick={() => imageInput.current?.click()}><ImagePlus size={17} /></button>
        <button title="Cari dan ganti" aria-label="Cari dan ganti" aria-pressed={finding} onClick={() => setFinding(!finding)}><Search size={17} /></button>
        <input className="sr-only" tabIndex={-1} ref={imageInput} type="file" accept="image/*" aria-label="Unggah gambar dokumen" onChange={(event) => {
          const image = event.target.files?.[0]; if (image) void insertImage(image); event.target.value = "";
        }} />
      </div>
    </>}
    {finding && <div className="form-grid"><label>Cari kata<input value={find} onChange={(event) => setFind(event.target.value)} /></label>
      <label>Ganti dengan<input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
      <div className="actions"><button className="button secondary" onClick={() => replace(false)}>Cari</button><button className="button secondary" onClick={() => replace(true)}>Ganti semua</button></div></div>}
    <div className="editor-stage" hidden={!ready}>
      <div ref={stage} className={"editor-sheet " + preferences.margin} role="textbox" aria-label="Isi dokumen" aria-multiline="true" contentEditable={ready}
        suppressContentEditableWarning style={{ fontSize: preferences.textSize + "pt", lineHeight: preferences.lineHeight, maxWidth: preferences.paper === "Letter" ? "816px" : "794px" }}
        onInput={changed} onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData("text/html");
          const text = event.clipboardData.getData("text/plain");
          if (html) void sanitizeHtml(html).then((safe) => command("insertHTML", safe));
          else command("insertText", text);
        }} onDrop={(event) => { event.preventDefault(); }} />
    </div>
    {ready && <div className="actions">
      <button className="button primary" disabled={working} onClick={() => void exportFile("save")}><Save size={17} /> Simpan DOCX</button>
      <button className="button secondary" disabled={working} onClick={() => void exportFile("download")}><Download size={17} /> Unduh DOCX</button>
      <button className="button secondary" disabled={working} onClick={() => void exportFile("pdf")}><FileText size={17} /> Simpan PDF</button>
      <button className="button secondary" disabled={working} onClick={() => void exportFile("print")}><Printer size={17} /> Cetak</button>
      <span className="notice" title={count.characters + " karakter"}>{count.words} kata</span>
    </div>}
    {record && <button className="text-button" onClick={() => download(record.data, record.name)}>Unduh dokumen asli</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {status && <p className="success" role="status">{status}</p>}
  </div>;
}
