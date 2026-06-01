// Privacy Policy + Terms & Conditions content for Murchid.
// Written for the United Arab Emirates: references Federal Decree-Law
// No. 45 of 2021 on the Protection of Personal Data (PDPL), UAE
// Federal Decree-Law No. 5 of 2012 on Combating Cybercrimes, and the
// Federal Civil Transactions Law. Drafted as plain-English/Arabic
// notices; final binding text would be reviewed by UAE counsel before
// a production release.
//
// Both documents are versioned via `effectiveDate` and `version` so
// the signup acceptance record can pin to the exact text the teacher
// agreed to.

export const LEGAL_VERSION = "1.0";
export const LEGAL_EFFECTIVE_DATE = "31 May 2026";

const COMPANY = {
  name: "Murchid",
  legal: "Murchid Education Technologies FZ-LLC",
  country: "United Arab Emirates",
  emirate: "Dubai",
  email: "privacy@murchid.app",
  supportEmail: "support@murchid.app",
  legalEmail: "legal@murchid.app",
};

// Each section: { heading, body }. body items can be:
//   { p: "..."}             paragraph
//   { list: ["...", ...] }  bulleted list
//   { sub: "...", body }    sub-section (heading + nested body)
//   { strong: "..." }       short emphasised callout
export const PRIVACY = {
  title: "Privacy Policy",
  intro: [
    { p: `This Privacy Policy explains how ${COMPANY.legal} ("${COMPANY.name}", "we", "us", "our") collects, uses, discloses and protects personal data when you use the Murchid teaching platform (the "Service"). We are committed to handling personal data in accordance with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data ("PDPL") and applicable UAE laws and regulations.` },
    { p: `By creating an account or using the Service you confirm that you have read and understood this Policy. If you do not agree, please do not use the Service.` },
  ],
  sections: [
    {
      heading: "1. Data controller",
      body: [
        { p: `${COMPANY.legal}, established in ${COMPANY.emirate}, ${COMPANY.country}, is the data controller responsible for personal data processed through the Service. You can reach our privacy team at ${COMPANY.email}.` },
      ],
    },
    {
      heading: "2. Personal data we collect",
      body: [
        { p: `We collect the following categories of personal data:` },
        { list: [
          "Account data — your name, email address, role (teacher), profile photo, school affiliation, grade levels and subjects you teach.",
          "Authentication data — identifiers issued by the sign-in provider you choose (e.g. Google or Microsoft Outlook); we never see or store your password for those providers.",
          "Teaching content — lesson plans, presentations, quizzes, homework, activities and any other content you create, upload or generate through the Service.",
          "Student-related data you upload — names, grades, sections, marks and feedback that you choose to add for your classroom; you are the data controller for this content, and Murchid acts as a processor on your school's behalf.",
          "Usage data — pages visited, features used, timestamps, AI prompts and outputs, error logs and performance metrics.",
          "Device and technical data — IP address, browser type, operating system, language, time zone and approximate location derived from your IP.",
          "Billing data — subscription tier, billing email and last four digits of the payment instrument; full card data is processed by our PCI-DSS-compliant payment provider and never reaches Murchid's servers.",
          "Communications — messages you send to our support or feedback channels.",
        ] },
      ],
    },
    {
      heading: "3. Lawful basis for processing",
      body: [
        { p: `Under Article 4 of the PDPL we rely on one or more of the following lawful bases:` },
        { list: [
          "Your explicit consent, given when you sign up or when you opt in to a particular feature (e.g. AI-assisted drafting).",
          "Performance of the contract between you and us so we can deliver the Service you requested.",
          "Compliance with a legal obligation under UAE law.",
          "Our legitimate interests in operating, securing and improving the Service, where those interests are not overridden by your rights.",
          "Protection of vital interests, where processing is needed to safeguard a person's life or safety.",
        ] },
      ],
    },
    {
      heading: "4. How we use personal data",
      body: [
        { list: [
          "To create and operate your account and authenticate you.",
          "To deliver the core teaching tools: lesson plans, presentations, quizzes, homework, scheduling and grading.",
          "To run our AI features that draft, refine and translate content based on the prompts you provide.",
          "To remember your preferences, layouts and recently used colours/fonts.",
          "To process subscriptions, payments and renewals through our payment provider.",
          "To send service messages — receipts, security alerts, scheduled-task notifications and updates to this Policy.",
          "To detect, prevent and respond to fraud, abuse, security incidents and violations of our Terms.",
          "To improve the Service through aggregated analytics that do not identify any single user.",
          "To comply with UAE legal obligations and respond to lawful requests from competent authorities.",
        ] },
      ],
    },
    {
      heading: "5. AI-generated content",
      body: [
        { p: `When you use AI features, the prompts you submit and the resulting drafts are processed by Murchid and, where applicable, by approved AI sub-processors under written data-processing agreements. We do not use your private content to train public AI models. AI outputs are suggestions only — you remain responsible for reviewing them for accuracy, fairness and compliance with your school's policies and UAE law.` },
      ],
    },
    {
      heading: "6. Children's data",
      body: [
        { p: `The Service is intended for teachers and school staff aged 18 or above. We do not knowingly collect personal data directly from children. When you, as a teacher, upload data about students (including minors), you confirm that you have the school's authorisation and any necessary parental consent under UAE law. We treat student data as confidential, apply additional access restrictions, and process it solely to provide the Service you requested.` },
      ],
    },
    {
      heading: "7. How we share personal data",
      body: [
        { p: `We do not sell personal data. We share it only with:` },
        { list: [
          "Sub-processors who help us run the Service — hosting, payment processing, email delivery, error monitoring, customer support and approved AI providers. Each sub-processor is bound by a written agreement requiring confidentiality and PDPL-equivalent safeguards.",
          "Your school or institution, where you have signed up through a school plan and your school administrator has access rights.",
          "Competent UAE authorities or other public bodies where disclosure is required by UAE law, a court order, or to protect rights, safety and security.",
          "Acquirers in the event of a corporate transaction (merger, acquisition or sale of assets), where the recipient assumes equivalent privacy obligations.",
        ] },
      ],
    },
    {
      heading: "8. Cross-border transfers",
      body: [
        { p: `Personal data is hosted on infrastructure located primarily within the UAE. Some sub-processors operate outside the UAE. When that is the case we transfer data only to jurisdictions that the UAE Data Office considers to provide an adequate level of protection, or under appropriate safeguards (such as standard contractual clauses) as permitted by Articles 22–23 of the PDPL.` },
      ],
    },
    {
      heading: "9. Retention",
      body: [
        { p: `We keep personal data for as long as your account is active and for a limited period afterwards to satisfy legal, accounting and security obligations. When you delete content, soft-deleted records may remain in our recovery backups for up to ninety (90) days before being permanently removed. You may request earlier deletion as described in Section 11 below.` },
      ],
    },
    {
      heading: "10. Security",
      body: [
        { p: `We apply administrative, technical and organisational measures designed to protect personal data, including encryption in transit (TLS), encryption of databases at rest, role-based access controls, audit logs, and regular security reviews. No system is perfectly secure: in the unlikely event of a personal data breach that is likely to cause serious harm, we will notify the UAE Data Office and affected users without undue delay, in line with Article 9 of the PDPL.` },
      ],
    },
    {
      heading: "11. Your rights",
      body: [
        { p: `Subject to applicable conditions and exemptions under the PDPL, you may exercise the following rights free of charge:` },
        { list: [
          "Access — request a copy of the personal data we hold about you.",
          "Rectification — ask us to correct inaccurate or incomplete data.",
          "Erasure — request deletion of your personal data.",
          "Restriction — limit how we process your data in specific situations.",
          "Portability — receive a copy of your data in a structured, machine-readable format.",
          "Objection — object to certain processing based on our legitimate interests.",
          "Withdraw consent — withdraw consent at any time where processing is based on consent; this does not affect prior lawful processing.",
          "Lodge a complaint — file a complaint with the UAE Data Office if you believe your rights have been infringed.",
        ] },
        { p: `To exercise any of these rights, contact us at ${COMPANY.email}. We will respond within the timeframes set by the PDPL.` },
      ],
    },
    {
      heading: "12. Cookies and similar technologies",
      body: [
        { p: `We use a small number of strictly necessary cookies and local-storage items to keep you signed in, remember your interface preferences (theme, recent colours, language) and protect against fraud. We do not use third-party advertising cookies. You may clear cookies in your browser; doing so will sign you out and reset your preferences.` },
      ],
    },
    {
      heading: "13. Third-party links",
      body: [
        { p: `The Service may link to third-party websites or services. We are not responsible for the privacy practices of those third parties; please review their policies.` },
      ],
    },
    {
      heading: "14. Changes to this Policy",
      body: [
        { p: `We may update this Policy from time to time. We will post the new version on this page and update the effective date. When changes are material, we will give reasonable advance notice via email or in-app notification and, where the law requires it, seek your renewed consent.` },
      ],
    },
    {
      heading: "15. Contact us",
      body: [
        { p: `For privacy questions, requests under the PDPL, or to reach our Data Protection Officer, email ${COMPANY.email}. General support is at ${COMPANY.supportEmail}.` },
      ],
    },
  ],
};

