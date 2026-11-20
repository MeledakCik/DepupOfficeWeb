"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  ArrowDownToLine, ArrowUpRight, Camera, ChevronRight, CircleHelp, Clock3, Folder, FolderOpen,
  LockKeyhole, MoreHorizontal, Paperclip, Pin, Plus, Search, ShieldCheck, Star, Sun, Moon, Upload, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { extension, getKind, kinds, navigation, templates, toolGroups, tools, type Kind, type Section, type Tool } from "@/lib/catalog";
import { isDepupProtectedDocument, protectedDocumentTitle } from "@/lib/protected-document";
import {
  defaults, deleteDocument, download, formatSize, listDocuments, makeDocument, openStoredDocument, readDocument, readSearchIndex,
  shareFile, updateDocument, writeDocument, writeSearchIndex, type DocumentRecord, type Output, type StoredDocument,
} from "@/lib/workspace";
import { Modal, ScanArtwork } from "./ui";
import { Settings } from "./settings";
import ProtectedDocumentNotice from "./protected-document-notice";

const ToolPanel = dynamic(() => import("./tool-panel"), { ssr: false, loading: () => <p role="status">Memuat alat…</p> });
const Editor = dynamic(() => import("./editor"), { ssr: false, loading: () => <p role="status">Memuat editor…</p> });
const Scanner = dynamic(() => import("./scanner"), { ssr: false, loading: () => <p role="status">Memuat pemindai…</p> });
const tabs = ["Terkini", "Ditandai", "Hasil olahan"] as const;
type DocumentTab = typeof tabs[number];
type DialogState =
  | { mode: "tool"; tool: Tool; files?: File[] }
  | { mode: "editor"; document?: StoredDocument; kind: Kind; template?: string }
  | { mode: "protected"; name: string; data: Blob }
  | { mode: "rename" | "delete"; record: DocumentRecord }
  | { mode: "new" | "privacy" | "quick"; files?: File[] };

const createActions = [
  { kind: "word", title: "Dokumen Word", description: "Menulis dan memformat dokumen", icon: kinds.word.icon },
  { kind: "excel", title: "Spreadsheet", description: "Mengolah tabel dan rumus", icon: kinds.excel.icon },
  { kind: "note", title: "Catatan jadi PDF", description: "Menulis catatan singkat", icon: kinds.pdf.icon },
] as const;
const homeTools = ["invoice", "catalog", "planner", "summary", "sign"].flatMap((id) => tools.filter((tool) => tool.id === id));
const quickFormats = [
  ["pdf", ".pdf"], ["word", ".docx, .txt"], ["excel", ".xlsx, .csv"],
  ["slides", ".pptx"], ["image", ".jpg, .png"], ["other", "Semua format"],
] as const;
const catalogGroups = toolGroups.map(({ title, items }) => ({
  title,
  entries: tools.filter((tool) => items.some(([id]) => id === tool.id)),
}));
const historyKey = "depup-recent-searches";

function sectionFromHash(): Section {
  return navigation.find((section) => section.id === window.location.hash.slice(1))?.id ?? "beranda";
}

