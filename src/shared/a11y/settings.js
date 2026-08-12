// The accessibility settings, and the one function that puts them on the
// page.
//
// This lives outside the widget because the widget is not always mounted.
// It sits inside the assistant's Accessibility tab, which means it exists
// only while that panel is open — so for a long time these settings were
// applied when you changed them and forgotten on the next page load. A
// teacher who set large text got large text until they reloaded. The
// values and the apply step therefore belong here, where the boot script
// in app/layout.tsx and the widget can both reach them.

export const STORAGE_KEY = "murchid.a11y";

export const DEFAULTS = {
  textStep: 0,        // 0..4  → zoom 1, 1.1, 1.2, 1.35, 1.5
  readableFont: false,
  letterStep: 0,      // 0..3
  wordStep: 0,        // 0..3
  lineStep: 0,        // 0..3
  contrast: false,
  grayscale: false,
  lowSat: false,
  colorBlind: "off",   // off | prot | deut | trit
  bigCursor: false,
  highlightLinks: false,
  stopAnim: false,
  readAloud: false,
};

export const ZOOMS = [1, 1.1, 1.2, 1.35, 1.5];
export const LETTER = [0, 0.06, 0.12, 0.2];      // em
export const WORD = [0, 0.1, 0.22, 0.4];         // em
export const LINE = [1.5, 1.7, 2, 2.4];          // unitless (applied when step>0)

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Write one settings object onto #root.
 *
 * #root, not <html>: the widget's own launcher and panel are portalled
 * outside it precisely so the colour filters and zoom below cannot warp
 * the controls used to turn them off.
 */
export function applyToRoot(s) {
  const root = document.getElementById("root");
  if (!root) return;
  const st = root.style;
  st.setProperty("--a11y-zoom", String(ZOOMS[s.textStep] || 1));
  st.setProperty("--a11y-letter", `${LETTER[s.letterStep] || 0}em`);
  st.setProperty("--a11y-word", `${WORD[s.wordStep] || 0}em`);
  st.setProperty("--a11y-line", String(LINE[s.lineStep] || 1.5));

  // Combine every colour transform into ONE inline filter so a
  // colour-blind SVG filter can stack with contrast/grayscale instead
  // of competing class rules clobbering each other.
  const f = [];
  if (s.colorBlind && s.colorBlind !== "off") f.push(`url(#a11y-cb-${s.colorBlind})`);
  if (s.grayscale) f.push("grayscale(1)");
  else if (s.lowSat) f.push("saturate(0.45)");
  if (s.contrast) f.push("contrast(1.32)");
  st.filter = f.join(" ");

  const cl = root.classList;
  cl.toggle("a11y-zoom-on", s.textStep > 0);
  cl.toggle("a11y-readable", s.readableFont);
  cl.toggle("a11y-spaced", s.letterStep > 0 || s.wordStep > 0 || s.lineStep > 0);
  cl.toggle("a11y-contrast", s.contrast);
  cl.toggle("a11y-big-cursor", s.bigCursor);
  cl.toggle("a11y-hl-links", s.highlightLinks);
  cl.toggle("a11y-stop-anim", s.stopAnim);
  cl.toggle("a11y-read-aloud", s.readAloud);
}