export const SECURITY = {
  title: "Security",
  intro: [
    { p: `Murchid is built for schools and teachers in the United Arab Emirates. We take security seriously and apply layered controls across our application, infrastructure and team. This page summarises how we protect your data; the full Privacy Policy describes what data we hold and why.` },
  ],
  sections: [
    {
      heading: "1. Hosting and infrastructure",
      body: [
        { list: [
          "Production workloads run on managed cloud infrastructure that operates from data centres in or near the UAE wherever a regional option is available.",
          "Network access to our application servers is restricted to encrypted channels and to a small allow-list of administrative IPs.",
          "Databases are isolated from the public internet and reachable only by our application services through private networking.",
          "Each environment (production, staging, development) is fully separated; production secrets never reach staging or local machines.",
        ] },
      ],
    },
    {
      heading: "2. Encryption",
      body: [
        { list: [
          "All traffic between your browser and Murchid is encrypted with TLS 1.2 or higher; older protocol versions are disabled.",
          "Data at rest in our databases, object storage and backups is encrypted using industry-standard AES-256.",
          "Secrets, API keys and signing material are stored in a managed secret vault, never in source code or container images.",
        ] },
      ],
    },
    {
      heading: "3. Identity and access",
      body: [
        { list: [
          "Sign-in uses your existing Google or Microsoft account; Murchid never sees your password.",
          "Internal access to production systems is restricted to a small number of named engineers, protected by hardware-key-based multi-factor authentication.",
          "All access to systems handling personal data is logged and reviewed; least-privilege is the default and access is revoked when a role changes.",
          "Within the product, role-based permissions ensure that teachers see only the classes and content they are authorised for, and that students never see one another's submissions.",
        ] },
      ],
    },
    {
      heading: "4. Application security",
      body: [
        { list: [
          "We follow secure-development practices: peer code review, dependency scanning, automated tests and static analysis run on every change.",
          "Third-party dependencies are kept up to date and security advisories are triaged on a fast cadence.",
          "User content is treated as untrusted: we sanitise inputs, escape outputs and protect against common OWASP Top-10 risks.",
          "Rate limits and abuse heuristics protect against brute-force, credential stuffing and automated scraping.",
        ] },
      ],
    },
    {
      heading: "5. AI safety",
      body: [
        { list: [
          "Prompts and outputs used by our AI features are not used to train public foundation models.",
          "AI sub-processors are bound by written data-processing agreements aligned with the UAE PDPL.",
          "We apply content-safety filters to AI output and surface a clear notice that AI-generated material must be reviewed by you before classroom use.",
        ] },
      ],
    },
    {
      heading: "6. Backups and disaster recovery",
      body: [
        { list: [
          "Databases are backed up automatically multiple times per day; backups are encrypted and stored separately from primary systems.",
          "We test restore procedures regularly so that an incident does not become a data-loss event.",
          "Soft-delete and versioning give teachers a recovery window for accidental deletions before content is permanently removed.",
        ] },
      ],
    },
    {
      heading: "7. Monitoring and incident response",
      body: [
        { list: [
          "Production systems emit structured logs, metrics and traces that are monitored continuously for errors and anomalies.",
          "We have a written incident-response playbook covering triage, containment, eradication, recovery and post-mortem.",
          "If a personal-data breach occurs that is likely to cause serious harm, we will notify the UAE Data Office and affected users without undue delay, in line with Article 9 of the PDPL.",
        ] },
      ],
    },
    {
      heading: "8. Reporting a vulnerability",
      body: [
        { p: `If you believe you have found a security issue in Murchid, please email ${COMPANY.email} with a clear description and any reproduction steps. We will acknowledge your report quickly and will not pursue good-faith research that respects user privacy. Please do not publicly disclose a vulnerability until we have had a reasonable opportunity to address it.` },
      ],
    },
  ],
};