export default function Workspace() {
  const [section, setSection] = useState<Section>("beranda");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState(defaults);
  const [dialog, setDialog] = useState<DialogState>();
  const [tab, setTab] = useState<DocumentTab>("Terkini");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [contentMatches, setContentMatches] = useState<Record<string, string>>();
  const [contentBusy, setContentBusy] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [toolQuery, setToolQuery] = useState("");
  const [toolGroup, setToolGroup] = useState("");
  const [name, setName] = useState("");
  const [toast, setToast] = useState("");
  const [now, setNow] = useState<Date>();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const searchRun = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragDepth = useRef(0);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  const refresh = useCallback(async () => setDocuments(await listDocuments()), []);

  useEffect(() => {
    function sync() { setSection(sectionFromHash()); }
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    queueMicrotask(() => {
      sync();
      setNow(new Date());
      try {
        const saved = localStorage.getItem("depup-preferences");
        if (saved) setPreferences({ ...defaults, ...JSON.parse(saved) });
        const history: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
        if (Array.isArray(history)) setRecentSearches(history.filter((item): item is string => typeof item === "string").slice(0, 6));
      } catch { /* Defaults are used when browser storage is disabled. */ }
      setReady(true);
    });
    void listDocuments().then(setDocuments).catch(() => notify("Penyimpanan browser tidak dapat dibuka."));
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("keydown", shortcut);
      clearTimeout(toastTimer.current);
    };
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    Object.assign(document.documentElement.dataset, {
      theme: preferences.theme, blur: String(preferences.blur), font: preferences.fontScale,
      glass: String(preferences.glass), dispersion: String(preferences.dispersion), motion: String(preferences.motion),
    });
    try { localStorage.setItem("depup-preferences", JSON.stringify(preferences)); } catch { /* Session preferences remain usable. */ }
  }, [preferences, ready]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").then(async () => {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ resources: performance.getEntriesByType("resource").map((entry) => entry.name) });
    }).catch(() => {});
  }, []);

  function navigate(next: Section) {
    setSection(next);
    if (sectionFromHash() !== next) window.history.pushState(null, "", "#" + next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function gotoDocuments(next: DocumentTab = "Terkini") {
    setTab(next);
    setKindFilter("all");
    navigate("dokumen");
  }

  async function persist(output: Output) {
    const record = await makeDocument(output.name, output.blob, "output");
    await writeDocument(record);
    setContentMatches(undefined);
    await refresh();
    notify(`${record.name} tersimpan.`);
    return record;
  }

  async function importFiles(files: File[], open = true) {
    if (!files.length) return;
    let saved = 0;
    try {
      let single: StoredDocument | undefined;
      for (const file of files) {
        single = await makeDocument(file.name, file, "import");
        await writeDocument(single);
        saved++;
      }
      if (files.length === 1 && single && open) showDocument(single);
      else gotoDocuments();
      notify(`${saved} berkas ditambahkan.`);
    } catch {
      notify(saved ? `${saved} berkas tersimpan. Ruang penyimpanan mungkin penuh.` : "Berkas gagal disimpan. Periksa ruang penyimpanan browser.");
    } finally {
      setContentMatches(undefined);
      await refresh().catch(() => {});
    }
  }

  function chooseFiles(accept = "", multiple = true) {
    const input = fileInput.current;
    if (!input) return;
    input.accept = accept;
    input.multiple = multiple;
    input.click();
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>, open = true) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void importFiles(files, open);
  }

  async function openDocument(record: DocumentRecord) {
    try {
      const file = await openStoredDocument(record.id);
      showDocument(file);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "Berkas gagal dibuka."); }
  }

  function showDocument(file: StoredDocument) {
    setDialog(file.depupProtected ? { mode: "protected", name: file.name, data: file.data }
      : { mode: "editor", document: file, kind: file.kind });
  }

  async function chooseQuickFile(file?: File) {
    if (!file) return;
    const selection = { mode: "quick" as const };
    setDialog(selection);
    try {
      const protectedFile = await isDepupProtectedDocument(file);
      setDialog((current) => current !== selection ? current : protectedFile
        ? { mode: "protected", name: file.name, data: file }
        : { mode: "quick", files: [file] });
    } catch { notify("Berkas gagal diperiksa."); }
  }

  async function update(record: DocumentRecord, change: Partial<DocumentRecord>) {
    try {
      await updateDocument(record.id, change);
      await refresh();
    } catch { notify("Perubahan gagal disimpan."); }
  }

  async function fileAction(record: DocumentRecord, action: "download" | "share") {
    try {
      const file = await readDocument(record.id);
      if (action === "share") {
        const shared = await shareFile(file.data, file.name);
        notify(shared ? "Berkas dibagikan." : "Berkas diunduh dan siap dibagikan.");
      } else download(file.data, file.name);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) notify("Berkas gagal diproses."); }
  }

  function launch(id: string, files?: File[]) {
    const tool = tools.find((entry) => entry.id === id);
    if (tool) setDialog({ mode: "tool", tool, files });
  }

  function create(kind: typeof createActions[number]["kind"]) {
    if (kind === "note") launch("note");
    else setDialog({ mode: "editor", kind });
  }

  function changeQuery(value: string) {
    searchRun.current++;
    setContentBusy(false);
    setContentMatches(undefined);
    setQuery(value);
    if (section !== "dokumen") gotoDocuments();
  }

  function saveSearchHistory(items: string[]) {
    setRecentSearches(items);
    try { localStorage.setItem(historyKey, JSON.stringify(items)); } catch { /* Browser storage can be disabled. */ }
  }

  async function searchContent(value = query) {
    const search = value.trim();
    if (!search) { searchInput.current?.focus(); return; }
    const term = search.toLocaleLowerCase("id");
    saveSearchHistory([search, ...recentSearches.filter((entry) => entry.toLocaleLowerCase("id") !== term)].slice(0, 6));
    const run = ++searchRun.current;
    setContentMatches(undefined);
    setContentBusy(true);
    try {
      const { extractText } = await import("@/lib/office");
      const matches: Record<string, string> = {};
      for (const item of documents) {
        if (run !== searchRun.current) return;
        if (item.name.toLocaleLowerCase("id").includes(term) || item.depupProtected) continue;
        try {
          const existing = item.depupProtected === undefined ? await readDocument(item.id) : undefined;
          if (existing?.depupProtected) continue;
          let result = await readSearchIndex(item.id);
          if (result === undefined) {
            const file = existing ?? await readDocument(item.id);
            result = await extractText(new File([file.data], file.name, { type: file.mime }));
            if (run !== searchRun.current) return;
            void writeSearchIndex(item.id, result).catch(() => {});
          }
          const plain = result.replace(/\s+/g, " ");
          const index = plain.toLocaleLowerCase("id").indexOf(term);
          if (index < 0) continue;
          if (run !== searchRun.current) return;
          const from = Math.max(0, index - 32);
          const to = Math.min(plain.length, index + term.length + 60);
          matches[item.id] = (from ? "…" : "") + plain.slice(from, to).trim() + (to < plain.length ? "…" : "");
          setContentMatches({ ...matches });
        } catch { /* Supported files remain searchable when one file is corrupt or locked. */ }
      }
      if (run === searchRun.current) setContentMatches(matches);
    } catch { notify("Pencarian isi tidak dapat dimuat."); }
    finally { if (run === searchRun.current) setContentBusy(false); }
  }

  function documentList(items: DocumentRecord[], emptyHeading: string, emptyBody: string, importAction = false) {
    if (!items.length) return <div className="empty">
      <span className="empty-icon"><FolderOpen size={23} /></span><strong>{emptyHeading}</strong><p>{emptyBody}</p>
      {importAction && <button className="text-button" onClick={() => chooseFiles()}><Plus size={16} /> Buka berkas</button>}
    </div>;
    return <ul className="file-list">{items.map((item) => {
      const Icon = item.depupProtected ? LockKeyhole : kinds[item.kind].icon;
      return <li key={item.id}>
        <button className="file-main" onClick={() => void openDocument(item)}>
          <span className={`badge ${item.kind}`}><Icon size={20} /></span>
          <span className="file-text">
            <strong>{item.name}</strong><small>{item.depupProtected ? protectedDocumentTitle : (extension(item.name) || kinds[item.kind].label).toUpperCase()} · {formatSize(item.size)}{item.pinned && " · Disematkan"}</small>
            {contentMatches?.[item.id] && <small className="search-snippet">{contentMatches[item.id]}</small>}
          </span>
        </button>
        <button className="icon-button file-star" aria-label={item.starred ? "Hapus tanda" : "Tandai berkas"} aria-pressed={!!item.starred} onClick={() => void update(item, { starred: !item.starred })}><Star size={18} fill={item.starred ? "currentColor" : "none"} /></button>
        <details className="file-menu"><summary className="icon-button" aria-label={`Tindakan untuk ${item.name}`}><MoreHorizontal size={20} /></summary>
          <div onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>
            <button onClick={() => void update(item, { pinned: !item.pinned })}><Pin size={16} />{item.pinned ? "Lepas sematan" : "Sematkan"}</button>
            <button onClick={() => { setName(item.name); setDialog({ mode: "rename", record: item }); }}>Ubah nama</button>
            {!item.depupProtected && <button onClick={async () => {
              try {
                const file = await readDocument(item.id);
                await chooseQuickFile(new File([file.data], file.name, { type: file.mime }));
              } catch { notify("Berkas gagal dibuka."); }
            }}><Paperclip size={16} /> Olah berkas</button>}
            <button onClick={() => void fileAction(item, "download")}>Unduh</button>
            <button onClick={() => void fileAction(item, "share")}>Bagikan</button>
            <button className="danger-text" onClick={() => setDialog({ mode: "delete", record: item })}>Hapus</button>
          </div>
        </details>
      </li>;
    })}</ul>;
  }

  function createList() {
    return <div className="create-list">{createActions.map(({ kind, title, description, icon: Icon }) => <button key={kind} onClick={() => create(kind)}>
      <span className={`badge ${kind}`}><Icon size={19} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17} />
    </button>)}{homeTools.map(({ id, label, description, icon: Icon, tone }) => <button key={id} onClick={() => launch(id)}>
      <span className={`badge ${tone}`}><Icon size={19} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17} />
    </button>)}</div>;
  }

  const outputs = documents.filter((document) => document.source === "output");
  const outputCount = outputs.length;
  const latestOutput = outputs.reduce<DocumentRecord | undefined>((latest, item) => !latest || item.saved > latest.saved ? item : latest, undefined);
  const pinned = documents.filter((document) => document.pinned);
  const visible = documents.filter((document) => {
    const search = query.trim().toLocaleLowerCase("id");
    return (tab !== "Ditandai" || document.starred) && (tab !== "Hasil olahan" || document.source === "output")
      && (kindFilter === "all" || kindFilter === document.kind)
      && (!search || document.name.toLocaleLowerCase("id").includes(search) || !!contentMatches?.[document.id]);
  });
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 19 ? "sore" : "malam";
  const current = navigation.find((item) => item.id === section);
  const displayDate = now?.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const toolSearch = toolQuery.toLocaleLowerCase("id").trim();
  const filteredGroups = section === "alat" ? catalogGroups
    .filter(({ title }) => !toolGroup || title === toolGroup)
    .map(({ title, entries }) => ({ title, entries: !toolSearch ? entries : entries.filter(({ label, description }) =>
      `${label} ${description} ${title}`.toLocaleLowerCase("id").includes(toolSearch)) }))
    .filter(({ entries }) => entries.length) : [];

  return <div className="workspace" onDragEnter={(event) => {
    if (!event.dataTransfer.types.includes("Files") || dialog || (section !== "beranda" && section !== "dokumen")) return;
    event.preventDefault(); dragDepth.current++; setDragging(true);
  }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files") && !dialog && (section === "beranda" || section === "dokumen")) event.preventDefault(); }}
  onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
  onDrop={(event) => {
    if (!dragging) return;
    event.preventDefault(); setDragging(false); dragDepth.current = 0;
    void importFiles(Array.from(event.dataTransfer.files));
  }}>
    <a className="skip-link" href="#konten" onClick={(event) => { event.preventDefault(); document.getElementById("konten")?.focus(); }}>Lewati ke konten</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("beranda")} aria-label="Depup Office, beranda">
        <Image src="/brand/depup-mark.png" width={36} height={36} alt="" unoptimized />
        <span>DepUp <b>Office</b></span>
      </button>
      <nav className="main-nav" aria-label="Navigasi utama">{navigation.map(({ id, label, icon: Icon }) => <button key={id}
        className={id === section ? "active" : ""} onClick={() => navigate(id)} aria-current={id === section ? "page" : undefined}>
        <Icon size={20} strokeWidth={1.9} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <button className="aside-link" onClick={() => setDialog({ mode: "privacy" })}><CircleHelp size={19} /> Bantuan & privasi</button>
        <div className="local-status"><span className="local-icon"><ShieldCheck size={17} /></span><span><strong>Penyimpanan lokal</strong><small>Berkas di browser ini</small></span></div>
      </div>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <button className="brand mobile-brand" onClick={() => navigate("beranda")} aria-label="Depup Office, beranda"><Image src="/brand/depup-mark.png" width={33} height={33} alt="" unoptimized /><span>DepUp <b>Office</b></span></button>
        <div className="breadcrumb"><span>Ruang kerja</span><ChevronRight size={15} /><strong>{current?.label}</strong></div>
        <form className="search" onSubmit={(event) => {
          event.preventDefault();
          if (section !== "dokumen") gotoDocuments();
          void searchContent();
        }}>
          <Search size={18} /><input ref={searchInput} aria-label="Cari dokumen" placeholder="Cari dokumen…" value={query} onChange={(event) => changeQuery(event.target.value)} />
          {query ? <button type="button" className="clear-search" aria-label="Bersihkan pencarian" onClick={() => { changeQuery(""); searchInput.current?.focus(); }}><X size={15} /></button> : <kbd>Ctrl K</kbd>}
        </form>
        <button className="icon-button theme-button" title="Ganti tema" aria-label="Ganti tema" onClick={() => {
          const dark = preferences.theme === "dark" || (preferences.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
          setPreferences({ ...preferences, theme: dark ? "light" : "dark" });
        }}><Moon className="moon" size={19} /><Sun className="sun" size={19} /></button>
        <button className="button primary top-action" aria-label="Buka berkas" onClick={() => chooseFiles()}><Upload size={17} /><span>Buka berkas</span></button>
      </header>
      <main className="content" id="konten" tabIndex={-1}>
        <div className="workspace-view" key={section}>
        {section === "beranda" && <>
          <div className="intro"><div><p className="date"><Clock3 size={15} />{displayDate || "Ruang kerja Anda"}</p><h1>Selamat {greeting}<span>.</span></h1>
            <p className="intro-sub">Siap mengerjakan dokumen apa hari ini?</p></div>
            <button className="button secondary create-button" onClick={() => setDialog({ mode: "new" })}><Plus size={19} /> Buat baru</button></div>
          <div className="overview">
            <section className="hero" aria-labelledby="scan-heading"><div className="hero-content">
              <span className="hero-icon"><Camera size={21} /></span><h2 id="scan-heading">Scan dokumen</h2>
              <p>Ubah foto kertas menjadi PDF yang rapi, langsung dari kamera atau galeri.</p>
              <button className="button hero-button" onClick={() => navigate("scan")}><Camera size={17} /> Mulai Scan</button>
            </div><ScanArtwork /></section>
            <div className="stats">
              <button className="stat" onClick={() => gotoDocuments()}><span className="stat-icon"><Folder size={19} /></span><ArrowUpRight className="stat-arrow" size={16} /><strong>{documents.length}</strong><span>Berkas tersimpan</span></button>
              <button className="stat result-stat" onClick={() => gotoDocuments("Hasil olahan")}><span className="stat-icon"><ArrowDownToLine size={20} /></span><ArrowUpRight className="stat-arrow" size={16} /><strong>{outputCount}</strong><span>Hasil dibuat</span></button>
            </div>
          </div>
          <section className="home-section" aria-labelledby="quick-heading"><div className="section-head"><h2 id="quick-heading">Buka berkas</h2></div>
            <div className="quick-grid">{quickFormats.map(([key, formats]) => {
              const { icon: Icon, label, accept } = kinds[key];
              return <button key={key} className="quick-card" onClick={() => chooseFiles(accept, false)}><span className={`badge ${key}`}><Icon size={21} /></span>
                <span><strong>{label}</strong><small>{formats}</small></span><ChevronRight className="quick-arrow" size={17} /></button>;
            })}</div>
          </section>
          {pinned.length > 0 && <section className="home-section"><div className="section-head"><h2>Disematkan</h2></div><div className="panel">{documentList(pinned.slice(0, 4), "", "")}</div></section>}
          <div className="home-columns">
            <section className="home-section" aria-labelledby="recent-heading"><div className="section-head"><h2 id="recent-heading">Dokumen terbaru</h2>
              <button className="text-button" onClick={() => gotoDocuments()}>Lihat semua <ChevronRight size={16} /></button></div>
              <div className="panel recent-panel">{documentList(documents.slice(0, 4), "Belum ada dokumen", "Buka atau jatuhkan berkas ke ruang kerja.", true)}</div></section>
            <section className="home-section" aria-labelledby="create-heading"><div className="section-head"><h2 id="create-heading">Buat baru</h2></div><div className="panel">{createList()}</div></section>
          </div>
          <section className="home-section" aria-labelledby="templates-heading"><div className="section-head"><h2 id="templates-heading">Template siap pakai</h2></div>
            <div className="template-grid">{templates.map(([id, title, description, kind]) => {
              const Icon = kinds[kind].icon;
              return <button className="template" key={id} onClick={() => setDialog({ mode: "editor", kind, template: id })}><span className={`badge ${kind}`}><Icon size={19} /></span><strong>{title}</strong><small>{description}</small></button>;
            })}</div></section>
        </>}
        {section === "dokumen" && <>
          <div className="page-heading"><div><h1>Dokumen</h1><p>Kelola berkas yang tersimpan di ruang kerja Anda.</p></div>
            <button className="button secondary" onClick={() => folderInput.current?.click()}><FolderOpen size={18} /> Impor folder</button></div>
          {!query.trim() && recentSearches.length > 0 && <section className="search-history" aria-label="Pencarian terakhir">
            <div className="section-head"><h2>Pencarian terakhir</h2>
              <button className="text-button" aria-label="Hapus riwayat pencarian" onClick={() => saveSearchHistory([])}>Hapus riwayat</button></div>
            <div className="chips">{recentSearches.map((entry) => <button key={entry} title={entry} onClick={() => {
              changeQuery(entry); void searchContent(entry);
            }}><Clock3 size={14} /> {entry}</button>)}</div>
          </section>}
          <div className="section-head document-controls"><div className="segmented" aria-label="Tampilan dokumen">
            {tabs.map((entry) => <button key={entry} aria-pressed={tab === entry} onClick={() => setTab(entry)}>{entry}</button>)}
          </div>{query && <button className="button secondary" onClick={() => void searchContent()} disabled={contentBusy}><Search size={16} />{contentBusy ? "Mencari…" : "Cari dalam isi"}</button>}</div>
          <div className="chips" aria-label="Jenis berkas"><button onClick={() => setKindFilter("all")} aria-pressed={kindFilter === "all"}>Semua jenis</button>
            {(Object.keys(kinds) as Kind[]).map((key) => <button key={key} onClick={() => setKindFilter(key)} aria-pressed={kindFilter === key}>{kinds[key].label}</button>)}</div>
          <div className="panel">{documentList(visible, query || tab !== "Terkini" || kindFilter !== "all" ? "Tidak ada berkas yang sesuai" : "Belum ada dokumen",
            query ? "Coba kata kunci lain atau cari dalam isi berkas." : "Berkas yang dibuka atau dibuat akan muncul di sini.", !query && tab === "Terkini")}</div>
        </>}
        {section === "scan" && <><div className="page-heading"><div><h1>Scan dokumen</h1><p>Ambil foto, rapikan halaman, lalu simpan hasilnya.</p></div></div><Scanner save={persist} preferences={preferences} /></>}
        {section === "alat" && <>
          <div className="page-heading"><div><h1>Alat</h1><p>Kelola, konversi, dan lindungi berkas di browser.</p></div>
            <button className="button secondary" onClick={() => setDialog({ mode: "quick" })}><Paperclip size={17} /> Pilih berkas dulu</button></div>
          <div className="search tool-search"><Search size={18} /><input aria-label="Cari alat" placeholder="Cari alat…" value={toolQuery} onChange={(event) => setToolQuery(event.target.value)} />
            {toolQuery && <button className="clear-search" aria-label="Bersihkan pencarian alat" onClick={() => setToolQuery("")}><X size={15} /></button>}
          </div>
          <div className="chips tool-categories" role="group" aria-label="Kategori alat">
            <button aria-pressed={!toolGroup} onClick={() => setToolGroup("")}>Semua alat</button>
            {toolGroups.map(({ title }) => <button key={title} aria-pressed={toolGroup === title} onClick={() => setToolGroup(title)}>{title}</button>)}
          </div>
          {!toolQuery.trim() && latestOutput && <div className="last-output panel">
            <button className="file-main" onClick={() => void openDocument(latestOutput)}>
              <span className="badge other"><Clock3 size={19} /></span>
              <span className="file-text"><strong>{latestOutput.name}</strong><small>Hasil olahan terakhir · {formatSize(latestOutput.size)}</small></span>
            </button>
            <button className="button secondary" onClick={() => void fileAction(latestOutput, "download")}><ArrowDownToLine size={17} /> Unduh</button>
          </div>}
          {filteredGroups.map(({ title, entries }) => <section key={title} className="home-section"><div className="section-head"><h2>{title}</h2></div>
            <div className="tools-grid">{entries.map(({ id, label, description, icon: Icon, tone }) => <button className="tool-card" key={id} onClick={() => launch(id)}><span className={`badge ${tone}`}><Icon size={21} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17} /></button>)}</div>
          </section>)}
          {!filteredGroups.length && <div className="empty panel"><p>Tidak ada alat yang cocok.</p><button className="text-button" onClick={() => { setToolQuery(""); setToolGroup(""); }}>Tampilkan semua alat</button></div>}
        </>}
        {section === "saya" && <><div className="page-heading"><div><h1>Saya</h1><p>Preferensi tampilan, format dokumen, dan privasi.</p></div></div>
          <Settings documents={documents} preferences={preferences} change={setPreferences} outputs={() => gotoDocuments("Hasil olahan")} vault={() => launch("vault")} privacy={() => setDialog({ mode: "privacy" })} /></>}
        </div>
        <footer className="footer"><span>DepUp Office</span>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Document navigation uses the cached static page when offline. */}
          <a href="/">Halaman DepUp Office <ArrowUpRight size={14} /></a>
        </footer>
      </main>
    </div>
    <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" aria-label="Impor berkas" onChange={handleImport} />
    <input ref={folderInput} className="sr-only" tabIndex={-1} type="file" multiple {...{ webkitdirectory: "" }} aria-label="Impor folder" onChange={(event) => handleImport(event, false)} />
    {dragging && <div className="drag-overlay"><Upload size={32} /> Jatuhkan berkas di sini</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
    {dialog && <Modal close={() => setDialog(undefined)} wide={dialog.mode === "editor" || (dialog.mode === "tool" && dialog.tool.id === "annotate")}
      reader={dialog.mode === "editor" && dialog.kind === "pdf"}
      title={dialog.mode === "tool" ? dialog.tool.label : dialog.mode === "editor" ? dialog.document?.name ?? (dialog.kind === "excel" ? "Spreadsheet" : "Dokumen Word") : ({
        new: "Buat baru", rename: "Ubah nama", delete: "Hapus berkas", privacy: "Bantuan & privasi", quick: "Pilih berkas dulu", protected: protectedDocumentTitle,
      })[dialog.mode]}>
      {dialog.mode === "tool" && <ToolPanel key={dialog.tool.id} tool={dialog.tool} initialFiles={dialog.files} save={persist} preferences={preferences} notify={notify} />}
      {dialog.mode === "editor" && <Editor document={dialog.document} template={dialog.template} kind={dialog.kind} preferences={preferences} save={persist} launch={launch} />}
      {dialog.mode === "protected" && <ProtectedDocumentNotice name={dialog.name} data={dialog.data} />}
      {dialog.mode === "new" && createList()}
      {dialog.mode === "privacy" && <div className="stack help">
        <p>Pilih <strong>Buka berkas</strong> atau jatuhkan dokumen ke Beranda. Gunakan <strong>Scan</strong> untuk foto dan <strong>Alat</strong> untuk konversi, penyuntingan PDF, serta ekspor.</p>
        <p>Berkas dan pengaturan tersimpan di browser ini. Ekspor salinan sebelum menghapus data situs. Berkas dalam Brankas memerlukan kata sandi yang Anda buat.</p>
        <p>Untuk menggunakan kamera, buka aplikasi melalui HTTPS atau localhost dan izinkan akses kamera. Browser memakai suara yang tersedia di perangkat untuk membaca dokumen.</p>
        <p><strong>Dokumen Terlindungi DepUp</strong> dibuka melalui DepUp Office di Android. PDF standar dengan kata sandi dapat dibuka di browser.</p>
      </div>}
      {dialog.mode === "quick" && <div className="stack">
        <label className="upload-area"><Upload size={24} />{dialog.files?.[0]?.name ?? "Pilih PDF, foto, atau berkas Office"}
          <input type="file" aria-label="Pilih berkas untuk alat" onChange={(event) => {
            void chooseQuickFile(event.target.files?.[0]);
            event.target.value = "";
          }} /></label>
        {dialog.files?.[0] && <div className="chips">{tools.filter((tool) => {
          const file = dialog.files?.[0];
          if (!file || tool.accept === undefined) return false;
          const kind = getKind(file.name, file.type);
          return tool.accept === "" || tool.accept.split(",").some((format) => format === `.${extension(file.name)}` || (format === "image/*" && kind === "image") || (format === ".pdf" && kind === "pdf"));
        }).map((tool) => <button key={tool.id} onClick={() => launch(tool.id, dialog.files)}>{tool.label}</button>)}</div>}
      </div>}
      {dialog.mode === "rename" && <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        const suffix = extension(dialog.record.name);
        const next = name.trim();
        if (!next || /[\\/]/.test(next)) return notify("Masukkan nama berkas yang valid.");
        void update(dialog.record, { name: suffix && !next.toLowerCase().endsWith(`.${suffix}`) ? `${next}.${suffix}` : next });
        setDialog(undefined);
      }}><label>Nama berkas<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label><button className="button primary">Simpan nama</button></form>}
      {dialog.mode === "delete" && <div className="stack"><p>Hapus <strong>{dialog.record.name}</strong> dari ruang kerja?</p><button className="button danger" onClick={async () => {
        try { await deleteDocument(dialog.record.id); await refresh(); notify("Berkas dihapus."); setDialog(undefined); }
        catch { notify("Berkas gagal dihapus."); }
      }}>Hapus berkas</button></div>}
    </Modal>}
  </div>;
}
