"use client";

import { Camera, ChevronLeft, ChevronRight, Crop, Download, FlipHorizontal2, Images, RotateCcw, Save, ScanLine, ShieldCheck, Trash2, WandSparkles, Zap } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  adjust, canvasOf, context, detectPaper, fullCorners, imageBlob, loadImage, recognize, redactImage, straighten, transform,
  watermarkImage, type Corners, type Redaction, type ScanFilter,
} from "@/lib/imaging";
import { download, type Output, type Preferences } from "@/lib/workspace";
import { LocalImage } from "./media";
import { OutputResults } from "./tool-panel";
import ScanRedaction from "./scan-redaction";
import { SelectField } from "./select-box";

type Page = {
  key: string; source: Blob; thumbnail: Blob; corners: Corners; turned: number;
  flip: boolean; filter: ScanFilter; brightness: number; contrast: number; split: boolean;
  redactions: Redaction[];
};

async function prepare(blob: Blob): Promise<Page> {
  const canvas = await loadImage(blob);
  const source = await imageBlob(canvas, "image/jpeg", .93);
  const thumbnail = await imageBlob(await loadImage(source, 170));
  return { key: crypto.randomUUID(), source, thumbnail, corners: detectPaper(canvas), turned: 0, flip: false, filter: "natural", brightness: 0, contrast: 0, split: false, redactions: [] };
}

async function process(page: Page, max = 2100, watermark = "") {
  const input = await loadImage(page.source, max);
  const cropped = page.corners.every(({ x, y }, index) => x === fullCorners[index].x && y === fullCorners[index].y)
    ? input : straighten(input, page.corners);
  const canvas = transform(cropped, page.turned, page.flip);
  adjust(canvas, page.filter, page.brightness, page.contrast);
  if (page.redactions.length) redactImage(canvas, page.redactions);
  if (watermark.trim()) watermarkImage(canvas, watermark.trim());
  return canvas;
}

