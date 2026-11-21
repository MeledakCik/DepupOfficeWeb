export type Appearance = {
  theme: "system" | "light" | "dark";
  blur: boolean;
  glass: boolean;
  glassTone: number;
  glassBlur: number;
  dispersion: boolean;
  motion: boolean;
  fontScale: "normal" | "large";
};

export const appearanceDefaults: Appearance = {
  theme: "system", blur: true, glass: true, glassTone: 50, glassBlur: 50, dispersion: false, motion: true, fontScale: "normal",
};

export const preferencesKey = "depup-preferences";

export function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  Object.assign(root.dataset, {
    theme: appearance.theme,
    font: appearance.fontScale,
    glass: String(appearance.glass),
    blur: String(appearance.blur),
    dispersion: String(appearance.dispersion),
    motion: String(appearance.motion),
  });
  const tone = Math.max(0, Math.min(100, Number(appearance.glassTone) || 0));
  const blur = Math.max(0, Math.min(100, Number(appearance.glassBlur) || 0));
  root.style.setProperty("--glass-opacity", 74 + tone * .24 + "%");
  root.style.setProperty("--glass-blur", blur * .24 + "px");
}
