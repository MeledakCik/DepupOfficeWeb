"use client";

import { ChevronDown, ChevronUp, Download, FileUp, Mic, Pause, Play, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { extension, getKind, type Tool } from "@/lib/catalog";
import { findProtectedDocument, protectedDocumentTitle } from "@/lib/protected-document";
import type { ToolValues } from "@/lib/tool-engine";
import {
  deleteSignature, download, formatSize, listDocuments, listSignatures, listVault, lockFile, putSignature,
  readDocument, removeVaultItem, unlockFile, type DocumentRecord, type Output, type Preferences, type SignatureItem, type VaultItem,
} from "@/lib/workspace";
import SignaturePad from "./signature-pad";
import Annotator from "./annotator";
import dynamic from "next/dynamic";
import { LocalImage } from "./media";
import ProtectedDocumentNotice from "./protected-document-notice";

const PdfOrganizer = dynamic(() => import("./pdf-organizer"), { ssr: false, loading: () => <p role="status">Memuat penyusun PDF…</p> });
const SignaturePreview = dynamic(() => import("./signature-preview"), { ssr: false, loading: () => <p role="status">Memuat pratinjau…</p> });

type Save = (output: Output) => Promise<unknown>;
type Field = { key: string; label: string; type?: string; choices?: [string, string][]; value?: string; placeholder?: string; required?: boolean; min?: number; max?: number };
const title = (placeholder: string, required = false): Field => ({ key: "title", label: "Judul", placeholder, required });
const body = (label: string, placeholder: string): Field => ({ key: "body", label, placeholder, type: "textarea", required: true });
const page: Field = { key: "page", label: "Halaman PDF", type: "number", value: "1", min: 1 };
const password: Field = { key: "password", label: "Kata sandi pembuka", type: "password", required: true };
const percentage = (key: string, label: string, value: string, min = 0, max = 100): Field => ({ key, label, type: "number", value, min, max });
const ranges = (required: boolean): Field => ({ key: "pages", label: "Urutan atau rentang halaman", placeholder: "1, 3-5, 2", required });
const fields: Record<string, Field[]> = {
  split: [ranges(true)],
  watermark: [body("Teks watermark", "Contoh: Salinan internal"),
    { key: "placement", label: "Letak watermark", choices: [["diagonal", "Diagonal"], ["center", "Tengah"], ["footer", "Bawah"]] },
    { key: "watermarkColor", label: "Warna watermark", choices: [["default", "Abu gelap"], ["red", "Merah"], ["blue", "Biru"]] },
    percentage("opacity", "Kejelasan watermark (%)", "25", 5, 100)],
  number: [title("Judul di bagian atas, opsional"),
    { key: "sequence", label: "Format penomoran", choices: [["total", "Hal. X dari Y"], ["page", "Halaman X"], ["number", "Hanya angka"]] },
    { key: "position", label: "Posisi nomor", choices: [["center", "Tengah bawah"], ["right", "Kanan bawah"], ["left", "Kiri bawah"]] },
    { key: "skipCover", label: "Lewati halaman sampul pertama", type: "checkbox" }],
  compress: [{ key: "target", label: "Target ukuran maksimum (KB)", type: "number", min: 10, max: 200000, value: "500" },
    { key: "raster", label: "Boleh ubah halaman menjadi gambar jika perlu", type: "checkbox" }],
  "pdf-word": [{ key: "layout", label: "Metode ekspor", choices: [["editable", "Teks yang dapat diedit"], ["visual", "Tampilan asli sebagai gambar"]] }],
  "batch-watermark": [body("Teks watermark", "Contoh: Nama toko")],
  "image-compress": [percentage("quality", "Kualitas JPEG (%)", "75", 10)],
  "id-photo": [{ key: "format", label: "Ukuran pasfoto", choices: [["3x4", "3×4 cm"], ["2x3", "2×3 cm"], ["4x6", "4×6 cm"]] },
    { key: "color", label: "Ganti latar putih", choices: [["#ffffff", "Biarkan"], ["#c52832", "Merah"], ["#2763c8", "Biru"]] }],
  chart: [title("Judul grafik"), { key: "format", label: "Jenis grafik", choices: [["bar", "Batang"], ["line", "Garis"], ["pie", "Lingkaran"]] }],
  sign: [page, percentage("scale", "Lebar tanda tangan (%)", "24", 5, 100), percentage("x", "Posisi dari kiri (%)", "65"),
    percentage("y", "Posisi dari atas (%)", "80"), percentage("angle", "Putaran (°)", "0", -180, 180),
    { key: "ink", label: "Warna tanda tangan", choices: [["", "Warna asli"], ["#151515", "Hitam"], ["#1754b4", "Biru"], ["#ad1f1f", "Merah"]] }],
  protect: [password, { key: "restrict", label: "Batasi cetak, salin, dan ubah di pembaca PDF yang mematuhi izin", type: "checkbox" }],
  unlock: [password],
  barcode: [title("Nama produk", true), { key: "price", label: "Harga (Rp)", type: "number", required: true, min: 0 }, { key: "code", label: "Isi barcode", required: true }],
  note: [title("Judul catatan"), body("Isi catatan", "Tulis catatan Anda di sini…")],
  invoice: [title("Nama toko atau judul nota"), { key: "customer", label: "Nama pelanggan" }, { key: "date", label: "Tanggal", type: "date" },
    { key: "discount", label: "Potongan (Rp)", type: "number", min: 0 }, body("Daftar barang", "Barang | Jumlah | Harga\nBuku tulis | 2 | 15000")],
  catalog: [title("Judul katalog"), body("Deskripsi produk per baris", "Satu deskripsi untuk setiap foto, sesuai urutan.")],
  planner: [title("Judul agenda"), body("Agenda per baris", "Tanggal | Waktu | Agenda | Status\n21-11-2026 | 09.00 | Rapat panitia | Direncanakan")],
  summary: [{ key: "count", label: "Jumlah poin", type: "number", value: "5", min: 1, max: 20 }],
};

function ToolField({ field, value, change }: { field: Field; value: string | boolean | undefined; change: (value: string | boolean) => void }) {
  const { label, type, choices, placeholder, required, min, max } = field;
  if (type === "checkbox") return <label className="check-label"><input type="checkbox" checked={Boolean(value)} onChange={(event) => change(event.target.checked)} />{label}</label>;
  return <label>{label}{choices ? <select value={String(value ?? "")} onChange={(event) => change(event.target.value)}>
    {choices.map(([key, text]) => <option value={key} key={key}>{text}</option>)}
  </select> : type === "textarea" ? <textarea rows={5} value={String(value ?? "")} placeholder={placeholder} onChange={(event) => change(event.target.value)} required={required} />
    : <input type={type ?? "text"} value={String(value ?? "")} placeholder={placeholder} onChange={(event) => change(event.target.value)} required={required} min={min} max={max} autoComplete={type === "password" ? "off" : undefined} />}</label>;
}

function UploadField({ accept, multiple, change, label = "Pilih berkas" }: { accept?: string; multiple?: boolean; change: (files: File[]) => void; label?: string }) {
  return <label className="upload-area"><FileUp size={23} />{label}
    <input aria-label={label} type="file" accept={accept} multiple={multiple} onChange={(event) => {
      const items = Array.from(event.target.files ?? []);
      if (items.length) change(items);
      event.target.value = "";
    }} /></label>;
}

function useLibrary() {
  const [items, setItems] = useState<SignatureItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void listSignatures().then(setItems).catch(() => setError("Pustaka tidak dapat dibuka.")); }, []);
  return { items, setItems, error, setError };
}

