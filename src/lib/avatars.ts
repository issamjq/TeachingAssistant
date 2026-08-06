// Avatar sets for account profiles, split by gender (man / woman) so the
// picker can show the set that matches the teacher's choice at sign-up.
//
// Each entry is a clean square portrait badge in public/avatars/. The badges
// are pre-cropped so every head reads at the same size and sits in the same
// head-and-shoulders position, so they all render the same way:
//   size — "cover" frames the whole badge to the circle.
//   pos  — "center".
//
// To add more avatars, crop a square PNG so the head matches the existing set
// (~50% of the frame, face in the upper-middle), drop it in public/avatars/,
// and append it with `size: "cover", pos: "center"`.

const MAN = [
  { id: "m1", src: "/avatars/m1.png", size: "cover", pos: "center" }, // glasses + book
  { id: "m2", src: "/avatars/m2.png", size: "cover", pos: "center" }, // curly hair + pencil
  { id: "m3", src: "/avatars/m3.png", size: "cover", pos: "center" }, // grey beard
  { id: "m4", src: "/avatars/m4.png", size: "cover", pos: "center" }, // glasses, pointing up
  { id: "m5", src: "/avatars/m5.png", size: "cover", pos: "center" }, // beard, tablet + headphones
  { id: "m6", src: "/avatars/m6.png", size: "cover", pos: "center" }, // beard, speaking
];

const WOMAN = [
  { id: "w1", src: "/avatars/w1.png", size: "cover", pos: "center" }, // glasses, hand on chin
  { id: "w2", src: "/avatars/w2.png", size: "cover", pos: "center" }, // ponytail + books
  { id: "w3", src: "/avatars/w3.png", size: "cover", pos: "center" }, // bun + lightbulb
  { id: "w4", src: "/avatars/w4.png", size: "cover", pos: "center" }, // curly hair + notepad
  { id: "w5", src: "/avatars/w5.png", size: "cover", pos: "center" }, // speaking
  { id: "w6", src: "/avatars/w6.png", size: "cover", pos: "center" }, // hijab + tablet
];

export const AVATAR_SETS = { man: MAN, woman: WOMAN };

// Every avatar across both sets — used to resolve an id back to its art.
export const ALL_AVATARS = [...MAN, ...WOMAN];

// The set to show in the picker for a chosen gender (defaults to the man set).
export const avatarsFor = (gender) => AVATAR_SETS[gender] || MAN;

export const getAvatar = (id) => ALL_AVATARS.find((a) => a.id === id) || null;
