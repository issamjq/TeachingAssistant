/**
 * The privacy policy, as data.
 *
 * Kept out of the component so the wording can be reviewed, translated
 * and dated without touching layout, and so a lawyer can read a file of
 * prose instead of JSX.
 *
 * EVERY factual claim here was checked against the running system, not
 * inferred from the product description. Where the code and a
 * comfortable sentence disagreed, the code won — see the note on IP
 * addresses in section 5, which says what we actually do rather than
 * what we would prefer to say.
 */

export type Block =
  | { p: string }
  | { list: string[] }
  | { note: string };

export interface Section {
  n: number;
  title: string;
  body: Block[];
}

export const PRIVACY_UPDATED = "25 August 2026";

export const PRIVACY: Section[] = [
  {
    n: 1,
    title: "Who we are",
    body: [
      {
        p: "Murchid is a teaching-material service for schools. This policy covers the Murchid app and the murchid.com website.",
      },
      {
        p: "For a teacher's own account we are the controller of the personal data described here. For the pupil records a teacher enters — names, dates of birth, guardians, attendance, marks — we act on the instructions of the teacher and their school, who remain responsible for deciding what is collected and why. Section 4 sets that out in full.",
      },
      {
        p: "Privacy questions, and any request to access, correct, export or delete data: hello@murchid.app, or through the account page inside the app.",
      },
    ],
  },
  {
    n: 2,
    title: "Our approach",
    body: [
      {
        p: "Murchid drafts teaching material. The teacher directs it, reviews it and decides what reaches a class — the product is built on that order, and so is this policy. We hold the material you make, the classes you teach and the account you sign in with, and little else.",
      },
      {
        p: "We do not sell personal data. We do not use your lessons, your pupils' records or your teaching notes to train AI models. There is no advertising anywhere in Murchid. We use two analytics services — Microsoft Clarity and Google Analytics — to see how the site is used and where the interface confuses people. Neither is used to advertise to you, and no profile of you is sold.",
      },
      {
        note: "Children's data is the most sensitive thing this service touches. Section 4 is about that specifically, and it is the section to read first if you are a school considering Murchid.",
      },
    ],
  },
  {
    n: 3,
    title: "What we collect — your account",
    body: [
      {
        list: [
          "Your email address, required to sign in. Sign-in is by password, by an emailed link, or by Sign in with Google or LinkedIn — in which case we receive the name, email and profile picture in the provider's token, never your password for that provider.",
          "Profile details you fill in: name, avatar image, phone number, language, nationality, qualification, areas of expertise, years of experience, the grades you are eligible to teach, and the school or organisation you belong to.",
          "Your teaching context: the classes you run, their subject, grade and division, your timetable, and the skill profiles you set up to ground what the AI writes.",
          "Account state: your role, whether onboarding is complete, when you last signed in, and the single active session that keeps your account to one device at a time.",
        ],
      },
    ],
  },
  {
    n: 4,
    title: "What we collect — your pupils",
    body: [
      {
        p: "Murchid is used with children. A teacher can enter, for each pupil: first and last name, a student identifier, grade and division, date of birth, gender, email address, phone number, nationality, home address, enrolment date and free-text notes, together with a primary guardian's name, relationship, email and phone.",
      },
      {
        p: "We also hold what the teacher records about a pupil in the course of teaching: attendance marked against a date and a period, marks and grades, homework and quiz submissions, and work the pupil hands in through the student portal.",
      },
      {
        p: "We do not decide what any of this is for. A teacher enters it to run their class, and their school decides what may be collected and for how long. We process it only to provide the service to them, never for our own purposes, never to train a model, and never for advertising — of which there is none.",
      },
      {
        p: "Pupils may also hold their own sign-in, created by invitation from their teacher, which lets them see the work set for them and submit it. A pupil account holds their name, their school email and their own submissions.",
      },
      {
        note: "If you are a parent or guardian and want to know what is held about your child, ask the school or teacher first — they control the record. They can correct or delete it themselves, and we will help them do so. You can also write to us directly at hello@murchid.app.",
      },
    ],
  },
  {
    n: 5,
    title: "What we collect — technical and operational data",
    body: [
      {
        list: [
          "Service logs recording what an AI call cost — the model used, tokens in and out, the dollar cost, which feature it served and whether it succeeded. These record what a call cost, not what it said.",
          "Credit balances, monthly allowances, and a per-feature record of what was generated, so you can see where your allowance went.",
          "Subscription and payment records: your plan, its billing period, when it renews, and for each payment its amount, currency, status and the Stripe identifiers that link it to a receipt.",
          "An audit log of administrative actions, which records who did what, when, from which browser, and a one-way hash of the IP address it came from.",
          "A session identifier and a device record, used to keep your account signed in on one device at a time.",
        ],
      },
      {
        note: "We do not store IP addresses in the clear. The audit log keeps a truncated SHA-256 digest, salted with a secret that never leaves our servers, so two actions from the same origin can be recognised as related without the address itself being recoverable from the record.",
      },
      {
        p: "We collect no card numbers, no biometric data and no precise device location. We do not track you across other websites, because there is nothing in Murchid that could.",
      },
    ],
  },
  {
    n: 6,
    title: "Why we use it",
    body: [
      {
        list: [
          "To draft lesson plans, teaching guides, pupil notes, quizzes, exams, homework, presentations and activities from what you ask for, and to place them on your timetable.",
          "To ground that material in your own subjects, grades, classes and skill profiles, so you are not re-entering the same context every time.",
          "To run your register, your marking and your reports, and to deliver work to pupils and collect it back.",
          "To sign you in and keep your account secure, including holding an account to one active session.",
          "To meter what the AI costs, apply your plan's monthly allowance, and prevent abuse of the service.",
          "To take payment for a plan and keep the receipts that go with it.",
          "To keep the service reliable, diagnose faults, control our own costs, and improve the product through aggregated, non-identifying analysis.",
          "To meet legal, tax and accounting obligations.",
        ],
      },
    ],
  },
  {
    n: 7,
    title: "Who we share it with — infrastructure",
    body: [
      {
        list: [
          "Supabase — database, authentication and file storage: accounts, profiles, classes, pupils, attendance, marks, generated material and uploaded files.",
          "Vercel — hosting and serving the application.",
          "Render — hosting the service that talks to the AI providers and to Stripe.",
          "Brevo and Resend — deliver sign-in links, invitations and notification emails, and so receive the recipient's email address.",
          "Google and LinkedIn — only if you choose to sign in with them; that sign-in is governed by their own privacy policies.",
          "Microsoft Clarity — records how pages are used, so we can see where the interface is confusing: clicks, scrolling, and a replay of the screen. The project is set to mask text: what you type, and the words on the page, are replaced before the recording leaves your browser, so pupil names and marks are never sent.",
          "Google Analytics — counts visits and reports which pages are opened, from where, and on what kind of device. It is configured for measurement only: no advertising audience is built from it.",
        ],
      },
    ],
  },
  {
    n: 8,
    title: "Who we share it with — AI providers",
    body: [
      {
        p: "Generating material sends text to a pooled set of providers with automatic failover: Anthropic (Claude), Google (Gemini) and OpenRouter.",
      },
      {
        p: "What is sent: your brief, the subject, grade and class context it applies to, any teaching material or syllabus you attach, and your revision instructions.",
      },
      {
        p: "What is not sent: your pupils' names, dates of birth, guardian contacts, attendance, marks or submissions. Pupil records are not part of a generation request. If you type a pupil's name into a brief yourself it will be sent with it, so please do not.",
      },
      {
        p: "Your email address, account identifier and payment records are never sent to an AI provider.",
      },
    ],
  },
  {
    n: 9,
    title: "Payments",
    body: [
      {
        p: "Payments are taken by Stripe on a page Stripe hosts. Card details never reach Murchid: you leave for Stripe, pay there, and return. We hold no card numbers.",
      },
      {
        p: "We store what Stripe tells us about a payment — its amount, currency, status, plan and the identifiers that link it to your receipt — so that your billing page and our records agree.",
      },
      {
        p: "Stripe is the controller of your payment details and processes them under its own privacy policy.",
      },
    ],
  },
  {
    n: 10,
    title: "Cookies and local storage",
    body: [
      {
        p: "We set no advertising cookie. What we store:",
      },
      {
        list: [
          "A Supabase authentication token that keeps you signed in — strictly necessary.",
          "Your chosen language and text direction, so the interface opens in Arabic or English as you left it.",
          "A session identifier, used to keep your account to one device.",
          "Small interface preferences: which view a list was in, whether a panel was collapsed, and whether you have seen a first-run tour.",
          "Two Microsoft Clarity cookies (_clck, _clsk) that recognise a returning session, so one visit is not counted as several.",
          "Google Analytics cookies (_ga and one _ga_ per property) that tell a returning visit from a new one.",
        ],
      },
      {
        p: "You can clear these from your browser at any time. Doing so signs you out.",
      },
    ],
  },
  {
    n: 11,
    title: "How long we keep it",
    body: [
      {
        list: [
          "Account, profile and teaching context — while your account is open; deleting your account deletes them.",
          "Generated material, classes, pupils, attendance, marks and submissions — until you delete them or your account, or until your school instructs us to remove them.",
          "Payment records and the credit ledger — retained for reconciliation, tax and accounting purposes as the law requires, then deleted or aggregated.",
          "Service logs recording AI cost — retained for operational and cost analysis, then aggregated.",
          "The administrative audit log — retained as a security record.",
          "Invitations — until accepted or expired.",
        ],
      },
      {
        p: "Backups are overwritten on a rolling cycle, so deleted data may persist briefly in backups before being cycled out.",
      },
    ],
  },
  {
    n: 12,
    title: "Your rights",
    body: [
      { p: "Wherever you live, you can:" },
      {
        list: [
          "See and edit your profile and teaching context from your account page.",
          "View, edit, export and delete any material you have generated.",
          "Correct or delete a pupil record, which removes the attendance, marks and submissions attached to it.",
          "Delete your account, which removes the personal data associated with it.",
        ],
      },
      {
        p: "Depending on where you are — including under the UAE Personal Data Protection Law, and under GDPR or UK GDPR if you are in the EU or UK — you may also have rights to access, correct, erase, restrict or object to processing, to data portability, to withdraw consent, and to complain to your data protection authority. Write to hello@murchid.app and we will respond within 30 days. We may ask you to verify your identity first.",
      },
      {
        p: "Where the request concerns a pupil, we will normally refer it to the teacher or school that holds the record, and help them act on it.",
      },
    ],
  },
  {
    n: 13,
    title: "Security",
    body: [
      {
        list: [
          "All traffic is encrypted in transit, and data is encrypted at rest by our infrastructure providers.",
          "Row-level security is enabled on every table holding a teacher's work, so one account cannot read another's rows — including through the views the application reads.",
          "Privileged keys exist only in server-side code and never reach the browser. The browser holds no secret capable of granting itself credits, changing a plan, or reading another account.",
          "An account is held to a single active session, so a signed-in device elsewhere is signed out.",
          "IP addresses are hashed with a server-side secret, never stored in the clear.",
          "Administrative access is role-based, restricted to named staff, and administrative changes are written to an audit log.",
        ],
      },
      {
        p: "No online service can promise absolute security. We minimise what we hold, and if a breach affects personal data we will notify those affected and the relevant authority as the law requires.",
      },
    ],
  },
  {
    n: 14,
    title: "International processing",
    body: [
      {
        p: "Our providers process data in several countries, including the United States and the European Union. Where a transfer leaves your country we rely on the safeguards available to us — typically the provider's standard contractual clauses or an equivalent mechanism — and share only what the provider needs.",
      },
    ],
  },
  {
    n: 15,
    title: "Children",
    body: [
      {
        p: "Murchid is a tool for teachers, not a service children sign up to. Pupil records are entered by a teacher, and a pupil's own sign-in is created only by invitation from their teacher.",
      },
      {
        p: "We do not knowingly collect a child's personal data except as instructed by their teacher or school for the purpose of teaching them. We do not profile children, market to them, or use anything about them to train a model.",
      },
      {
        p: "If you believe a child's data is held here without a proper basis, write to hello@murchid.app and we will remove it.",
      },
    ],
  },
  {
    n: 16,
    title: "Automated decision-making",
    body: [
      {
        p: "Teaching material is produced with AI assistance, and it is a draft. Nothing Murchid generates is a decision about a pupil: marks and attendance are recorded by the teacher, not inferred, and no grade, assessment or report is issued automatically.",
      },
      {
        p: "Everything the AI writes is presented for the teacher to review, edit or discard before it reaches a class.",
      },
    ],
  },
  {
    n: 17,
    title: "Changes to this policy",
    body: [
      {
        p: "We may update this policy as the service evolves. We will change the date at the top and, for material changes, give notice in the app or by email before they take effect.",
      },
    ],
  },
  {
    n: 18,
    title: "Contact",
    body: [
      {
        p: "Questions about privacy, or a request about your data? Write to hello@murchid.app, or use the account page inside the app — signed in, we can answer about the right account without asking you to prove who you are twice.",
      },
    ],
  },
];