export const TERMS = {
  title: "Terms & Conditions",
  intro: [
    { p: `These Terms & Conditions ("Terms") govern your use of the Murchid teaching platform (the "Service"), operated by ${COMPANY.legal} ("Murchid", "we", "us"). By creating an account, subscribing, or otherwise accessing the Service, you ("you", "Teacher") agree to be bound by these Terms.` },
    { p: `If you do not agree to these Terms, do not use the Service.` },
  ],
  sections: [
    {
      heading: "1. Eligibility",
      body: [
        { list: [
          "You must be at least eighteen (18) years old and have full legal capacity to enter into a binding contract under UAE law.",
          "You must be a teacher, school administrator, or other authorised representative of an educational institution.",
          "If you sign up on behalf of a school or organisation, you confirm that you have the authority to bind that entity to these Terms.",
        ] },
      ],
    },
    {
      heading: "2. Your account",
      body: [
        { list: [
          "You must provide accurate, current and complete information when registering and keep it up to date.",
          "You are responsible for safeguarding your sign-in credentials and for all activities under your account.",
          "Notify us immediately at " + COMPANY.supportEmail + " if you suspect unauthorised access.",
          "We may suspend or terminate accounts that violate these Terms or applicable UAE law.",
        ] },
      ],
    },
    {
      heading: "3. Subscription, fees and renewals",
      body: [
        { list: [
          "Paid plans are billed in advance on a monthly, quarterly or annual cycle as selected at checkout. Prices are quoted in AED unless otherwise stated and are inclusive of UAE VAT where applicable.",
          "Subscriptions renew automatically at the end of each cycle for the same period at the then-current price unless you cancel before the renewal date.",
          "You may cancel renewal at any time from your account settings; cancellation takes effect at the end of the current paid period.",
          "Except where required by UAE consumer law, fees already paid are non-refundable. A free trial, if offered, ends automatically and may convert to a paid subscription unless cancelled before the trial period expires.",
          "We may change pricing or plan structure with at least thirty (30) days' notice to active subscribers; changes apply at the start of your next renewal cycle.",
        ] },
      ],
    },
    {
      heading: "4. Acceptable use",
      body: [
        { p: `You agree not to use the Service to:` },
        { list: [
          "Violate any applicable law of the United Arab Emirates, including the Federal Decree-Law No. 34 of 2021 on Combating Rumours and Cybercrimes, the PDPL, copyright law, and laws on public morals and religious sensitivity.",
          "Upload, generate or distribute content that is unlawful, defamatory, obscene, hateful, discriminatory, that incites violence, or that offends the public order or morals of the UAE.",
          "Infringe the intellectual-property rights, privacy rights or other rights of any person or entity.",
          "Attempt to access, probe or interfere with the Service, its infrastructure, or other users' accounts.",
          "Reverse-engineer, decompile or copy any part of the Service except as expressly permitted by UAE law.",
          "Use the Service to send spam, malware, or any automated abuse.",
          "Resell, sublicense or commercially exploit the Service without our prior written consent.",
          "Use the Service to generate content about real students that is shared outside your authorised classroom or school context.",
        ] },
      ],
    },
    {
      heading: "5. AI features",
      body: [
        { p: `The Service includes AI-assisted drafting and refinement of teaching materials. You understand and agree that:` },
        { list: [
          "AI output is generated automatically and may contain inaccuracies, omissions or culturally inappropriate content.",
          "You are solely responsible for reviewing, editing and approving AI output before using it with students or sharing it.",
          "You must not rely on AI output for medical, legal, financial or safety-critical decisions.",
          "You retain ownership of the prompts you submit and the outputs you choose to keep, subject to these Terms and the licences granted below.",
        ] },
      ],
    },
    {
      heading: "6. Content ownership and licences",
      body: [
        { sub: "6.1 Your content",
          body: [
            { p: `You retain all ownership rights in the content you upload, create, or generate through the Service (your "Content"). You grant Murchid a worldwide, non-exclusive, royalty-free licence to host, store, process, display and transmit your Content solely as needed to provide the Service to you, to back it up, and to comply with legal obligations. This licence ends when you delete the Content or close your account, subject to the retention periods described in the Privacy Policy.` },
          ],
        },
        { sub: "6.2 Our intellectual property",
          body: [
            { p: `The Service — including its software, design, brand and trademarks — is owned by Murchid and protected by UAE and international intellectual-property laws. We grant you a personal, limited, revocable, non-transferable licence to access and use the Service in accordance with these Terms. No other rights are granted, expressly or by implication.` },
          ],
        },
      ],
    },
    {
      heading: "7. Student data",
      body: [
        { p: `Where you process personal data of students through the Service, you are the data controller for that data and Murchid acts as a processor. You warrant that you have a valid lawful basis under the PDPL, including any necessary parental consent, before uploading or generating student data, and you must comply with your school's data-handling policies.` },
      ],
    },
    {
      heading: "8. Service availability",
      body: [
        { p: `We aim to keep the Service available with high uptime, but we do not guarantee uninterrupted or error-free operation. We may schedule maintenance, suspend features for security reasons, or modify the Service with notice where practical. To the extent permitted by UAE law, the Service is provided "as is" and "as available".` },
      ],
    },
    {
      heading: "9. Limitation of liability",
      body: [
        { p: `To the maximum extent permitted by UAE law, Murchid's total aggregate liability arising out of or related to your use of the Service in any twelve-month period will not exceed the fees you paid us during that period (or, for free accounts, AED 500). In no event will Murchid be liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, goodwill, data or business opportunities. Nothing in these Terms excludes liability that cannot be excluded by law.` },
      ],
    },
    {
      heading: "10. Indemnity",
      body: [
        { p: `You agree to indemnify and hold Murchid and its officers, employees and agents harmless from any claim, loss, liability, demand or expense (including reasonable legal fees) arising out of (i) your breach of these Terms or applicable law, (ii) your Content, or (iii) your use of the Service in violation of the rights of any third party.` },
      ],
    },
    {
      heading: "11. Termination",
      body: [
        { list: [
          "You may stop using the Service and close your account at any time from your account settings.",
          "We may suspend or terminate your access immediately, without notice, if you breach these Terms, engage in conduct that risks harm to other users, or where required by UAE law.",
          "On termination, your right to use the Service ceases and we will delete or return your Content as described in the Privacy Policy. Sections that by their nature should survive (including IP, indemnity, liability, governing law) survive termination.",
        ] },
      ],
    },
    {
      heading: "12. Changes to the Service or these Terms",
      body: [
        { p: `We may modify the Service from time to time. We may amend these Terms by posting an updated version on this page; we will notify you in advance of any material change by email or in-app notice. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.` },
      ],
    },
    {
      heading: "13. Governing law and jurisdiction",
      body: [
        { p: `These Terms are governed by the federal laws of the United Arab Emirates and, to the extent applicable, the laws of the Emirate of ${COMPANY.emirate}. Any dispute arising out of or relating to these Terms or the Service that cannot be resolved amicably will be submitted to the exclusive jurisdiction of the competent courts of ${COMPANY.emirate}, United Arab Emirates.` },
      ],
    },
    {
      heading: "14. Notices and contact",
      body: [
        { p: `Notices to you may be sent to the email address registered with your account or posted within the Service. Notices to us must be sent to ${COMPANY.legalEmail}. For general support, contact ${COMPANY.supportEmail}.` },
      ],
    },
    {
      heading: "15. Miscellaneous",
      body: [
        { list: [
          "If any provision of these Terms is held unenforceable, the remaining provisions remain in full force.",
          "Our failure to enforce a right does not waive that right.",
          "You may not assign these Terms without our written consent; we may assign them to an affiliate or successor in connection with a corporate transaction.",
          "These Terms, together with the Privacy Policy, constitute the entire agreement between you and Murchid regarding the Service.",
        ] },
      ],
    },
  ],
};
