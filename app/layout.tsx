import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/features/auth/session-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Murchid",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${lora.variable}`}>
      <body>
        {/*
THESIS: one calm pipeline, not a feature-pile LMS — the surface reads as a
focused study, not a dashboard of widgets.
OWN-WORLD: warm cream ground, white cards, deep forest-green primary,
pale-sage active/hover states, Lora serif for page and content titles,
Inter for UI and body, soft shadows, moderate-to-full rounded corners.
STORY: a teacher opens the app, sees exactly where they are (batch, grade,
division, subject) and what's next, and creates or edits one thing at a
time without hunting for it.
FIRST VIEWPORT: white sidebar with a pale-green active pill at left; cream
content column; page title in serif; the one dark-green pill on the page
is always the primary action.
FORM: user-supplied reference screenshots (a separate product, visual
reference only) treated as the approved comp — reproduced token-for-token
where the app's existing structure allows, adapted to Murchid's own
routes and content.
FINISH: unreviewed and undocumented is unfinished; this build ends with
the finish review, the verdict, DESIGN.md, and every shipping raster
carrying its provenance.
        */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
