export type Appearance = {
  theme: "system" | "light" | "dark";
  blur: boolean;
  glass: boolean;
  dispersion: boolean;
  motion: boolean;
  fontScale: "normal" | "large";
};

export const appearanceDefaults: Appearance = {
  theme: "system", blur: true, glass: true, dispersion: false, motion: true, fontScale: "normal",
};

export const preferencesKey = "depup-preferences";

export function applyAppearance(appearance: Appearance) {
  Object.assign(document.documentElement.dataset, {
    theme: appearance.theme,
    font: appearance.fontScale,
    glass: String(appearance.glass),
    blur: String(appearance.blur),
    dispersion: String(appearance.dispersion),
    motion: String(appearance.motion),
  });
}
