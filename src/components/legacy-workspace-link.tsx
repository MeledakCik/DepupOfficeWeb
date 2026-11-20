"use client";

import { useEffect } from "react";
import { appearanceDefaults, applyAppearance, preferencesKey } from "@/lib/appearance";

const legacySections = new Set(["#beranda", "#dokumen", "#scan", "#alat", "#saya"]);

export function LegacyWorkspaceLink() {
  useEffect(() => {
    const { hash } = window.location;
    if (legacySections.has(hash)) {
      window.location.replace("/office/" + hash);
      return;
    }
    try {
      applyAppearance({ ...appearanceDefaults, ...JSON.parse(localStorage.getItem(preferencesKey) ?? "{}") });
    } catch { /* Use device preferences when browser storage is unavailable. */ }
  }, []);
  return null;
}
