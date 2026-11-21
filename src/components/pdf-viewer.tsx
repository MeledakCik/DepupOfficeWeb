"use client";

import {
  AudioLines, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText,
  Highlighter, PanelLeft, Printer, Search, Signature, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { download, type Preferences, type StoredDocument } from "@/lib/workspace";
import { pdfCanvas, pdfPageText, readPdf } from "@/lib/pdf";
import { SelectBox } from "./select-box";

type Source = Awaited<ReturnType<typeof readPdf>>;
type Launch = (id: string, files?: File[]) => void;

const PagePreview = memo(function PagePreview({ source, number, zoom, defaultRatio, viewport, eager }: {
  source: Source; number: number; zoom: number; defaultRatio: number;
  viewport: RefObject<HTMLDivElement | null>; eager: boolean;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const artwork = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(defaultRatio);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const surface = artwork.current;
    if (!surface) return;
    let active = true;
    let nearby = eager;
    let rendered = false;
    let rendering = false;
    let observer: IntersectionObserver | undefined;

    async function draw() {
      if (rendered || rendering || !surface) return;
      rendering = true;
      let page: PDFPageProxy | undefined;
      try {
        page = await source.getPage(number);
        if (!active) return;
        const size = page.getViewport({ scale: 1 });
        setRatio(size.width / size.height);
        const canvas = await pdfCanvas(page, Math.min(2450, 1150 * zoom));
        if (!active || !nearby) return;
        canvas.setAttribute("aria-label", "Tampilan halaman " + number);
        canvas.setAttribute("role", "img");
        surface.replaceChildren(canvas);
        rendered = true;
        setFailed(false);
      } catch {
        if (active && nearby) {
          surface.replaceChildren();
          setFailed(true);
        }
      } finally {
        rendering = false;
        page?.cleanup();
      }
    }

    if (eager || !("IntersectionObserver" in window)) {
      nearby = true;
      void draw();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        nearby = entry.isIntersecting;
        if (nearby) void draw();
        else {
          surface.replaceChildren();
          rendered = false;
        }
      }, { root: viewport.current, rootMargin: "300px 0px" });
      if (paper.current) observer.observe(paper.current);
    }
    return () => { active = false; observer?.disconnect(); };
  }, [source, number, zoom, eager, viewport]);

  return <div ref={paper} id={"pdf-page-" + number} className="pdf-page"
    style={{ "--pdf-ratio": ratio } as CSSProperties}>
    <div ref={artwork} className="pdf-page-artwork" />
    <p className="pdf-placeholder">{failed ? "Halaman gagal ditampilkan." : "Halaman " + number}</p>
  </div>;
});

function scrollToPage(viewport: HTMLDivElement, number: number) {
  const sheet = viewport.querySelector("#pdf-page-" + number);
  if (!sheet || !viewport.firstElementChild) return;
  const padding = parseFloat(getComputedStyle(viewport.firstElementChild).paddingTop);
  const top = viewport.scrollTop + sheet.getBoundingClientRect().top - viewport.getBoundingClientRect().top - padding;
  viewport.scrollTo({ top });
}

function pageAtReadingLine(viewport: HTMLDivElement) {
  const sheets = viewport.firstElementChild?.children;
  if (!sheets?.length) return 1;
  const line = viewport.getBoundingClientRect().top + 28;
  let first = 0;
  let last = sheets.length - 1;
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    if (sheets[middle].getBoundingClientRect().bottom <= line) first = middle + 1;
    else last = middle;
  }
  return first + 1;
}

