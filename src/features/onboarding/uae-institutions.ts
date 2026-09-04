// UAE curricula and a sample of real institutions, sourced online
// (September 2026):
//   - Curricula and counts: KHDA Dubai 2024-25 private school report (via
//     schoolscompared.com), ADEK Abu Dhabi private school results, and
//     RAK DOK's published curriculum breakdown (British, American, IB,
//     SABIS, CBSE, Kerala Board, Pakistani FBISE, UAE MOE).
//   - Institution names/locations/curricula: edarabia.com's per-emirate
//     school directories, plus RAK DOK's and UAQ school listings.
//
// This is a real, verified sample — not exhaustive. Dubai alone licenses
// 227 private schools; Abu Dhabi another 220. When a live schools
// directory feed exists, this list is replaced by an import job.

export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
] as const;

export type Emirate = (typeof EMIRATES)[number];

// Every curriculum actually operating in UAE private schools per the
// sources above — not a guessed shortlist.
export const SYLLABUS_TYPES = [
  "British (UK / Cambridge / IGCSE)",
  "American (US / AP)",
  "Indian — CBSE",
  "Indian — ICSE",
  "Indian — Kerala Board",
  "International Baccalaureate (IB)",
  "UK/IB Hybrid",
  "US/IB Hybrid",
  "UAE Ministry of Education (MOE)",
  "SABIS",
  "French (Baccalauréat)",
  "German",
  "Pakistani (FBISE)",
  "Philippine",
  "Iranian",
  "Japanese",
  "Russian",
  "Chinese",
  "Australian",
  "Canadian",
  "Other",
] as const;

export interface Institution {
  name: string;
  emirate: Emirate;
  city: string;
  curriculum: string;
}

