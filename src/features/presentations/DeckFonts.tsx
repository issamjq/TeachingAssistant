"use client";

import { useEffect } from "react";

// The presentation typefaces — loaded only inside the slide builder.
//
// These 19 families exist for exactly one reason: the SlideBuilder theme
// picker offers them as deck faces (see the FONTS table in
// src/views/SlideBuilder.jsx). They used to sit in the root layout's single
// Google Fonts <link>, which meant every visitor to the marketing page paid
// for Shrikhand, Pacifico and Dancing Script before they could read a
// headline. Measured: 113.7KB of render-blocking CSS, of which these were
// the bulk, gating first paint by 280-370ms.
//
// Mounting this component requests them. Nothing else in the app should.
//
// The stylesheet is injected rather than declared so it never blocks the
// builder's own first paint: a teacher opening the slide builder sees the
// UI immediately and the theme picker's previews restyle as the faces
// arrive. Left in place once fetched — a teacher who opened the picker once
// will open it again, and the bytes are already spent.

const DECK_FONTS_ID = "murchid-deck-fonts";
const DECK_FONTS_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400" +
  "&family=Lora:ital,wght@0,400;0,600;1,400" +
  "&family=EB+Garamond:ital,wght@0,400;0,600;1,400" +
  "&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400" +
  "&family=Source+Serif+4:ital,wght@0,400;0,600;1,400" +
  "&family=Crimson+Pro:ital,wght@0,400;0,600;1,400" +
  "&family=Manrope:wght@400;600;700" +
  "&family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;1,400" +
  "&family=Space+Grotesk:wght@400;500;700" +
  "&family=DM+Sans:ital,wght@0,400;0,600;1,400" +
  "&family=Outfit:wght@400;600;700" +
  "&family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400" +
  "&family=Space+Mono:ital,wght@0,400;0,700;1,400" +
  "&family=Bebas+Neue" +
  "&family=Shrikhand" +
  "&family=Pacifico" +
  "&family=Caveat:wght@400;600" +
  "&family=Dancing+Script:wght@400;600" +
  // The Arabic deck themes ship here too, not only on the Arabic UI path:
  // a teacher working in English can still set an Arabic deck face, and
  // that must not fall back to a system serif. The woff2 files are the
  // same URLs LanguageProvider requests, so a bilingual teacher pays for
  // them once.
  "&family=Amiri:wght@400;700" +
  "&family=Cairo:wght@400;600;700" +
  "&family=Reem+Kufi:wght@400;600" +
  "&display=swap";

/**
 * Requests the deck typefaces. Render once, anywhere inside the slide
 * builder. Renders nothing.
 */
export default function DeckFonts() {
  useEffect(() => {
    if (document.getElementById(DECK_FONTS_ID)) return;
    const link = document.createElement("link");
    link.id = DECK_FONTS_ID;
    link.rel = "stylesheet";
    link.href = DECK_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  return null;
}