export default function PdfViewer({ record, preferences, launch }: { record: StoredDocument; preferences: Preferences; launch: Launch }) {
  const [reader, setReader] = useState<{ source: Source; ratio: number; printable: boolean; copyable: boolean }>();
  const [password, setPassword] = useState<string>();
  const [typedPassword, setTypedPassword] = useState("");
  const [askingPassword, setAskingPassword] = useState(false);
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string>();
  const [zoom, setZoom] = useState(preferences.zoom);
  const [theme, setTheme] = useState(preferences.reader);
  const [layout, setLayout] = useState(preferences.pdfLayout);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<number[]>([]);
  const [pageText, setPageText] = useState<{ page: number; text: string }>();
  const [error, setError] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef(0);
  const anchorPage = useRef<number | undefined>(undefined);
  const continuous = layout === "continuous";
  const source = reader?.source;
  const count = source?.numPages ?? 0;
  const file = () => new File([record.data], record.name, { type: "application/pdf" });

  useEffect(() => {
    let active = true;
    let document: Source | undefined;
    void readPdf(record.data, password).then(async (result) => {
      document = result;
      if (!active) { await result.destroy(); return; }
      const [permissions, firstPage, { PermissionFlag }] = await Promise.all([
        result.getPermissions(), result.getPage(1), import("pdfjs-dist"),
      ]);
      if (!active) return;
      const size = firstPage.getViewport({ scale: 1 });
      setReader({
        source: result,
        ratio: size.width / size.height,
        printable: !permissions || permissions.has(PermissionFlag.PRINT) || permissions.has(PermissionFlag.PRINT_HIGH_QUALITY),
        copyable: !permissions || permissions.has(PermissionFlag.COPY),
      });
      setAskingPassword(false);
      setError("");
    }).catch((cause) => {
      if (!active) return;
      const locked = cause instanceof Error && cause.name === "PasswordException";
      setAskingPassword(locked);
      setError(locked ? (password === undefined ? "" : "Kata sandi belum sesuai.") : "PDF tidak dapat dibuka.");
    });
    return () => { active = false; void document?.destroy().catch(() => {}); };
  }, [record, password]);

  useLayoutEffect(() => {
    const viewport = content.current;
    const target = anchorPage.current;
    if (!viewport || target === undefined) return;
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = 0;
    if (continuous) scrollToPage(viewport, target);
    else viewport.scrollTop = 0;
    anchorPage.current = undefined;
  }, [continuous, pagesOpen, zoom]);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  function trackPage() {
    if (!continuous || scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      if (content.current) setPage(pageAtReadingLine(content.current));
    });
  }

  function jump(next: number) {
    if (!count || !Number.isInteger(next)) return;
    const target = Math.max(1, Math.min(count, next));
    setPage(target);
    if (!content.current) return;
    if (continuous) scrollToPage(content.current, target);
    else content.current.scrollTop = 0;
  }

  function changeZoom(next: number) {
    anchorPage.current = page;
    setZoom(next);
  }

  async function search() {
    const term = query.trim().toLocaleLowerCase("id");
    if (!source || !term) return;
    setSearching(true); setError(""); setMatches([]);
    try {
      const entries: number[] = [];
      for (let index = 1; index <= source.numPages; index++) {
        if ((await pdfPageText(await source.getPage(index))).toLocaleLowerCase("id").includes(term)) entries.push(index);
      }
      setMatches(entries);
      if (entries.length) jump(entries[0]);
      else setError("Teks tidak ditemukan pada dokumen.");
    } catch { setError("Pencarian PDF gagal."); }
    finally { setSearching(false); }
  }

  async function showPageText() {
    if (!source) return;
    try {
      const text = await pdfPageText(await source.getPage(page));
      setPageText({ page, text: text || "Halaman ini berisi gambar. Gunakan OCR untuk mengambil teks." });
    } catch { setError("Teks tidak dapat dibaca."); }
  }

  const downloadButton = <button className="pdf-control" aria-label="Unduh PDF" onClick={() => download(record.data, record.name)}>
    <Download size={17} /><span>Unduh PDF</span>
  </button>;

  if (!reader) return <div className="stack pdf-open-state">
    {askingPassword ? <form className="stack" onSubmit={(event) => { event.preventDefault(); setPassword(typedPassword); }}>
      <label>Kata sandi PDF<input type="password" required value={typedPassword} onChange={(event) => setTypedPassword(event.target.value)} /></label>
      <button className="button primary">Buka PDF</button>
    </form> : !error && <p className="notice" role="status">Memuat PDF…</p>}
    <div className="actions">{downloadButton}</div>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;

  const showText = reader.copyable && pageText?.page === page;
  return <div className="pdf-reader" data-printable={reader.printable}>
    <div className="pdf-ribbon" aria-label="Kontrol pembaca PDF" role="group">
      <div className="pdf-ribbon-row">
        <button className="pdf-control" aria-expanded={pagesOpen} aria-controls="pdf-pages-panel" aria-label="Daftar halaman"
          onClick={() => { anchorPage.current = page; setPagesOpen(!pagesOpen); }}><PanelLeft size={18} /><span>Halaman</span></button>
        <SelectBox label="Tata letak PDF" value={layout} options={[["continuous", "Gulir terus"], ["single", "Satu halaman"]]} onChange={(value) => {
          anchorPage.current = page;
          setLayout(value);
        }} />
        <SelectBox label="Tema halaman" value={theme} onChange={setTheme} options={[["natural", "Normal"], ["warm", "Hangat"], ["night", "Malam"]]} />
        <div className="pdf-file-actions">
          {downloadButton}
          {reader.printable && <button className="pdf-control" aria-label="Cetak" onClick={() => launch("print", [file()])}><Printer size={17} /><span>Cetak</span></button>}
        </div>
      </div>
      {reader.copyable && <div className="pdf-ribbon-row pdf-search-row">
        <form className="pdf-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <input className="field" aria-label="Cari teks PDF" placeholder="Cari teks PDF…" value={query} onChange={(event) => { setQuery(event.target.value); setMatches([]); }} />
          <button className="pdf-control" disabled={!query.trim() || searching}><Search size={17} /> {searching ? "Mencari…" : "Cari"}</button>
        </form>
        <details className="pdf-document-tools">
          <summary className="pdf-control"><FileText size={17} /> Alat <ChevronDown size={14} /></summary>
          <div className="pdf-tool-menu" onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) event.currentTarget.parentElement?.removeAttribute("open");
          }}>
            <button className="pdf-control" onClick={() => void showPageText()}><Eye size={17} /> Teks halaman</button>
            {!password && <>
              <button className="pdf-control" onClick={() => launch("voice", [file()])}><AudioLines size={17} /> Baca suara</button>
              <button className="pdf-control" onClick={() => launch("annotate", [file()])}><Highlighter size={17} /> Anotasi</button>
              <button className="pdf-control" onClick={() => launch("sign", [file()])}><Signature size={17} /> Tanda tangan</button>
            </>}
          </div>
        </details>
      </div>}
      {!!matches.length && <div className="chips pdf-find-results" role="group" aria-label="Halaman dengan hasil pencarian">
        {matches.map((index) => <button key={index} onClick={() => jump(index)} aria-pressed={page === index}>Hal. {index}</button>)}
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <div className="pdf-reader-body">
      <nav id="pdf-pages-panel" aria-label="Navigasi halaman PDF" className="pdf-pages-panel" hidden={!pagesOpen}>
        <div className="pdf-panel-heading"><strong>Halaman</strong><button className="pdf-control" aria-label="Tutup daftar halaman"
          onClick={() => { anchorPage.current = page; setPagesOpen(false); }}><X size={16} /></button></div>
        <div className="pdf-page-list">
          {pagesOpen && Array.from({ length: count }, (_, index) => {
            const number = index + 1;
            return <button key={number} className="pdf-control" aria-label={"Buka halaman " + number} aria-current={page === number ? "page" : undefined}
              onClick={() => {
                if (matchMedia("(max-width: 819px)").matches) { anchorPage.current = number; setPagesOpen(false); }
                jump(number);
              }}>{number}</button>;
          })}
        </div>
      </nav>
      <div ref={content} className={"pdf-viewport " + theme} tabIndex={0} role="region" aria-label="Halaman dokumen PDF" onScroll={trackPage}
        style={{ "--pdf-zoom": zoom } as CSSProperties}>
        <div className="pdf-pages" data-continuous={continuous && count > 1}>
          {(continuous ? Array.from({ length: count }, (_, index) => index + 1) : [page]).map((number) =>
            <PagePreview key={number} source={reader.source} number={number} defaultRatio={reader.ratio} zoom={zoom} viewport={content} eager={!continuous} />)}
        </div>
      </div>
    </div>
    {showText && <div className="pdf-page-text"><p className="notice result-text">{pageText.text}</p>
      <button className="pdf-control" aria-label="Tutup teks halaman" onClick={() => setPageText(undefined)}><X size={17} /></button>
    </div>}
    <div className="pdf-statusbar">
      <form className="pdf-status-group" aria-label="Pindah halaman" onSubmit={(event) => {
        event.preventDefault();
        if (pageDraft?.trim()) jump(Number(pageDraft));
        setPageDraft(undefined);
      }}>
        <button type="button" className="pdf-control" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => jump(page - 1)}><ChevronLeft size={18} /></button>
        <input className="field pdf-page-number" aria-label="Nomor halaman" type="number" inputMode="numeric" enterKeyHint="go" min={1} max={count}
          value={pageDraft ?? page} onChange={(event) => setPageDraft(event.target.value)} onBlur={() => setPageDraft(undefined)} />
        <span className="pdf-page-count">/ {count}</span>
        <button type="button" className="pdf-control" aria-label="Halaman berikutnya" disabled={page >= count} onClick={() => jump(page + 1)}><ChevronRight size={18} /></button>
      </form>
      <div className="pdf-status-group" role="group" aria-label="Zoom PDF">
        <button className="pdf-control" aria-label="Perkecil halaman" disabled={zoom <= .5} onClick={() => changeZoom(zoom - .25)}><ZoomOut size={17} /></button>
        <button className="pdf-control pdf-zoom-value" aria-label="Kembalikan zoom ke 100%" title="Kembalikan zoom ke 100%" onClick={() => { if (zoom !== 1) changeZoom(1); }}>{Math.round(zoom * 100)}%</button>
        <button className="pdf-control" aria-label="Perbesar halaman" disabled={zoom >= 2} onClick={() => changeZoom(zoom + .25)}><ZoomIn size={17} /></button>
      </div>
    </div>
  </div>;
}