const cornerNames = ["kiri atas", "kanan atas", "kanan bawah", "kiri bawah"];
function CropFrame({ page, change }: { page: Page; change: (corners: Corners) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(-1);
  function place(index: number, x: number, y: number) {
    const left = index === 0 || index === 3;
    const top = index < 2;
    const coordinates = {
      x: Math.min(left ? .48 : 1, Math.max(left ? 0 : .52, x)),
      y: Math.min(top ? .48 : 1, Math.max(top ? 0 : .52, y)),
    };
    const next = [...page.corners] as Corners;
    next[index] = coordinates;
    change(next);
  }
  function pointer(event: PointerEvent<HTMLButtonElement>, index: number) {
    const rect = frame.current?.getBoundingClientRect();
    if (rect?.width && rect.height) place(index, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = keys[event.key as keyof typeof keys];
    if (!direction) return;
    event.preventDefault();
    const { x, y } = page.corners[index];
    place(index, x + direction[0] * .015, y + direction[1] * .015);
  }
  const polygon = page.corners.map(({ x, y }) => (x * 100) + "," + (y * 100)).join(" ");
  return <div className="crop-stage" ref={frame}>
    <LocalImage blob={page.source} alt="Foto asli untuk menentukan sudut dokumen" />
    <svg className="crop-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={polygon} /></svg>
    {page.corners.map(({ x, y }, index) => <button className="crop-corner" key={index} aria-label={"Geser sudut " + cornerNames[index]} style={{ left: x * 100 + "%", top: y * 100 + "%" }}
      onPointerDown={(event) => { dragging.current = index; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (dragging.current === index) pointer(event, index); }}
      onLostPointerCapture={() => { dragging.current = -1; }}
      onKeyDown={(event) => keyboard(event, index)} />)}
  </div>;
}

export default function Scanner({ save, preferences }: { save: (output: Output) => Promise<unknown>; preferences: Preferences }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [camera, setCamera] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [crop, setCrop] = useState(false);
  const [preview, setPreview] = useState<{ page: Page; image: Blob }>();
  const [redacting, setRedacting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [name, setName] = useState("Scan Depup");
  const [format, setFormat] = useState("pdf");
  const [wordMode, setWordMode] = useState<"text" | "photo">("text");
  const [paper, setPaper] = useState<"A4" | "Letter" | "photo" | "id">("A4");
  const [watermark, setWatermark] = useState("");
  const [searchable, setSearchable] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const cameraRequest = useRef(0);
  const captureTarget = useRef<string | undefined>(undefined);
  const stream = useRef<MediaStream | null>(null);
  const page = pages[activeIndex];
  const displayed = preview?.page === page ? preview?.image : undefined;

  useEffect(() => {
    if (camera && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camera]);
  useEffect(() => () => {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!page || crop) return;
    let current = true;
    const timer = setTimeout(() => {
      void process(page, 850, watermark).then((canvas) => imageBlob(canvas)).then((blob) => {
        if (current) setPreview({ page, image: blob });
      }).catch(() => { if (current) setError("Area potong tidak valid."); });
    }, 100);
    return () => { current = false; clearTimeout(timer); };
  }, [page, crop, watermark]);

  async function startCamera(target?: string) {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("Kamera memerlukan HTTPS atau localhost. Anda dapat mengambil foto lewat pemilih berkas."); return; }
    const run = ++cameraRequest.current;
    try {
      let next: MediaStream;
      try {
        next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
      } catch (cause) {
        if (run !== cameraRequest.current) return;
        if (!(cause instanceof DOMException) || !["AbortError", "NotFoundError", "NotReadableError", "OverconstrainedError"].includes(cause.name)) throw cause;
        next = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (run !== cameraRequest.current) { next.getTracks().forEach((track) => track.stop()); return; }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = next;
      captureTarget.current = target;
      const capabilities = next.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean | boolean[] }) | undefined;
      setTorchAvailable(capabilities?.torch === true || (Array.isArray(capabilities?.torch) && capabilities.torch.includes(true)));
      setTorchEnabled(false);
      setCamera(true);
    } catch { if (run === cameraRequest.current) setError("Kamera belum dapat diakses. Periksa izin perangkat atau pilih foto."); }
  }

  function stopCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    captureTarget.current = undefined;
    setTorchAvailable(false); setTorchEnabled(false);
    setCamera(false);
  }

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchEnabled;
    try {
      const torch: MediaTrackConstraintSet & { torch: boolean } = { torch: next };
      await track.applyConstraints({ advanced: [torch] });
      if (stream.current?.getVideoTracks()[0] !== track) return;
      const settings = track.getSettings() as MediaTrackSettings & { torch?: boolean };
      if (settings.torch !== undefined && settings.torch !== next) throw new Error();
      setTorchEnabled(next); setError("");
    } catch { setError("Lampu kamera tidak dapat diubah."); }
  }

  async function add(blobs: Blob[]) {
    if (!blobs.length) return;
    setStatus("Menyiapkan foto…"); setError(""); setText(""); setOutputs([]);
    const prepared: Page[] = [];
    for (const blob of blobs) {
      try { prepared.push(await prepare(blob)); }
      catch { setError("Sebagian foto tidak dapat dibuka. Gunakan JPG, PNG, atau WebP."); }
    }
    if (prepared.length) {
      setActiveIndex(pages.length);
      setPages((previous) => [...previous, ...prepared]);
      setCrop(false); setRedacting(false);
    }
    setStatus("");
  }

  async function takePhoto() {
    const preview = video.current;
    if (!preview?.videoWidth) { setError("Tunggu kamera siap."); return; }
    const target = captureTarget.current;
    setStatus("Menyiapkan foto…"); setError("");
    try {
      const canvas = canvasOf(preview.videoWidth, preview.videoHeight);
      context(canvas).drawImage(preview, 0, 0);
      const blob = await imageBlob(canvas);
      if (target) {
        await replacePhoto(target, blob);
        stopCamera();
      } else {
        stopCamera();
        await add([blob]);
      }
    } catch { setError("Foto gagal diambil."); }
    finally { setStatus(""); }
  }

  async function replacePhoto(target: string, blob: Blob) {
    setStatus("Menyiapkan foto pengganti…"); setError("");
    try {
      const replacement = await prepare(blob);
      setPages((previous) => previous.map((item) => item.key === target ? { ...replacement, key: target } : item));
      setPreview(undefined); setCrop(false); setRedacting(false); setText(""); setOutputs([]);
    } catch { setError("Foto pengganti tidak dapat dibuka. Gunakan JPG, PNG, atau WebP."); }
    finally { setStatus(""); }
  }

  function update(changes: Partial<Page>) {
    setPages((previous) => previous.map((item, index) => index === activeIndex ? { ...item, ...changes } : item));
    setOutputs([]); setText(""); setError("");
  }

  function switchPage(index: number) {
    if (index !== activeIndex) setPreview(undefined);
    setActiveIndex(index); setCrop(false); setRedacting(false); setText("");
  }
  function movePage(next: number) {
    const list = [...pages]; const [item] = list.splice(activeIndex, 1); list.splice(next, 0, item);
    setPages(list); setActiveIndex(next); setOutputs([]);
  }

  function rotatePage() {
    if (!page) return;
    update({ turned: (page.turned + 90) % 360, redactions: page.redactions.map((area) => ({
      x: 1 - area.y - area.height, y: area.x, width: area.height, height: area.width,
    })) });
  }

  function flipPage() {
    if (!page) return;
    const vertical = page.turned % 180 !== 0;
    update({ flip: !page.flip, redactions: page.redactions.map((area) => vertical
      ? { ...area, y: 1 - area.y - area.height }
      : { ...area, x: 1 - area.x - area.width }) });
  }

  function addRedaction(area: Redaction) {
    if (page) update({ redactions: [...page.redactions, area] });
  }

  async function exportFiles() {
    setStatus("Membuat hasil scan…"); setError(""); setOutputs([]);
    try {
      const title = name.trim() || "Scan Depup";
      const images: Blob[] = [];
      for (const item of pages) {
        const canvas = await process(item, 2100, watermark);
        if (item.split) {
          const half = Math.ceil(canvas.width / 2);
          for (const x of [0, half]) {
            const width = canvas.width - x < half ? canvas.width - x : half;
            const part = canvasOf(width, canvas.height);
            context(part).drawImage(canvas, x, 0, width, canvas.height, 0, 0, width, canvas.height);
            images.push(await imageBlob(part));
          }
        } else images.push(await imageBlob(canvas));
      }
      if (format === "jpg") setOutputs(images.map((blob, index) => ({ name: title + (images.length === 1 ? "" : "-" + (index + 1)) + ".jpg", blob })));
      else if (format === "docx") {
        const { scannedWord } = await import("@/lib/office");
        setOutputs([await scannedWord(images, title, wordMode, preferences, setStatus)]);
      } else {
        const { imagesPdf, pdfOutput } = await import("@/lib/pdf");
        if (paper === "id") {
          if (images.length !== 2) throw new Error("Tata letak KTP memerlukan dua foto, masing-masing untuk sisi depan dan belakang.");
          const { PDFDocument } = await import("pdf-lib");
          const doc = await PDFDocument.create();
          const page = doc.addPage([595.28, 841.89]);
          for (let index = 0; index < images.length; index++) {
            const image = await doc.embedJpg(await images[index].arrayBuffer());
            const box = image.scaleToFit(242.65, 153);
            page.drawImage(image, { x: (595.28 - box.width) / 2, y: 623 - index * 195, ...box });
          }
          setOutputs([pdfOutput(title, await doc.save())]);
        } else setOutputs([pdfOutput(title, await imagesPdf(images, paper, searchable, setStatus))]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hasil scan gagal dibuat."); }
    finally { setStatus(""); }
  }

  async function getText() {
    if (!page) return;
    setStatus("Menyiapkan OCR…"); setText(""); setError("");
    try {
      const result = await recognize(await imageBlob(await process(page)), setStatus);
      if (!result) setError("Tidak ada teks yang dikenali.");
      else setText(result);
    } catch { setError("OCR tidak dapat diproses. Coba ulang pada foto yang lebih jelas."); }
    finally { setStatus(""); }
  }

  return <div className="scan-layout">
    <section className="panel scanner-panel stack">
      <div className="actions">
        <button className="button primary" disabled={!!status} onClick={() => camera ? stopCamera() : void startCamera()}><Camera size={18} />{camera ? "Tutup kamera" : "Aktifkan kamera"}</button>
        <label className="button secondary file-label"><Images size={18} /> Pilih foto<input type="file" accept="image/*" multiple aria-label="Pilih foto" disabled={!!status}
          onChange={(event) => { void add(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
        <label className="button secondary file-label mobile-camera"><Camera size={18} /> Ambil foto<input type="file" accept="image/*" capture="environment" aria-label="Ambil foto perangkat" disabled={!!status}
          onChange={(event) => { void add(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
      </div>
      {camera ? <div className="stack">
        <div className="media-stage"><video ref={video} autoPlay muted playsInline aria-label="Pratinjau kamera" /></div>
        <div className="actions">
          <button className="button primary" disabled={!!status} onClick={() => void takePhoto()}><Camera size={18} /> Ambil halaman</button>
          {torchAvailable && <button className="button secondary" aria-pressed={torchEnabled} disabled={!!status} onClick={() => void toggleTorch()}><Zap size={17} /> Lampu kamera</button>}
        </div>
      </div> : page ? <>
        <div className="media-stage">
          {crop ? <CropFrame page={page} change={(corners) => update({ corners })} /> : displayed
            ? <ScanRedaction image={displayed} editing={redacting && !status} add={addRedaction} />
            : <p className="notice" role="status">{error || "Menyiapkan pratinjau…"}</p>}
        </div>
        <div className="actions">
          <button className="button secondary" aria-pressed={crop} disabled={!!status || !!page.redactions.length} onClick={() => { setCrop(!crop); setRedacting(false); }}><Crop size={17} /> {crop ? "Terapkan potong" : "Potong"}</button>
          {crop ? <>
            <button className="button secondary" onClick={async () => update({ corners: detectPaper(await loadImage(page.source)) })}><WandSparkles size={17} /> Deteksi sudut</button>
            <button className="button secondary" onClick={() => update({ corners: fullCorners })}>Pakai foto penuh</button>
          </> : <>
            <button className="icon-button" aria-label="Putar halaman" disabled={!!status} onClick={rotatePage}><RotateCcw size={18} /></button>
            <button className="icon-button" aria-label="Balik halaman" disabled={!!status} onClick={flipPage}><FlipHorizontal2 size={18} /></button>
            <button className="button secondary" disabled={!!status} onClick={() => void getText()}><ScanLine size={18} /> Ambil teks</button>
            <button className="button secondary" aria-pressed={redacting} disabled={!!status || !displayed} onClick={() => { setRedacting(!redacting); setText(""); }}><ShieldCheck size={17} /> Sensur data</button>
          </>}
        </div>
        {crop && <p className="notice">Geser keempat sudut ke tepi kertas. Tombol panah pada keyboard juga dapat menggeser sudut.</p>}
        {redacting && <>
          <p className="notice">Gambar kotak pada area yang ingin ditutup. Sensur diterapkan pada hasil ekspor dan OCR.</p>
          <details><summary>Atur kotak dengan angka</summary>
            <form className="stack" onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              const x = Number(fields.get("x")) / 100;
              const y = Number(fields.get("y")) / 100;
              const width = Number(fields.get("width")) / 100;
              const height = Number(fields.get("height")) / 100;
              if (x + width > 1 || y + height > 1) { setError("Kotak sensur harus berada di dalam halaman."); return; }
              addRedaction({ x, y, width, height });
            }}>
              <div className="form-grid">
                <label>Dari kiri (%)<input name="x" type="number" min="0" max="99" defaultValue="10" required /></label>
                <label>Dari atas (%)<input name="y" type="number" min="0" max="99" defaultValue="10" required /></label>
                <label>Lebar (%)<input name="width" type="number" min="1" max="100" defaultValue="30" required /></label>
                <label>Tinggi (%)<input name="height" type="number" min="1" max="100" defaultValue="15" required /></label>
              </div>
              <button className="button secondary" disabled={!!status}>Tambahkan kotak sensur</button>
            </form>
          </details>
        </>}
        {!!page.redactions.length && <div className="actions">
          <span>{page.redactions.length} area disensor</span>
          <button className="text-button" disabled={!!status} onClick={() => update({ redactions: page.redactions.slice(0, -1) })}>Urungkan sensur</button>
          <button className="text-button" disabled={!!status} onClick={() => update({ redactions: [] })}>Hapus semua sensur</button>
          <small className="block-muted">Hapus sensur untuk menyesuaikan potongan.</small>
        </div>}
        <div className="scan-list" aria-label="Halaman scan">
          {pages.map((item, index) => <button key={item.key} aria-label={"Pilih halaman " + (index + 1)} aria-pressed={activeIndex === index} disabled={!!status} onClick={() => switchPage(index)}>
            {item.redactions.length ? <span className="scan-masked-thumb" aria-hidden="true"><ShieldCheck size={18} /></span> : <LocalImage blob={item.thumbnail} alt="" />}<small>Hal. {index + 1}</small></button>)}
        </div>
        <div className="actions">
          <button className="icon-button" aria-label="Pindah halaman ke kiri" disabled={activeIndex <= 0 || !!status} onClick={() => movePage(activeIndex - 1)}><ChevronLeft size={19} /></button>
          <button className="icon-button" aria-label="Pindah halaman ke kanan" disabled={activeIndex >= pages.length - 1 || !!status} onClick={() => movePage(activeIndex + 1)}><ChevronRight size={19} /></button>
          <button className="button secondary" disabled={!!status} onClick={() => void startCamera(page.key)}><Camera size={17} /> Ambil ulang</button>
          <label className="button secondary file-label"><Images size={17} /> Ganti foto<input type="file" accept="image/*" aria-label="Ganti foto halaman" disabled={!!status} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void replacePhoto(page.key, file);
            event.target.value = "";
          }} /></label>
          <button className="button secondary" disabled={!!status} onClick={() => { setPages(pages.filter((_, index) => index !== activeIndex)); setOutputs([]); switchPage(Math.max(0, activeIndex - 1)); }}><Trash2 size={17} /> Hapus halaman</button>
        </div>
      </> : <div className="empty"><span className="empty-icon"><ScanLine size={23} /></span><strong>Belum ada halaman</strong><p>Gunakan kamera atau pilih foto untuk mulai memindai.</p></div>}
      {status && <p className="notice" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {text && <div className="stack"><label>Teks hasil OCR<textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <div className="actions"><button className="button secondary" onClick={() => download(new Blob([text], { type: "text/plain" }), name + ".txt")}><Download size={16} /> Unduh teks</button>
          <button className="button secondary" onClick={async () => {
            try { await navigator.clipboard.writeText(text); setError(""); }
            catch { setError("Akses papan klip tidak tersedia."); }
          }}>Salin teks</button></div></div>}
    </section>
    <section className="panel scanner-panel stack">
      <h2>Pengaturan scan</h2>
      {page && <>
        <div className="form-grid">
          <SelectField label="Filter" value={page.filter} disabled={!!status} options={[["natural", "Asli"], ["gray", "Abu-abu"], ["mono", "Hitam putih"], ["paper", "Putihkan kertas"]]} onChange={(filter) => update({ filter })} />
          <label>Kecerahan<input type="range" min="-60" max="60" value={page.brightness} disabled={!!status} onChange={(event) => update({ brightness: Number(event.target.value) })} /></label>
          <label>Kontras<input type="range" min="-50" max="90" value={page.contrast} disabled={!!status} onChange={(event) => update({ contrast: Number(event.target.value) })} /></label>
        </div>
        <label className="check-label"><input type="checkbox" checked={page.split} disabled={!!status} onChange={(event) => update({ split: event.target.checked })} />Pisahkan kiri dan kanan (halaman buku)</label>
        <label>Watermark (opsional)<input value={watermark} disabled={!!status} onChange={(event) => { setWatermark(event.target.value); setOutputs([]); }} /></label>
      </>}
      <label>Nama hasil<input value={name} disabled={!!status} onChange={(event) => { setName(event.target.value); setOutputs([]); }} /></label>
      <div className="form-grid">
        <SelectField label="Ekspor sebagai" value={format} disabled={!!status} options={[["pdf", "PDF"], ["jpg", "JPG"], ["docx", "Word (DOCX)"]]}
          onChange={(value) => { setFormat(value); setOutputs([]); }} />
        {format === "pdf" && <SelectField label="Ukuran kertas" value={paper} disabled={!!status}
          options={[["A4", "A4"], ["Letter", "Letter"], ["photo", "Ikuti foto"], ["id", "KTP dua sisi di A4"]]}
          onChange={(value) => { setPaper(value); setOutputs([]); }} />}
        {format === "docx" && <SelectField label="Isi Word" value={wordMode} disabled={!!status}
          options={[["text", "Teks yang dapat diedit (OCR)"], ["photo", "Foto per halaman"]]}
          onChange={(value) => { setWordMode(value); setOutputs([]); }} />}
      </div>
      {format === "pdf" && paper !== "id" && <label className="check-label"><input type="checkbox" checked={searchable} disabled={!!status} onChange={(event) => { setSearchable(event.target.checked); setOutputs([]); }} />Tanam teks OCR agar PDF bisa dicari</label>}
      <button className="button primary" disabled={!pages.length || !!status} onClick={() => void exportFiles()}><Save size={17} /> Buat {format.toUpperCase()}</button>
      {!!outputs.length && <OutputResults outputs={outputs} save={save} />}
    </section>
  </div>;
}
