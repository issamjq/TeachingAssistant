// Avatar set for account profiles. These reuse the brand's own teacher
// illustrations (public/s1.x.png — the same scenes shown in the landing
// index) cropped to each person's face via a CSS background crop, so they
// match the art exactly without needing separate portrait assets.
//
//   size  — background-size width (% of the avatar box); larger = more zoom
//   pos   — background-position (focal point: the person's face)
//
// Framing values were tuned per scene by rendering (people sit at laptops,
// so each face is in a different spot of the full scene).
export const AVATARS = [
  { id: "a1", src: "/s1.1.png", size: "270%", pos: "33% 47%" },
  { id: "a2", src: "/s1.2.png", size: "270%", pos: "50% 44%" },
  { id: "a3", src: "/s1.3.png", size: "270%", pos: "47% 45%" },
  { id: "a4", src: "/s1.4.png", size: "265%", pos: "30% 47%" },
  { id: "a5", src: "/s1.5.png", size: "270%", pos: "45% 45%" },
  { id: "a6", src: "/s1.6.png", size: "265%", pos: "31% 49%" },
];

export const getAvatar = (id) => AVATARS.find((a) => a.id === id) || null;