export const UAE_INSTITUTIONS: Institution[] = [
  // ── Abu Dhabi ──────────────────────────────────────────────────────────
  { name: "Reach British School Abu Dhabi", emirate: "Abu Dhabi", city: "Baniyas East", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Horizon Private School", emirate: "Abu Dhabi", city: "Khalifa City", curriculum: "American (US / AP)" },
  { name: "The British International School Abu Dhabi", emirate: "Abu Dhabi", city: "Al Ain Road", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Ajyal International School MBZ", emirate: "Abu Dhabi", city: "Mohamed Bin Zayed City", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS American Academy Abu Dhabi", emirate: "Abu Dhabi", city: "Khalifa City A", curriculum: "American (US / AP)" },
  { name: "GEMS Founders School – Masdar City", emirate: "Abu Dhabi", city: "Masdar City", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS World Academy Abu Dhabi", emirate: "Abu Dhabi", city: "Al Reem Island", curriculum: "International Baccalaureate (IB)" },
  { name: "Aspen Heights British School", emirate: "Abu Dhabi", city: "Al Bahya", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Nord Anglia International School Abu Dhabi", emirate: "Abu Dhabi", city: "Al Reem Island", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Muna British Academy", emirate: "Abu Dhabi", city: "Hamdan", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Virginia American School", emirate: "Abu Dhabi", city: "Shakhbout City", curriculum: "American (US / AP)" },
  { name: "Yasmina British Academy", emirate: "Abu Dhabi", city: "Khalifa City A", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Global Indian International School Abu Dhabi", emirate: "Abu Dhabi", city: "Baniyas East", curriculum: "Indian — CBSE" },
  { name: "ICS Mushrif", emirate: "Abu Dhabi", city: "Al Mushrif", curriculum: "American (US / AP)" },
  { name: "Bateen World Academy", emirate: "Abu Dhabi", city: "Al Manaseer", curriculum: "International Baccalaureate (IB)" },
  { name: "Al Dhafra Private Schools", emirate: "Abu Dhabi", city: "Mohamed Bin Zayed City", curriculum: "American (US / AP)" },
  { name: "Merryland International School", emirate: "Abu Dhabi", city: "Musaffah", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Emirates Future International Academy", emirate: "Abu Dhabi", city: "Musaffah", curriculum: "Indian — CBSE" },
  { name: "Abu Dhabi Indian School", emirate: "Abu Dhabi", city: "Muroor Street", curriculum: "Indian — CBSE" },
  { name: "International Indian School Abu Dhabi", emirate: "Abu Dhabi", city: "Baniyas West", curriculum: "Indian — CBSE" },

  // ── Dubai ──────────────────────────────────────────────────────────────
  { name: "Dubai English Speaking School", emirate: "Dubai", city: "Oud Metha", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Credence High School", emirate: "Dubai", city: "Al Quoz 4", curriculum: "Indian — CBSE" },
  { name: "Pristine Private School", emirate: "Dubai", city: "Al Nahda 2", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Emirates International School, Jumeirah", emirate: "Dubai", city: "Jumeirah", curriculum: "International Baccalaureate (IB)" },
  { name: "GEMS Wellington Academy, Silicon Oasis", emirate: "Dubai", city: "Silicon Oasis", curriculum: "UK/IB Hybrid" },
  { name: "GEMS Metropole School", emirate: "Dubai", city: "Motor City", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS World Academy, Dubai", emirate: "Dubai", city: "Al Barsha South", curriculum: "International Baccalaureate (IB)" },
  { name: "GEMS Wellington International School", emirate: "Dubai", city: "Sheikh Zayed Road", curriculum: "UK/IB Hybrid" },
  { name: "The Aquila School", emirate: "Dubai", city: "Dubailand", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS Founders School Al Mizhar", emirate: "Dubai", city: "Al Mizhar", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS New Millennium School – Dubai Hills", emirate: "Dubai", city: "Dubai Hills", curriculum: "Indian — CBSE" },
  { name: "GEMS Al Khaleej International School", emirate: "Dubai", city: "Al Warqa", curriculum: "American (US / AP)" },
  { name: "Emirates International School, Meadows", emirate: "Dubai", city: "The Meadows", curriculum: "International Baccalaureate (IB)" },
  { name: "GEMS Modern Academy", emirate: "Dubai", city: "Nad Al Sheba", curriculum: "Indian — CBSE" },
  { name: "Nibras International School", emirate: "Dubai", city: "Dubai Investment Park 1", curriculum: "American (US / AP)" },
  { name: "South View School", emirate: "Dubai", city: "Dubailand", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "The English College, Dubai", emirate: "Dubai", city: "Al Safa", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Dubai American Academy", emirate: "Dubai", city: "Al Barsha", curriculum: "American (US / AP)" },
  { name: "Indian High School Dubai", emirate: "Dubai", city: "Oud Metha", curriculum: "Indian — CBSE" },
  { name: "Lycée Français International Georges Pompidou", emirate: "Dubai", city: "Oud Metha", curriculum: "French (Baccalauréat)" },
  { name: "Repton School Dubai", emirate: "Dubai", city: "Nad Al Sheba", curriculum: "British (UK / Cambridge / IGCSE)" },

  // ── Sharjah ────────────────────────────────────────────────────────────
  { name: "Wesgreen International School", emirate: "Sharjah", city: "Al Muweilih", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "American Gulf School", emirate: "Sharjah", city: "Al Rahmaniya", curriculum: "American (US / AP)" },
  { name: "Sharjah English School", emirate: "Sharjah", city: "Meliha Road", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Amity Private School Sharjah", emirate: "Sharjah", city: "Muwailih Commercial", curriculum: "Indian — CBSE" },
  { name: "ASPAM Indian International School", emirate: "Sharjah", city: "Al Azra", curriculum: "Indian — CBSE" },
  { name: "International School of Creative Science – Muwaileh", emirate: "Sharjah", city: "Muwailih", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Australian International School, Sharjah", emirate: "Sharjah", city: "Maliha-Kalba Road", curriculum: "Australian" },
  { name: "Victoria International School of Sharjah", emirate: "Sharjah", city: "Al Taawun", curriculum: "Australian" },
  { name: "Sharjah Indian School", emirate: "Sharjah", city: "Al Ghubaiba", curriculum: "Indian — CBSE" },
  { name: "GEMS Cambridge International Private School", emirate: "Sharjah", city: "Muwailih", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "The Emirates National School, Sharjah", emirate: "Sharjah", city: "Sheikh Khalid Bin Saqr Street", curriculum: "Indian — CBSE" },

  // ── Ajman ──────────────────────────────────────────────────────────────
  { name: "Ajman Academy", emirate: "Ajman", city: "Al Tallah 2", curriculum: "UK/IB Hybrid" },
  { name: "Delhi Private School – Ajman", emirate: "Ajman", city: "Al Tallah 2", curriculum: "Indian — CBSE" },
  { name: "Crown Private School", emirate: "Ajman", city: "Al Humaidiya 2", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Woodlem Park School", emirate: "Ajman", city: "Al Jurf", curriculum: "Indian — CBSE" },
  { name: "British International School Ajman", emirate: "Ajman", city: "Al Nuaimiya", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Ajman American Private School", emirate: "Ajman", city: "Al Jurf 1", curriculum: "American (US / AP)" },
  { name: "International Indian School Ajman", emirate: "Ajman", city: "Al Jurf 2", curriculum: "Indian — CBSE" },
  { name: "National School Ajman", emirate: "Ajman", city: "Al Jerf 2", curriculum: "American (US / AP)" },

  // ── Ras Al Khaimah ─────────────────────────────────────────────────────
  { name: "RAK Academy – Al Hamra Branch", emirate: "Ras Al Khaimah", city: "Al Hamra", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "GEMS Westminster School – RAK", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "The International School of Choueifat – Ras Al Khaimah", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "SABIS" },
  { name: "Delhi Private School – Ras Al Khaimah", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "Indian — CBSE" },
  { name: "Emirates National School – RAK", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "American (US / AP)" },
  { name: "Indian Public High School", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "Indian — CBSE" },
  { name: "RAK American Academy", emirate: "Ras Al Khaimah", city: "Ras Al Khaimah", curriculum: "American (US / AP)" },

  // ── Fujairah ───────────────────────────────────────────────────────────
  { name: "GEMS Winchester School Fujairah", emirate: "Fujairah", city: "Al Sharia", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Our Own English High School Fujairah", emirate: "Fujairah", city: "Al Faseel", curriculum: "Indian — CBSE" },
  { name: "English School of Kalba", emirate: "Fujairah", city: "Kalba", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Fujairah Academy", emirate: "Fujairah", city: "City Centre area", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "St Mary's School Fujairah", emirate: "Fujairah", city: "Sakamkam", curriculum: "Indian — CBSE" },
  { name: "Indian School Fujairah", emirate: "Fujairah", city: "Al Faseel Road", curriculum: "Indian — CBSE" },

  // ── Umm Al Quwain ──────────────────────────────────────────────────────
  { name: "The International School of Choueifat – Umm Al Quwain", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "SABIS" },
  { name: "Sharjah American International School – UAQ", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "American (US / AP)" },
  { name: "The English Private School, Umm Al Quwain", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "British (UK / Cambridge / IGCSE)" },
  { name: "Wise Indian Private School", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "Indian — CBSE" },
  { name: "Elite Private American School", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "American (US / AP)" },
  { name: "Al Hikmah Private School", emirate: "Umm Al Quwain", city: "Umm Al Quwain", curriculum: "UAE Ministry of Education (MOE)" },
];