function SignatureLibrary({ apply }: { apply?: (blob: Blob) => void }) {
  const { items, setItems, error, setError } = useLibrary();
  const [drawing, setDrawing] = useState<Blob>();
  const [name, setName] = useState("");
  async function add(blob: Blob, label: string) {
    try {
      const item = { id: crypto.randomUUID(), name: label, blob };
      await putSignature(item);
      setItems((previous) => [...previous, item]);
      setName(""); setDrawing(undefined);
    } catch { setError("Tanda tangan gagal disimpan."); }
  }
  return <div className="stack">
    {items.map((item) => <div className="output-row" key={item.id}><span>{item.name}</span>
      {apply && <button type="button" className="button secondary" onClick={() => apply(item.blob)}>Gunakan</button>}
      <button type="button" className="icon-button" title="Unduh" aria-label={"Unduh " + item.name} onClick={() => download(item.blob, item.name + ".png")}><Download size={17} /></button>
      {!apply && <button type="button" className="icon-button" aria-label={"Hapus " + item.name} onClick={async () => {
        try { await deleteSignature(item.id); setItems((previous) => previous.filter(({ id }) => id !== item.id)); }
        catch { setError("Tanda tangan gagal dihapus."); }
      }}><Trash2 size={17} /></button>}
    </div>)}
    {(!apply || !items.length) && <p className="notice">{items.length ? "Tanda tangan dan stempel tersimpan di browser ini." : "Belum ada tanda tangan atau stempel tersimpan."}</p>}
    {!apply && <>
      <UploadField accept="image/*" label="Impor tanda tangan atau stempel" change={async ([image]) => {
        try {
          const { loadImage, imageBlob } = await import("@/lib/imaging");
          await add(await imageBlob(await loadImage(image), "image/png"), image.name.replace(/\.[^.]+$/, ""));
        } catch { setError("Gambar tanda tangan tidak dapat dibuka."); }
      }} />
      <SignaturePad onChange={setDrawing} />
      <label>Nama tanda tangan<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <button type="button" disabled={!drawing || !name.trim()} className="button primary" onClick={() => drawing && void add(drawing, name.trim())}>Simpan ke pustaka</button>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}

function Vault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [file, setFile] = useState<File>();
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<VaultItem>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { void listVault().then(setItems).catch(() => setError("Brankas tidak dapat dibuka.")); }, []);
  return <div className="stack">
    <p className="notice">Gunakan kata sandi minimal 8 karakter. Nama dan isi berkas disimpan dalam bentuk terenkripsi.</p>
    <UploadField change={([item]) => { setFile(item); setSelected(undefined); setSecret(""); }} label={file?.name ?? "Pilih berkas untuk dikunci"} />
    {(file || selected) && <form className="stack" onSubmit={async (event) => {
      event.preventDefault(); setWorking(true); setError(""); setStatus("");
      try {
        if (selected) {
          const output = await unlockFile(selected, secret);
          download(output.blob, output.name); setSelected(undefined); setStatus("Salinan berkas diunduh.");
        } else if (file) {
          await lockFile(file, secret); setFile(undefined); setItems(await listVault()); setStatus("Berkas ditambahkan ke Brankas.");
        }
        setSecret("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Berkas gagal diproses."); }
      finally { setWorking(false); }
    }}>
      <label>Kata sandi<input autoComplete="off" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} required /></label>
      <button className="button primary" disabled={working}>{working ? "Memproses…" : selected ? "Buka dan unduh" : "Enkripsi & simpan"}</button>
    </form>}
    {items.map((item, index) => <div className="output-row" key={item.id}>
      <span>Berkas terkunci {items.length - index} · {formatSize(item.size)}<small className="block-muted">{new Date(item.date).toLocaleString("id-ID")}</small></span>
      <button type="button" className="button secondary" onClick={() => { setSelected(item); setSecret(""); setFile(undefined); }}>Buka</button>
      <button type="button" className="icon-button" aria-label={"Hapus berkas terkunci " + (items.length - index)} onClick={async () => {
        if (!window.confirm("Hapus berkas terkunci dari Brankas?")) return;
        try { await removeVaultItem(item.id); setItems(await listVault()); if (selected?.id === item.id) setSelected(undefined); }
        catch { setError("Berkas gagal dihapus."); }
      }}><Trash2 size={17} /></button></div>)}
    {!items.length && <p className="notice">Brankas masih kosong.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {status && <p className="success" role="status">{status}</p>}
  </div>;
}

