"use client";

import { Bold, ChevronLeft, ChevronRight, Download, FunctionSquare, Italic, Plus, Save, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Workbook } from "exceljs";
import { baseName } from "@/lib/catalog";
import { cellKey, columnName, displaySheetValue, emptySheet, formulaEvaluator, readDelimited, readSheets, writeSheets, type SheetCell, type SheetData } from "@/lib/office";
import { sheetTemplate } from "@/lib/templates";
import { download, type Output, type Preferences, type StoredDocument } from "@/lib/workspace";
import { SelectBox } from "./select-box";

const pageRows = 28;
const pageCols = 12;
const defaultCell: SheetCell = { value: "" };
const coordinates = (name: string) => name.split(":").map(Number);

export default function SheetEditor({ record, template, preferences, save }: {
  record?: StoredDocument; template?: string; preferences: Preferences; save: (output: Output) => Promise<unknown>;
}) {
  const initial = useMemo(() => sheetTemplate(template), [template]);
  const [name, setName] = useState(record ? baseName(record.name) : initial.name);
  const [sheets, setSheets] = useState(initial.sheets);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([1, 1]);
  const [editing, setEditing] = useState("");
  const [rowStart, setRowStart] = useState(1);
  const [columnStart, setColumnStart] = useState(1);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!record);
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [calculate, setCalculate] = useState<Awaited<ReturnType<typeof formulaEvaluator>>>();
  const workbook = useRef<Workbook | undefined>(undefined);
  const grid = useRef<HTMLDivElement>(null);
  const sheet = sheets[index];
  const [y, x] = selected;
  const selectedCell = sheet.cells[cellKey(y, x)] ?? defaultCell;

  useEffect(() => {
    if (!record) return;
    let active = true;
    void readSheets(record.data, record.name).then((result) => {
      if (!active) return;
      setSheets(result.sheets);
      workbook.current = result.workbook;
      setReady(true);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Spreadsheet tidak dapat dibuka."); });
    return () => { active = false; };
  }, [record]);

  useEffect(() => {
    let active = true;
    void formulaEvaluator(sheets).then((next) => { if (active) setCalculate(() => next); }).catch(() => {});
    return () => { active = false; };
  }, [sheets]);

  function update(change: (previous: SheetData) => SheetData) {
    setSheets((previous) => previous.map((item, i) => i === index ? change(item) : item));
    setStatus("");
  }

  function changeCell(row: number, col: number, change: Partial<SheetCell>) {
    const key = cellKey(row, col);
    update((data) => ({ ...data, cells: { ...data.cells, [key]: { ...(data.cells[key] ?? defaultCell), ...change } } }));
  }
  function focusCell(row: number, col: number) {
    const boundedRow = Math.max(1, Math.min(row, sheet.rows));
    const boundedColumn = Math.max(1, Math.min(col, sheet.columns));
    setSelected([boundedRow, boundedColumn]);
    if (boundedRow < rowStart || boundedRow >= rowStart + pageRows) setRowStart(Math.floor((boundedRow - 1) / pageRows) * pageRows + 1);
    if (boundedColumn < columnStart || boundedColumn >= columnStart + pageCols) setColumnStart(Math.floor((boundedColumn - 1) / pageCols) * pageCols + 1);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLInputElement>("[data-cell='" + cellKey(boundedRow, boundedColumn) + "']")?.focus());
  }
  function keypress(event: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(row + (event.shiftKey ? -1 : 1), col);
    } else if (event.altKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      focusCell(row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0), col + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0));
    }
  }
  function addSheet() {
    let index = sheets.length + 1;
    while (sheets.some((item) => item.name === "Sheet" + index)) index++;
    setSheets((previous) => [...previous, emptySheet("Sheet" + index)]);
    selectSheet(sheets.length);
  }
  function selectSheet(next: number) {
    setIndex(next); setEditing(""); setSelected([1, 1]); setRowStart(1); setColumnStart(1);
  }
  function sum() {
    const column = columnName(x);
    const end = y - 1;
    if (end < 1) { setStatus("Pilih sel di bawah angka yang akan dijumlahkan."); return; }
    changeCell(y, x, { value: "=SUM(" + column + "1:" + column + end + ")" });
  }
  function replace(all: boolean) {
    if (!find) return;
    const matches = Object.keys(sheet.cells).filter((key) => sheet.cells[key].value.toLowerCase().includes(find.toLowerCase()));
    if (!matches.length) { setStatus("Data tidak ditemukan."); return; }
    if (!all) {
      const [row, col] = coordinates(matches[0]);
      focusCell(row, col);
      setStatus("Data ditemukan di " + columnName(col) + row + ".");
    } else {
      update((data) => ({
        ...data,
        cells: Object.fromEntries(Object.entries(data.cells).map(([key, cell]) => [key, matches.includes(key) ? { ...cell, value: cell.value.split(find).join(replacement) } : cell])),
      }));
      setStatus("Pencarian selesai. Huruf besar dan kecil dipertahankan saat mengganti.");
    }
  }
  async function exportFile(action: "save" | "download" | "csv" | "pdf") {
    setBusy(true); setError(""); setStatus("");
    try {
      const title = name.trim().replace(/[\\/:*?"<>|]/g, "-") || "Spreadsheet";
      if (action === "csv") {
        const lastRow = Math.max(1, ...Object.keys(sheet.cells).map((key) => coordinates(key)[0]));
        const lastColumn = Math.max(1, ...Object.keys(sheet.cells).map((key) => coordinates(key)[1]));
        const csv = Array.from({ length: lastRow }, (_, row) => Array.from({ length: lastColumn }, (_, col) => {
          const key = cellKey(row + 1, col + 1);
          const entry = sheet.cells[key];
          let value = entry?.value.startsWith("=") ? String(calculate?.(sheet.name, row + 1, col + 1) ?? "") : (entry?.value ?? "").replace(/^'/, "");
          if (/^\s*[=+@-]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value)) value = "'" + value;
          return '"' + value.replace(/"/g, '""') + '"';
        }).join(",")).join("\r\n");
        download(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), title + ".csv");
      } else {
        const output = await writeSheets(sheets, title, preferences.gridlines, workbook.current);
        if (action === "download") download(output.blob, output.name);
        else if (action === "pdf") {
          const { runTool } = await import("@/lib/tool-engine");
          const result = await runTool("office-pdf", [new File([output.blob], output.name, { type: output.blob.type })], {}, preferences);
          if (result.outputs?.[0]) { await save(result.outputs[0]); setStatus("Salinan PDF tersimpan."); }
        } else { await save(output); setStatus("Salinan XLSX tersimpan."); }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Spreadsheet gagal diekspor."); }
    finally { setBusy(false); }
  }
  const rows = Array.from({ length: Math.min(pageRows, Math.max(0, sheet.rows - rowStart + 1)) }, (_, i) => rowStart + i);
  const columns = Array.from({ length: Math.min(pageCols, Math.max(0, sheet.columns - columnStart + 1)) }, (_, i) => columnStart + i);
  return <div className="stack">
    {!ready && !error && <p className="notice" role="status">Memuat spreadsheet…</p>}
    {ready && <>
      <div className="form-grid"><label>Nama spreadsheet<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Nama lembar<input key={index} defaultValue={sheet.name} maxLength={31} onBlur={(event) => {
          const next = event.target.value.trim();
          if (!next || /[\\/:*?[\]]/.test(next) || sheets.some((item, i) => i !== index && item.name.toLowerCase() === next.toLowerCase())) {
            setError("Nama lembar harus unik dan tanpa karakter khusus."); event.target.value = sheet.name; return;
          }
          if (next !== sheet.name) update((item) => ({ ...item, name: next }));
          setError("");
        }} /></label></div>
      <div className="editor-toolbar">
        <button aria-label="Tebal" title="Tebal" aria-pressed={!!selectedCell.bold} onClick={() => changeCell(y, x, { bold: !selectedCell.bold })}><Bold size={16} /></button>
        <button aria-label="Miring" title="Miring" aria-pressed={!!selectedCell.italic} onClick={() => changeCell(y, x, { italic: !selectedCell.italic })}><Italic size={16} /></button>
        <input type="color" value={selectedCell.fill ?? "#ffffff"} aria-label="Warna sel" onChange={(event) => changeCell(y, x, { fill: event.target.value })} />
        <SelectBox label="Format angka" value={selectedCell.format?.includes(preferences.currency) ? "money" : selectedCell.format === "0.00%" ? "percent" : "General"}
          options={[["General", "Umum"], ["money", "Mata uang"], ["percent", "Persentase"]]} onChange={(value) =>
            changeCell(y, x, { format: value === "money" ? '"' + preferences.currency + '" #,##0.00' : value === "percent" ? "0.00%" : "General" })} />
        <button aria-label="Jumlah otomatis" title="Jumlah otomatis" onClick={sum}><FunctionSquare size={16} /> SUM</button>
        {preferences.autosum && y > 1 && <button onClick={sum}>Jumlah kolom {columnName(x)}</button>}
        <button aria-pressed={finding} onClick={() => setFinding(!finding)}><Search size={16} /> Cari</button>
        <button onClick={() => {
          const row = sheet.rows + 1;
          if (row > 1048576) return;
          update((item) => ({ ...item, rows: row })); setSelected([row, x]); setRowStart(Math.floor((row - 1) / pageRows) * pageRows + 1);
        }}><Plus size={16} /> Baris</button>
        <button onClick={() => {
          const next = sheet.columns + 1;
          if (next > 16384) return;
          update((item) => ({ ...item, columns: next })); setSelected([y, next]); setColumnStart(Math.floor((next - 1) / pageCols) * pageCols + 1);
        }}><Plus size={16} /> Kolom</button>
      </div>
      {finding && <div className="form-grid"><label>Cari nilai<input value={find} onChange={(event) => setFind(event.target.value)} /></label>
        <label>Ganti dengan<input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
        <div className="actions"><button className="button secondary" onClick={() => replace(false)}>Cari</button><button className="button secondary" onClick={() => replace(true)}>Ganti semua</button></div></div>}
      <label>Sel {columnName(x)}{y}<input value={selectedCell.value} placeholder="Masukkan teks, angka, atau rumus seperti =SUM(A1:A4)" onChange={(event) => changeCell(y, x, { value: event.target.value })} /></label>
      <div className="sheet-scroll" ref={grid}>
        <table className={"spreadsheet" + (preferences.gridlines ? "" : " no-lines")} aria-label={"Lembar " + sheet.name}><thead><tr><th scope="col">#</th>{columns.map((column) => <th key={column} scope="col">{columnName(column)}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row}><th scope="row">{row}</th>{columns.map((column) => {
            const key = cellKey(row, column);
            const cell = sheet.cells[key] ?? defaultCell;
            const isSelected = y === row && x === column;
            const computed = calculate && (cell.value.startsWith("=") || cell.format || cell.value.startsWith("'"))
              ? displaySheetValue(calculate(sheet.name, row, column), cell.format, preferences.currency) : cell.value;
            return <td key={key}><input data-cell={key} aria-label={columnName(column) + row} className={isSelected ? "selected" : ""}
              style={{ fontWeight: cell.bold ? 700 : 400, fontStyle: cell.italic ? "italic" : "normal", backgroundColor: cell.fill, color: cell.fill ? "#161715" : undefined }}
              value={editing === key ? cell.value : computed}
              onFocus={() => { setSelected([row, column]); setEditing(key); }} onBlur={() => setEditing("")}
              onKeyDown={(event) => keypress(event, row, column)} onChange={(event) => changeCell(row, column, { value: event.target.value })}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text/plain");
                if (!/[\t\n]/.test(text)) return;
                event.preventDefault();
                const entries = readDelimited(text, "\t");
                update((data) => {
                  const next = { ...data.cells };
                  entries.forEach((line, r) => line.forEach((value, c) => {
                    const key = cellKey(row + r, column + c);
                    next[key] = { ...next[key], value: value.startsWith("=") ? "'" + value : value };
                  }));
                  return { ...data, cells: next, rows: Math.max(data.rows, row + entries.length - 1), columns: Math.max(data.columns, column + Math.max(...entries.map((line) => line.length)) - 1) };
                });
              }} /></td>;
          })}</tr>)}</tbody></table>
      </div>
      <div className="actions">
        <button className="icon-button" aria-label="Baris sebelumnya" disabled={rowStart <= 1} onClick={() => setRowStart(rowStart - pageRows)}><ChevronLeft size={16} /></button>
        <span>Baris {rowStart}–{rows.at(-1)}</span>
        <button className="icon-button" aria-label="Baris berikutnya" disabled={rowStart + pageRows > sheet.rows} onClick={() => setRowStart(rowStart + pageRows)}><ChevronRight size={16} /></button>
        <button className="icon-button" aria-label="Kolom sebelumnya" disabled={columnStart <= 1} onClick={() => setColumnStart(columnStart - pageCols)}><ChevronLeft size={16} /></button>
        <span>Kolom {columnName(columnStart)}–{columnName(columns.at(-1) ?? columnStart)}</span>
        <button className="icon-button" aria-label="Kolom berikutnya" disabled={columnStart + pageCols > sheet.columns} onClick={() => setColumnStart(columnStart + pageCols)}><ChevronRight size={16} /></button>
      </div>
      <div className="chips">{sheets.map((item, i) => <button key={i} aria-pressed={i === index} onClick={() => selectSheet(i)}>{item.name}</button>)}<button onClick={addSheet}><Plus size={16} /> Tambah lembar</button></div>
      <div className="actions">
        <button className="button primary" disabled={busy} onClick={() => void exportFile("save")}><Save size={16} /> Simpan XLSX</button>
        <button className="button secondary" disabled={busy} onClick={() => void exportFile("download")}><Download size={16} /> Unduh XLSX</button>
        <button className="button secondary" disabled={busy} onClick={() => void exportFile("csv")}>Unduh CSV</button>
        <button className="button secondary" disabled={busy} onClick={() => void exportFile("pdf")}>Simpan PDF</button>
      </div>
    </>}
    {record && <button className="text-button" onClick={() => download(record.data, record.name)}>Unduh berkas asli</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {status && <p className="success" role="status">{status}</p>}
  </div>;
}
