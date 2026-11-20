"use client";

import { useEffect, useState } from "react";

export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    let active = true;
    queueMicrotask(() => { if (active) setUrl(next); });
    return () => { active = false; URL.revokeObjectURL(next); };
  }, [blob]);
  return blob ? url : "";
}

export function LocalImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  // Blob URLs are private previews and are served directly by the browser.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className={className} /> : null;
}
