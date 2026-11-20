"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({ title, children, close, wide = false, reader = false }: {
  title: string; children: ReactNode; close: () => void; wide?: boolean; reader?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    document.body.classList.add("modal-open");
    return () => {
      element?.close();
      document.body.classList.remove("modal-open");
    };
  }, []);
  return <dialog ref={dialog} className={reader ? "dialog dialog-reader" : wide ? "dialog dialog-wide" : "dialog"} aria-labelledby="dialog-title"
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) close();
    }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2>
      <button type="button" className="icon-button" aria-label="Tutup" onClick={close}><X size={20} /></button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

export function ScanArtwork() {
  return <div className="scan-art" aria-hidden="true">
    <div className="scan-grid" />
    <div className="scan-paper shadow-paper" />
    <div className="scan-paper front-paper"><div className="paper-fold" /><i /><b /><b /><b /><b /><span className="paper-seal"><span /></span></div>
    <div className="scan-brackets"><i /><i /><i /><i /></div>
    <div className="scan-light" />
  </div>;
}
