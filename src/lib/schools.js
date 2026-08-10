// UAE schools catalog (seed data).
//
// Imported by:
//   - db/seed.js — seeded into the `schools` table by `npm run db:seed`
//   - frontend            — only via /api/schools (not imported directly)
//
// Coverage is broad-but-not-exhaustive: a curated sample of public and
// private schools across all 7 emirates so the picker has realistic
// content out of the box. Bilingual (EN + AR) names since the rest of
// the UI is bilingual. When a real directory feed exists, this list is
// replaced by an import job — the table schema is the long-lived part.
//
// Schema (mirrors the schools table):
//   name       — English name
//   name_ar    — Arabic name
//   emirate    — one of EMIRATES below
//   city       — sub-locale within the emirate (free text)
//   type       — "Public" | "Private"
//   curriculum — "MOE" | "British" | "American" | "IB" | "Indian" | "French" | "Other"

export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export const SCHOOL_TYPES = ["Public", "Private"];

export const SCHOOL_CURRICULA = [
  "MOE",
  "British",
  "American",
  "IB",
  "Indian",
  "French",
  "Other",
];

// Curated sample. ~50 schools across all emirates, mix of public/private
// and curricula. Names are recognisable but treat this as illustrative —
// not an authoritative registry.
export const UAE_SCHOOLS = [
  // ── Abu Dhabi ───────────────────────────────────────────────────────────
  { name: "Al Mushrif School",                     name_ar: "مدرسة المشرف",                        emirate: "Abu Dhabi",      city: "Al Mushrif",       type: "Public",  curriculum: "MOE" },
  { name: "Al Bateen Academy",                     name_ar: "أكاديمية البطين",                     emirate: "Abu Dhabi",      city: "Al Bateen",        type: "Public",  curriculum: "IB" },
  { name: "Cranleigh Abu Dhabi",                   name_ar: "مدرسة كرانلي أبوظبي",                emirate: "Abu Dhabi",      city: "Saadiyat Island",  type: "Private", curriculum: "British" },
  { name: "American Community School of Abu Dhabi", name_ar: "المدرسة الأمريكية المجتمعية بأبوظبي", emirate: "Abu Dhabi",      city: "Al Mushrif",       type: "Private", curriculum: "American" },
  { name: "Brighton College Abu Dhabi",            name_ar: "كلية برايتون أبوظبي",                emirate: "Abu Dhabi",      city: "Bloom Gardens",    type: "Private", curriculum: "British" },
  { name: "Repton School Abu Dhabi",               name_ar: "مدرسة ريبتون أبوظبي",                emirate: "Abu Dhabi",      city: "Rowdhat",          type: "Private", curriculum: "British" },
  { name: "Al Yasmina Academy",                    name_ar: "أكاديمية الياسمينة",                  emirate: "Abu Dhabi",      city: "Khalifa City",     type: "Private", curriculum: "British" },
  { name: "GEMS American Academy Abu Dhabi",       name_ar: "أكاديمية جيمس الأمريكية أبوظبي",      emirate: "Abu Dhabi",      city: "Khalifa City",     type: "Private", curriculum: "American" },
  { name: "Al Ain English Speaking School",        name_ar: "مدرسة العين الناطقة بالإنجليزية",     emirate: "Abu Dhabi",      city: "Al Ain",           type: "Private", curriculum: "British" },
  { name: "Al Ain Juniors School",                 name_ar: "مدرسة العين للناشئين",                emirate: "Abu Dhabi",      city: "Al Ain",           type: "Private", curriculum: "Indian" },

  // ── Dubai ───────────────────────────────────────────────────────────────
  { name: "Rashid School for Boys",                name_ar: "مدرسة راشد للبنين",                  emirate: "Dubai",          city: "Oud Metha",        type: "Public",  curriculum: "MOE" },
  { name: "Latifa School for Girls",               name_ar: "مدرسة لطيفة للبنات",                 emirate: "Dubai",          city: "Oud Metha",        type: "Public",  curriculum: "MOE" },
  { name: "Dubai English Speaking School",         name_ar: "مدرسة دبي الناطقة بالإنجليزية",      emirate: "Dubai",          city: "Oud Metha",        type: "Private", curriculum: "British" },
  { name: "Jumeirah College",                      name_ar: "كلية جميرا",                         emirate: "Dubai",          city: "Al Safa",          type: "Private", curriculum: "British" },
  { name: "GEMS Wellington International School",  name_ar: "مدرسة جيمس ولينغتون الدولية",        emirate: "Dubai",          city: "Al Sufouh",        type: "Private", curriculum: "British" },
  { name: "GEMS Modern Academy",                   name_ar: "أكاديمية جيمس مودرن",                emirate: "Dubai",          city: "Nad Al Sheba",     type: "Private", curriculum: "Indian" },
  { name: "Dubai American Academy",                name_ar: "أكاديمية دبي الأمريكية",             emirate: "Dubai",          city: "Al Barsha",        type: "Private", curriculum: "American" },
  { name: "Dubai International Academy",           name_ar: "أكاديمية دبي العالمية",              emirate: "Dubai",          city: "Emirates Hills",   type: "Private", curriculum: "IB" },
  { name: "Repton School Dubai",                   name_ar: "مدرسة ريبتون دبي",                   emirate: "Dubai",          city: "Nad Al Sheba",     type: "Private", curriculum: "British" },
  { name: "Kings' School Dubai",                   name_ar: "مدرسة كينجز دبي",                   emirate: "Dubai",          city: "Al Barsha South",  type: "Private", curriculum: "British" },
  { name: "Nord Anglia International School Dubai", name_ar: "مدرسة نورد أنجليا الدولية دبي",     emirate: "Dubai",          city: "Al Barsha",        type: "Private", curriculum: "British" },
  { name: "Dubai British School Jumeirah Park",    name_ar: "مدرسة دبي البريطانية جميرا بارك",    emirate: "Dubai",          city: "Jumeirah Park",    type: "Private", curriculum: "British" },
  { name: "Lycée Français International Georges Pompidou", name_ar: "ليسيه فرنسا الدولية جورج بومبيدو", emirate: "Dubai",   city: "Oud Metha",        type: "Private", curriculum: "French" },
  { name: "Indian High School Dubai",              name_ar: "المدرسة الهندية العليا دبي",        emirate: "Dubai",          city: "Oud Metha",        type: "Private", curriculum: "Indian" },
  { name: "JSS Private School",                    name_ar: "مدرسة جي إس إس الخاصة",            emirate: "Dubai",          city: "Al Safa",          type: "Private", curriculum: "Indian" },

  // ── Sharjah ─────────────────────────────────────────────────────────────
  { name: "Al Qasimia School",                     name_ar: "مدرسة القاسمية",                     emirate: "Sharjah",        city: "Al Qasimia",       type: "Public",  curriculum: "MOE" },
  { name: "Sharjah English School",                name_ar: "مدرسة الشارقة الإنجليزية",           emirate: "Sharjah",        city: "Al Juraina",       type: "Private", curriculum: "British" },
  { name: "GEMS Westminster School Sharjah",       name_ar: "مدرسة جيمس وستمنستر الشارقة",       emirate: "Sharjah",        city: "Al Goaz",          type: "Private", curriculum: "British" },
  { name: "Wesgreen International School",         name_ar: "مدرسة ويسجرين الدولية",             emirate: "Sharjah",        city: "Al Sharqan",       type: "Private", curriculum: "British" },
  { name: "Victoria International School Sharjah", name_ar: "مدرسة فيكتوريا الدولية الشارقة",     emirate: "Sharjah",        city: "Al Khan",          type: "Private", curriculum: "IB" },
  { name: "Delhi Private School Sharjah",          name_ar: "مدرسة دلهي الخاصة الشارقة",          emirate: "Sharjah",        city: "Muweilah",         type: "Private", curriculum: "Indian" },

  // ── Ajman ───────────────────────────────────────────────────────────────
  { name: "Al Ittihad Private School Ajman",       name_ar: "مدرسة الاتحاد الخاصة عجمان",         emirate: "Ajman",          city: "Al Hamidiya",      type: "Private", curriculum: "MOE" },
  { name: "Ajman Academy",                         name_ar: "أكاديمية عجمان",                     emirate: "Ajman",          city: "Al Tallah",        type: "Private", curriculum: "IB" },
  { name: "Habitat School Ajman",                  name_ar: "مدرسة هابيتات عجمان",                emirate: "Ajman",          city: "Al Helio",         type: "Private", curriculum: "Indian" },
  { name: "Pakistan Islamia Higher Secondary",     name_ar: "المدرسة الباكستانية الإسلامية",      emirate: "Ajman",          city: "Al Nuaimiya",      type: "Private", curriculum: "Other" },

  // ── Umm Al Quwain ───────────────────────────────────────────────────────
  { name: "Umm Al Quwain English Private School",  name_ar: "مدرسة أم القيوين الإنجليزية الخاصة", emirate: "Umm Al Quwain",  city: "Al Salama",        type: "Private", curriculum: "British" },
  { name: "Khalifa Bin Zayed Al Awwal School",     name_ar: "مدرسة خليفة بن زايد الأول",          emirate: "Umm Al Quwain",  city: "Umm Al Quwain",    type: "Public",  curriculum: "MOE" },

  // ── Ras Al Khaimah ──────────────────────────────────────────────────────
  { name: "RAK Academy",                           name_ar: "أكاديمية رأس الخيمة",                emirate: "Ras Al Khaimah", city: "Al Hamra",         type: "Private", curriculum: "British" },
  { name: "Al Hamra International School",         name_ar: "مدرسة الحمراء الدولية",             emirate: "Ras Al Khaimah", city: "Al Hamra",         type: "Private", curriculum: "British" },
  { name: "Indian School Ras Al Khaimah",          name_ar: "المدرسة الهندية رأس الخيمة",        emirate: "Ras Al Khaimah", city: "Khuzam",           type: "Private", curriculum: "Indian" },
  { name: "Sheikh Saqr Bin Mohammed School",       name_ar: "مدرسة الشيخ صقر بن محمد",            emirate: "Ras Al Khaimah", city: "Al Nakheel",       type: "Public",  curriculum: "MOE" },

  // ── Fujairah ────────────────────────────────────────────────────────────
  { name: "Fujairah Private Academy",              name_ar: "أكاديمية الفجيرة الخاصة",            emirate: "Fujairah",       city: "Fujairah",         type: "Private", curriculum: "British" },
  { name: "Our Own English High School Fujairah",  name_ar: "مدرسة الإنجليزية العليا الفجيرة",    emirate: "Fujairah",       city: "Fujairah",         type: "Private", curriculum: "Indian" },
  { name: "Al Ittihad National Private School Fujairah", name_ar: "مدرسة الاتحاد الوطنية الفجيرة", emirate: "Fujairah",   city: "Sakamkam",         type: "Private", curriculum: "MOE" },
  { name: "Zayed Bin Sultan School Fujairah",      name_ar: "مدرسة زايد بن سلطان الفجيرة",        emirate: "Fujairah",       city: "Fujairah",         type: "Public",  curriculum: "MOE" },
];
