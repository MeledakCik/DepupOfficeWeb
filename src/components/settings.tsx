"use client";

import { Folder, LockKeyhole, ShieldCheck } from "lucide-react";
import { formatSize, type DocumentRecord, type Preferences } from "@/lib/workspace";

export function Settings({ documents, preferences, change, outputs, vault, privacy }: {
  documents: DocumentRecord[]; preferences: Preferences; change: (preferences: Preferences) => void;
  outputs: () => void; vault: () => void; privacy: () => void;
}) {
  function choice<K extends keyof Preferences>(key: K, label: string, items: [Preferences[K], string][]) {
    return <label>{label}<select value={String(preferences[key])} onChange={(event) => {
      const item = items.find(([value]) => String(value) === event.target.value);
      if (item) change({ ...preferences, [key]: item[0] });
    }}>{items.map(([value, text]) => <option key={String(value)} value={String(value)}>{text}</option>)}</select></label>;
  }
  function toggle(key: keyof Preferences, label: string) {
    return <label>{label}<input type="checkbox" checked={Boolean(preferences[key])} onChange={(event) => change({ ...preferences, [key]: event.target.checked })} /></label>;
  }
  return <div className="settings-grid">
    <section className="panel settings"><h2>Penyimpanan</h2><p>{documents.length} berkas · {formatSize(documents.reduce((sum, file) => sum + file.size, 0))}</p>
      <button className="button secondary" onClick={outputs}><Folder size={17} /> Lihat hasil olahan</button>
      <button className="button secondary" onClick={vault}><LockKeyhole size={17} /> Buka brankas</button>
    </section>
    <section className="panel settings"><h2>Tampilan</h2>
      {choice("theme", "Tema", [["system", "Ikuti perangkat"], ["light", "Terang"], ["dark", "Gelap"]])}
      {choice("fontScale", "Ukuran antarmuka", [["normal", "Normal"], ["large", "Besar"]])}
      {toggle("blur", "Transparansi navigasi")}{toggle("glass", "Kilau kaca")}{toggle("dispersion", "Dispersi warna")}{toggle("motion", "Animasi antarmuka")}
    </section>
    <section className="panel settings"><h2>Format bawaan</h2>
      {choice("paper", "Kertas Word", [["A4", "A4"], ["Letter", "Letter"]])}
      {choice("margin", "Margin Word", [["normal", "Normal"], ["narrow", "Sempit"]])}
      {choice("textSize", "Ukuran teks Word", [10, 11, 12, 14, 16, 18].map((size) => [size, `${size} pt`]))}
      {choice("lineHeight", "Spasi Word", [1, 1.5, 2].map((size) => [size, String(size)]))}
      {toggle("gridlines", "Garis kisi Excel")}
      {choice("currency", "Mata uang", ["IDR", "USD", "EUR"].map((currency) => [currency, currency]))}
      {toggle("autosum", "Jumlah otomatis Excel")}
      {choice("zoom", "Zoom PDF", [[0.75, "75%"], [1, "100%"], [1.25, "125%"]])}
      {choice("reader", "Tema baca PDF", [["natural", "Normal"], ["warm", "Hangat"], ["night", "Malam"]])}
      {choice("pdfLayout", "Tata letak PDF", [["continuous", "Gulir berkelanjutan"], ["single", "Satu halaman"]])}
    </section>
    <section className="panel settings"><h2>Dukungan</h2>
      <button className="button secondary" onClick={privacy}><ShieldCheck size={17} /> Privasi & cara pakai</button>
      <a className="button secondary" href="mailto:depupdev@gmail.com">Kirim masukan</a>
      <a className="button secondary" href="https://saweria.co/depupdonate" target="_blank" rel="noreferrer">Dukung pengembang</a>
    </section>
  </div>;
}
