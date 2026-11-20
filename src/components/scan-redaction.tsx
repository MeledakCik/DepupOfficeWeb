"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { Point, Redaction } from "@/lib/imaging";
import { LocalImage } from "./media";

export default function ScanRedaction({ image, editing, add }: {
  image: Blob; editing: boolean; add: (area: Redaction) => void;
}) {
  const start = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Redaction>();

  function areaAt(event: PointerEvent<HTMLDivElement>): Redaction | undefined {
    if (!start.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    return { x: Math.min(x, start.current.x), y: Math.min(y, start.current.y),
      width: Math.abs(x - start.current.x), height: Math.abs(y - start.current.y) };
  }

  return <div className={"scan-redaction" + (editing ? " drawing" : "")}
    data-testid="scan-redaction"
    onPointerDown={(event) => {
      if (!editing || event.button !== 0) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      start.current = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => { if (start.current) setDraft(areaAt(event)); }}
    onPointerUp={(event) => {
      const area = areaAt(event);
      if (area && area.width > .004 && area.height > .004) add(area);
      start.current = null;
      setDraft(undefined);
    }}
    onLostPointerCapture={() => { start.current = null; setDraft(undefined); }}>
    <LocalImage blob={image} alt="Pratinjau halaman scan" />
    {draft && <span className="redaction-draft" aria-hidden="true" style={{
      left: draft.x * 100 + "%", top: draft.y * 100 + "%", width: draft.width * 100 + "%", height: draft.height * 100 + "%",
    }} />}
  </div>;
}
