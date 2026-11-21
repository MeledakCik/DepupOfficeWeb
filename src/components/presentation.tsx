"use client";

import { ChevronLeft, ChevronRight, Clock3, Maximize, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { imageBlob } from "@/lib/imaging";
import { readSlides, renderSlide, type Slide } from "@/lib/slides";
import { LocalImage } from "./media";
import { SelectBox } from "./select-box";

export default function Presentation({ file }: { file: Blob }) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState<{ slide: Slide; blob: Blob }>();
  const [start, setStart] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState("");
  const deck = useRef<HTMLDivElement>(null);
  const slide = slides[index];
  const lastIndex = slides.length - 1;

  useEffect(() => {
    let active = true;
    void readSlides(file).then((data) => {
      if (!active) return;
      setSlides(data);
      if (!data.length) setError("Presentasi tidak berisi slide.");
    }).catch(() => { if (active) setError("Presentasi tidak dapat dibuka."); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (!slide) return;
    let active = true;
    void renderSlide(slide).then((canvas) => imageBlob(canvas, "image/png")).then((blob) => {
      if (active) setPreview({ slide, blob });
    }).catch(() => { if (active) setError("Slide tidak dapat ditampilkan."); });
    return () => { active = false; };
  }, [slide]);

  useEffect(() => {
    if (start === undefined) return;
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 300);
    return () => clearInterval(timer);
  }, [start]);

  useEffect(() => {
    if (!auto || index >= lastIndex) return;
    const timer = setTimeout(() => {
      setIndex(index + 1);
      if (index + 1 === lastIndex) setAuto(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [auto, index, lastIndex]);

  function select(target: number) {
    const next = Math.max(0, Math.min(lastIndex, target));
    setIndex(next);
    if (next === lastIndex) setAuto(false);
  }

  function begin() {
    if (start === undefined) {
      setElapsed(0);
      setStart(performance.now());
    }
  }

  if (!slide) return <p className={error ? "error" : "notice"} role={error ? "alert" : "status"}>{error || "Memuat presentasi…"}</p>;
  const time = String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" + String(elapsed % 60).padStart(2, "0");
  return <div className="stack slide-deck" ref={deck} tabIndex={0} aria-label="Penampil presentasi"
    onKeyDown={(event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); select(index - 1); }
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); select(index + 1); }
    }}>
    <div className="presentation-stage" style={{ aspectRatio: slide.width / slide.height }}>
      {preview?.slide === slide ? <LocalImage key={index} blob={preview.blob} alt={"Slide " + (index + 1)} />
        : <p className="notice" role="status">Menyiapkan slide…</p>}
      <p className="sr-only">{slide.text}</p>
    </div>
    <div className="actions presentation-controls">
      <button className="icon-button" aria-label="Slide sebelumnya" disabled={index === 0} onClick={() => select(index - 1)}><ChevronLeft size={18} /></button>
      <SelectBox label="Lompat ke slide" value={index} options={slides.map((_, item) => [item, `Slide ${item + 1} / ${slides.length}`])} onChange={select} />
      <button className="icon-button" aria-label="Slide berikutnya" disabled={index >= lastIndex} onClick={() => select(index + 1)}><ChevronRight size={18} /></button>
      <button className="button secondary" disabled={index >= lastIndex} onClick={() => { begin(); setAuto(!auto); }}>
        {auto ? <Pause size={17} /> : <Play size={17} />} {auto ? "Jeda pemutaran" : "Putar otomatis"}
      </button>
      {start === undefined ? <button className="button secondary" onClick={begin}><Clock3 size={17} /> Mulai timer</button>
        : <><span className="presentation-timer" aria-label="Waktu presentasi">{time}</span>
          <button className="icon-button" aria-label="Hentikan timer" onClick={() => { setStart(undefined); setAuto(false); }}><Square size={17} /></button></>}
      <button className="button secondary" onClick={async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else { await deck.current?.requestFullscreen(); deck.current?.focus(); begin(); }
          setError("");
        } catch { setError("Layar penuh belum didukung browser ini."); }
      }}><Maximize size={17} /> Layar penuh</button>
    </div>
    {error && <p className="notice" role="status">{error}</p>}
  </div>;
}