export function OutputResults({ outputs, save }: { outputs: Output[]; save: Save }) {
  const [saved, setSaved] = useState<Set<Output>>(() => new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function preserve(entries: Output[]) {
    setBusy(true); setError("");
    try {
      for (const item of entries) {
        if (saved.has(item)) continue;
        await save(item);
        setSaved((previous) => new Set([...previous, item]));
      }
    } catch { setError("Hasil gagal disimpan ke ruang kerja. Anda dapat mengunduhnya."); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    {outputs.length <= 3 && <div className="output-previews">
      {outputs.filter(({ blob }) => blob.type.startsWith("image/")).map((output, index) => <LocalImage key={output.name + index} blob={output.blob} alt={output.name} />)}
    </div>}
    {outputs.map((output, index) => <div className="output-row" key={output.name + index}>
      <span><strong>{output.name}</strong><small className="block-muted">{formatSize(output.blob.size)}</small></span>
      <button type="button" className="button secondary" title="Unduh hasil" onClick={() => download(output.blob, output.name)}><Download size={16} /> Unduh</button>
      <button type="button" className="button secondary" title="Simpan ke ruang kerja" disabled={busy || saved.has(output)} onClick={() => void preserve([output])}><Save size={16} /> {saved.has(output) ? "Tersimpan" : "Simpan"}</button>
    </div>)}
    {outputs.length > 1 && <div className="actions">
      <button type="button" className="button secondary" disabled={busy || outputs.every((item) => saved.has(item))} onClick={() => void preserve(outputs)}>Simpan semua</button>
      <button type="button" className="button secondary" onClick={async () => {
        const { default: Zip } = await import("jszip");
        const zip = new Zip();
        for (const [index, item] of outputs.entries()) zip.file(zip.file(item.name) ? (index + 1) + "-" + item.name : item.name, item.blob);
        download(await zip.generateAsync({ type: "blob" }), "Hasil-Depup.zip");
      }}>Unduh ZIP</button>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}

function speechParts(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/).flatMap((part) => part.match(/.{1,220}(?:\s|$)|.{1,220}/g) ?? []).map((part) => part.trim()).filter(Boolean);
}

export function VoiceControls({ text }: { text: string }) {
  const [rate, setRate] = useState("1");
  const [language, setLanguage] = useState("id-ID");
  const [status, setStatus] = useState("");
  const active = useRef(false);
  useEffect(() => () => { active.current = false; window.speechSynthesis?.cancel(); }, [text]);
  function play() {
    const synthesis = window.speechSynthesis;
    if (!synthesis) { setStatus("Pembaca suara belum didukung browser ini."); return; }
    if (active.current && synthesis.paused) { synthesis.resume(); return; }
    synthesis.cancel();
    const messages = speechParts(text);
    active.current = true;
    function speak(index: number) {
      if (!active.current) return;
      if (index >= messages.length) { active.current = false; setStatus("Pembacaan selesai."); return; }
      const utterance = new SpeechSynthesisUtterance(messages[index]);
      utterance.lang = language; utterance.rate = Number(rate);
      const voices = synthesis.getVoices().filter((voice) => voice.localService);
      const voice = voices.find((voice) => voice.lang.startsWith(language.slice(0, 2)));
      if (voice) utterance.voice = voice;
      else { active.current = false; setStatus("Suara lokal untuk bahasa pilihan belum tersedia."); return; }
      utterance.onend = () => speak(index + 1);
      utterance.onerror = () => { if (active.current) setStatus("Pembacaan berhenti. Periksa suara perangkat."); active.current = false; };
      setStatus("Bagian " + (index + 1) + " dari " + messages.length);
      synthesis.speak(utterance);
    }
    speak(0);
  }
  return <div className="stack"><div className="form-grid">
    <label>Kecepatan<select value={rate} onChange={(event) => setRate(event.target.value)}>{["0.75", "1", "1.25", "1.5", "2"].map((speed) => <option key={speed}>{speed}</option>)}</select></label>
    <label>Bahasa<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="id-ID">Indonesia</option><option value="en-US">Inggris</option></select></label></div>
    <div className="actions"><button type="button" className="button primary" onClick={play}><Play size={17} /> Baca</button>
      <button type="button" className="button secondary" onClick={() => window.speechSynthesis?.pause()}><Pause size={17} /> Jeda</button>
      <button type="button" className="button secondary" onClick={() => { active.current = false; window.speechSynthesis?.cancel(); setStatus(""); }}><Square size={16} /> Berhenti</button></div>
    {status && <p className="notice" role="status"><Mic size={17} /> {status}</p>}
  </div>;
}

export default function ToolPanel({ tool, initialFiles = [], save, preferences, notify }: {
  tool: Tool; initialFiles?: File[]; save: Save; preferences: Preferences; notify: (message: string) => void;
}) {
  const id = tool.id;
  const [files, setFiles] = useState(initialFiles);
  const [inspection, setInspection] = useState<{ files: File[]; protectedFile?: File; failed?: boolean }>();
  const [signature, setSignature] = useState<Blob>();
  const [values, setValues] = useState<ToolValues>(() => Object.fromEntries((fields[id] ?? []).map((field) => [field.key, field.value ?? field.choices?.[0]?.[0]])));
  const [result, setResult] = useState<{ text?: string; outputs?: Output[] }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const needsUpload = tool.accept !== undefined || (id === "qr" && values.action === "scan") || id === "invoice";
  const accept = id === "qr" || id === "invoice" ? "image/*" : tool.accept;
  const requireUpload = needsUpload && id !== "invoice";
  const operativeFields = id === "qr" && values.action !== "scan" ? [body("Teks atau tautan", "Masukkan isi QR")] : fields[id] ?? [];
  const fileName = files[0]?.name;
  const checksFiles = id !== "share" && id !== "export" && files.length > 0;

  useEffect(() => {
    if (!checksFiles) return;
    let active = true;
    void findProtectedDocument(files).then((protectedFile) => {
      if (active) setInspection({ files, protectedFile });
    }).catch(() => {
      if (active) setInspection({ files, failed: true });
    });
    return () => { active = false; };
  }, [files, checksFiles]);

  useEffect(() => {
    if (!needsUpload) return;
    void listDocuments().then(setDocuments).catch(() => {});
  }, [needsUpload]);

  function setOption(key: string, value: boolean | string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setResult(undefined); setError("");
  }

  const acceptsFile = (file: DocumentRecord) => !accept || accept.split(",").some((value) => value === "." + extension(file.name) || (value === "image/*" && getKind(file.name, file.mime) === "image"));
  function changeFiles(items: File[]) {
    setFiles((previous) => tool.multiple ? [...previous, ...items] : items);
    setResult(undefined); setError("");
  }

  async function addExisting(id: string) {
    if (!id) return;
    try {
      const item = await readDocument(id);
      changeFiles([new File([item.data], item.name, { type: item.mime })]);
    } catch { setError("Berkas dari ruang kerja tidak dapat dibuka."); }
  }

  function reorder(index: number, next: number) {
    setFiles((previous) => {
      const ordered = [...previous];
      const [item] = ordered.splice(index, 1);
      ordered.splice(next, 0, item);
      return ordered;
    });
    setResult(undefined);
  }

  if (id === "signatures") return <SignatureLibrary />;
  if (id === "vault") return <Vault />;
  if (checksFiles && inspection?.files !== files) return <p className="notice" role="status">Memeriksa jenis berkas…</p>;
  if (checksFiles && (inspection?.protectedFile || inspection?.failed)) {
    const protectedFile = inspection.protectedFile;
    return <div className="stack">
      {protectedFile ? <>
        <h3>{protectedDocumentTitle}</h3>
        <ProtectedDocumentNotice name={protectedFile.name} data={protectedFile} />
      </> : <p className="error" role="alert">Berkas gagal diperiksa.</p>}
      <button type="button" className="button secondary" onClick={() => {
        setFiles(protectedFile ? files.filter((file) => file !== protectedFile) : []);
      }}>{files.length > 1 && protectedFile ? "Lepas berkas terlindungi" : "Pilih berkas lain"}</button>
    </div>;
  }

  const area: ReactNode = needsUpload && <>
    <UploadField accept={accept} multiple={tool.multiple} change={changeFiles} label={id === "invoice" ? (fileName ?? "Tambahkan logo atau stempel (opsional)") : "Pilih berkas dari perangkat"} />
    {documents.some(acceptsFile) && <label>Pilih dari ruang kerja<select value="" onChange={(event) => void addExisting(event.target.value)}>
      <option value="">Pilih berkas tersimpan…</option>{documents.filter(acceptsFile).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
    {files.map((file, index) => <div className="order-row" key={file.name + index}><span>{file.name} <small className="block-muted">{formatSize(file.size)}</small></span>
      {tool.multiple && <><button type="button" className="icon-button" aria-label={"Naikkan " + file.name} disabled={index === 0} onClick={() => reorder(index, index - 1)}><ChevronUp size={18} /></button>
        <button type="button" className="icon-button" aria-label={"Turunkan " + file.name} disabled={index === files.length - 1} onClick={() => reorder(index, index + 1)}><ChevronDown size={18} /></button></>}
      <button type="button" className="icon-button" aria-label={"Lepas " + file.name} onClick={() => { setFiles((previous) => previous.filter((_, i) => i !== index)); setResult(undefined); }}><Trash2 size={17} /></button>
    </div>)}
  </>;

  if (id === "annotate") return <div className="stack">{files.length === 0 ? area : <Annotator file={files[0]} save={save} reset={() => setFiles([])} />}</div>;
  if (id === "organize") return <div className="stack">{files.length === 0 ? area : <PdfOrganizer file={files[0]} save={save} reset={() => setFiles([])} />}</div>;

  return <div className="stack">
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault(); setError(""); setResult(undefined); setBusy("Memproses berkas…");
      try {
        const { runTool } = await import("@/lib/tool-engine");
        setResult(await runTool(id, files, values, preferences, setBusy, signature));
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Berkas gagal diproses.");
      } finally { setBusy(""); }
    }}>
      <p className="tool-description">{tool.description}</p>
      <fieldset className="stack tool-fields" disabled={Boolean(busy)}>
        {id === "qr" && <div className="segmented">
          <button type="button" aria-pressed={values.action !== "scan"} onClick={() => setOption("action", "generate")}>Buat QR</button>
          <button type="button" aria-pressed={values.action === "scan"} onClick={() => setOption("action", "scan")}>Pindai foto</button>
        </div>}
        {id === "qr" && values.action === "scan" && <details><summary>Ambil foto kode</summary><input aria-label="Kamera untuk memindai kode" type="file" accept="image/*" capture="environment" onChange={(event) => {
          const item = event.target.files?.[0]; if (item) changeFiles([item]);
        }} /></details>}
        {area}
        {id === "compress" && <div className="chips" aria-label="Target ukuran cepat">
          {["200", "500", "1024"].map((target) => <button type="button" key={target} aria-pressed={values.target === target} onClick={() => setOption("target", target)}>
            {target === "1024" ? "1 MB" : target + " KB"}
          </button>)}
        </div>}
        {id === "watermark" && <div className="chips" aria-label="Teks watermark cepat">
          {["RAHASIA", "DRAFT", "LUNAS"].map((text) => <button type="button" key={text} aria-pressed={values.body === text} onClick={() => setOption("body", text)}>{text}</button>)}
        </div>}
        {operativeFields.map((field) => <ToolField key={field.key} field={field} value={values[field.key]} change={(value) => setOption(field.key, value)} />)}
        {id === "sign" && <>
          <SignaturePad onChange={setSignature} />
          <UploadField accept="image/*" label="Unggah gambar tanda tangan" change={([file]) => setSignature(file)} />
          <details><summary>Pakai tanda tangan dari pustaka</summary><SignatureLibrary apply={setSignature} /></details>
          {signature && <>
            <p className="success">Tanda tangan siap ditempel.</p>
            {files[0] && <SignaturePreview file={files[0]} signature={signature} values={{
              page: Number(values.page ?? 1), scale: Math.min(100, Math.max(5, Number(values.scale || 24))),
              x: Math.min(100, Math.max(0, Number(values.x ?? 65))), y: Math.min(100, Math.max(0, Number(values.y ?? 80))),
              angle: Number(values.angle || 0), ink: String(values.ink || ""),
            }} onMove={(x, y) => {
              if (busy) return;
              setValues((previous) => ({ ...previous, x: String(x), y: String(y) })); setResult(undefined); setError("");
            }} />}
          </>}
        </>}
        <button className="button primary" disabled={Boolean(busy) || (requireUpload && !files.length)}>
          {busy || ({ share: "Bagikan", export: "Unduh berkas", print: "Cetak", voice: "Muat teks", qr: values.action === "scan" ? "Pindai kode" : "Buat kode QR" })[id] || "Proses berkas"}
        </button>
      </fieldset>
    </form>
    {busy && <p className="notice" role="status">{busy}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!!result?.text && <>
      <p className="notice result-text">{result.text}</p>
      {id === "voice" ? <VoiceControls text={result.text} /> : <button className="text-button" onClick={async () => {
        try { await navigator.clipboard.writeText(result.text ?? ""); notify("Teks disalin."); }
        catch { setError("Akses papan klip tidak tersedia."); }
      }}>Salin teks</button>}
    </>}
    {!!result?.outputs?.length && <OutputResults key={result.outputs[0].name} outputs={result.outputs} save={save} />}
    {result && <button type="button" className="text-button" onClick={() => { setResult(undefined); setError(""); }}><RotateCcw size={16} /> Bersihkan hasil</button>}
  </div>;
}
