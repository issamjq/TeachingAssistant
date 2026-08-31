/**
 * The terms of service, as data. Same shape as privacy.ts.
 *
 * Every number here was read from the running system: the credit costs
 * from ai_credit_costs, the plans and prices from plan_tiers, the grace
 * period from subscription_active_for(), the trial length from the trial
 * tier. If any of those change, this file is wrong and has to change
 * with them — which is the argument for keeping the wording as data next
 * to the code rather than in a document nobody diffs.
 *
 * Two sections carry most of the weight and were written first: §3, on
 * drafts not being finished teaching material, and §5, on whose pupil
 * data this is. Everything else is ordinary.
 */

import type { Section } from "./privacy";

export const TERMS_UPDATED = "25 August 2026";

export const TERMS: Section[] = [
  {
    n: 1,
    title: "Who we are and what these Terms cover",
    body: [
      {
        p: "Murchid (“Murchid”, “we”, “us”) is a teaching-material service: a teacher describes what she needs and the service drafts lesson plans, student notes, quizzes, homework, slide decks and classroom activities for her to check, edit and use.",
      },
      {
        p: "These Terms of Service (“Terms”) form a binding agreement between you and us and govern your use of the Murchid website, application and APIs (together, the “Service”). By creating an account or using the Service you accept these Terms. If you do not accept them, please do not use the Service.",
      },
      {
        p: "Our Privacy Policy explains how we handle personal data and forms part of these Terms.",
      },
    ],
  },
  {
    n: 2,
    title: "What Murchid is — and what it is not",
    body: [
      {
        p: "Murchid is a drafting tool for teachers. It composes lesson plans, teaching guides, pupil notes, quizzes, exams, homework, presentations and activities from a brief you write, grounded in the subjects, grades and classes you set up, and places them on your timetable.",
      },
      {
        p: "Murchid is not a school, an examination board, an accreditation body or a curriculum authority. We do not set, approve, moderate or certify any syllabus, and we are not a party to the relationship between you, your school, your pupils or their guardians.",
      },
      {
        p: "We are not a legal, safeguarding, medical or educational-psychology adviser, and nothing the Service produces is advice of that kind.",
      },
    ],
  },
  {
    n: 3,
    title: "Drafts, not finished teaching material",
    body: [
      {
        p: "Everything Murchid generates is a draft for you to review. The product is built on that order — the teacher directs, Murchid drafts, and the teacher decides what reaches a class.",
      },
      {
        p: "Generated material is produced with AI assistance and can be wrong. It may contain factual errors, a mistaken worked answer, a marking scheme that does not add up, a reading level that misses your class, or content that does not match your board’s syllabus for the year you are teaching. Curriculum alignment is a claim about intent, not a certification: no examination board has reviewed this output.",
      },
      {
        note: "You are responsible for reading and correcting anything before it reaches a pupil. That includes checking facts, answers and marking schemes, and judging whether the material is appropriate for the age and needs of the children in front of you. We accept no liability for material used with a class without that review.",
      },
      {
        p: "Credit costs and allowances shown before a generation are estimates of what the work will consume, and are settled against the actual cost when it completes.",
      },
    ],
  },
  {
    n: 4,
    title: "Eligibility and accounts",
    body: [
      {
        list: [
          "You must be at least 18, or the age of majority where you live, to hold a teacher account and to purchase a plan.",
          "Sign-in is by password, by an emailed link, or with Google or LinkedIn.",
          "You are responsible for everything done through your account and for keeping your sign-in secure. Tell us promptly at hello@murchid.app if you believe it has been used without your authorisation.",
          "One person, one account. Accounts may not be shared, sold or transferred. Murchid holds an account to a single active session, so signing in on a second device signs the first one out.",
          "Pupil accounts are created only by invitation from a teacher, and exist so a pupil can see and submit the work set for them.",
        ],
      },
    ],
  },
  {
    n: 5,
    title: "Pupil data and your school",
    body: [
      {
        p: "When you enter a pupil’s details — name, date of birth, guardian contacts, attendance, marks, submitted work — you decide what is collected and why. We hold and process it on your instruction and your school’s, and for no purpose of our own.",
      },
      {
        p: "You confirm that you are entitled to enter it: that your school permits it, that the necessary notice has been given to guardians, and that any consent required where you are has been obtained. If your school has a data protection policy, it governs what you may put here.",
      },
      {
        p: "We do not use pupil data to train AI models, and pupil records are not sent to an AI provider as part of a generation. If you type a pupil’s name into a brief yourself it travels with that brief, so please do not.",
      },
      {
        p: "You can correct or delete any pupil record from within the Service, and deleting one removes the attendance, marks and submissions attached to it. If a guardian asks us directly, we will normally refer them to you, because the record is yours.",
      },
    ],
  },
  {
    n: 6,
    title: "Acceptable use",
    body: [
      { p: "You agree not to:" },
      {
        list: [
          "Use the Service for anything unlawful, infringing, deceptive or harmful, or to generate material that is abusive, discriminatory or unsuitable for the children it is intended for.",
          "Circumvent credit allowances or rate limits — including by creating multiple accounts, sharing an account, or automating sign-ups.",
          "Scrape, crawl, bulk-download or systematically extract content, or use the Service’s output to train, fine-tune, benchmark or distil a machine-learning model, without our prior written permission.",
          "Resell, sublicense, white-label or offer the Service — or its output at scale — as your own teaching product.",
          "Probe, load-test, interfere with, or attempt to gain unauthorised access to the Service, its infrastructure, other teachers’ work, another school’s pupils, or administrative surfaces.",
          "Enter personal data about anyone you are not entitled to enter, including pupils who are not yours to record.",
          "Present Murchid output as verified, accredited or officially approved.",
        ],
      },
    ],
  },
  {
    n: 7,
    title: "Your content",
    body: [
      {
        p: "“Your Content” means what you put into the Service and what it produces for you: briefs and revision instructions, uploaded syllabi and teaching material, generated lessons, quizzes, homework, decks and notes, your classes and timetable, skill profiles, pupil records, marks and attendance.",
      },
      {
        p: "You keep ownership of Your Content. You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, process, transmit and adapt it solely to operate, secure and improve the Service for you — including sending the relevant parts to the AI providers named in the Privacy Policy. The licence ends when you delete the content or your account, except for backups and logs pending routine deletion.",
      },
      {
        p: "We do not use Your Content to train AI models, and we instruct our providers on terms that do not permit training on it.",
      },
      {
        p: "Material you generate is yours to keep, edit, print, share with colleagues and use with your classes, including at the school that employs you.",
      },
    ],
  },
  {
    n: 8,
    title: "Credits and what they buy",
    body: [
      {
        p: "Credits are the unit of consumption. A full lesson — the plan, the teaching guide and the pupil notes — costs 8. A goal plan costs 4. A presentation or a set of materials costs 3. A quiz, a homework sheet, an activity or a regeneration costs 2. A bulletin post, a quiz tweak or a skill profile costs 1. Scheduling and the assistant cost nothing.",
      },
      {
        list: [
          "You see the cost before you generate, and you are charged for what you actually receive: a refusal costs nothing.",
          "Each plan carries a monthly allowance. Allowance credits do not roll over — they reset on the same date each month, anchored to when your plan started rather than to the calendar.",
          "An annual plan is a billing period, not a credit period: you are billed once a year and the allowance still refreshes every month.",
          "Current plans, allowances and prices are shown on the pricing page and may change. Today they are Basic at AED 45 a month for 120 credits, Pro at AED 129 for 350, and Max at AED 295 for 800, with annual billing at ten months’ price.",
        ],
      },
    ],
  },
  {
    n: 9,
    title: "Payment, renewal and cancellation",
    body: [
      {
        list: [
          "Payment is taken by Stripe on a page Stripe hosts. Card details never reach us.",
          "Prices are quoted in UAE dirhams (AED) and are exclusive of VAT and any other tax, which is added where applicable. A price shown in dollars elsewhere is an indication; the dirham amount is what is charged.",
          "A plan renews automatically at the end of each billing period unless you cancel. You can cancel at any time from the billing page or through Stripe’s billing portal; you keep the plan until the end of the period you have paid for.",
          "The free trial runs for 7 days and includes 40 credits. It needs no card and nothing is charged automatically at the end of it.",
          "If a renewal payment fails we allow three days for it to clear. After that the plan ends, and unused credits are cleared with it — an allowance is what you may generate this month, not a balance you accumulate.",
          "Nothing you have made is deleted when a plan ends. Your lessons, classes, pupils and records remain; what stops is generating new material.",
        ],
      },
      {
        p: "Refunds: credits are digital content supplied immediately, and a credit spent on a generation is non-refundable. Unspent allowance and unused subscription time may be refunded at our discretion within 14 days of purchase — write to hello@murchid.app. This does not affect rights you have under applicable UAE consumer protection law, which we will honour.",
      },
    ],
  },
  {
    n: 10,
    title: "No advertising",
    body: [
      {
        p: "There is no advertising anywhere in Murchid, on any plan, and no third-party analytics. No advertising script is loaded, no tracking pixel is embedded, and nothing about you or your pupils is sold, shared with an advertising network, or used to build a profile.",
      },
      {
        p: "If that ever changes we will say so here and in the Privacy Policy before it does, and never in a way that involves data about children.",
      },
    ],
  },
  {
    n: 11,
    title: "Service availability and changes",
    body: [
      {
        p: "We aim to keep the Service available but do not guarantee uninterrupted or error-free operation. It depends on third-party providers, and where one is unavailable a feature may degrade, show an error, or be temporarily unavailable. We may add, change, suspend or discontinue features, and perform maintenance, at any time.",
      },
      {
        p: "Generation depends on AI providers we do not control. If every provider in the pool is unavailable, generation stops until one returns; the rest of the Service — your timetable, your classes, your saved material — keeps working.",
      },
    ],
  },
  {
    n: 12,
    title: "Third-party services",
    body: [
      {
        p: "The Service relies on third parties for hosting, authentication, email, payment and AI generation. They are named in the Privacy Policy. Each is governed by its own terms and privacy policy, and we do not control and are not responsible for their content, availability, security or practices.",
      },
    ],
  },
  {
    n: 13,
    title: "Changes to these Terms",
    body: [
      {
        p: "We may update these Terms as the Service evolves. We will change the “last updated” date, and for material changes give reasonable prior notice in the app or by email. Changes take effect when published, or on the date stated in the notice, and continued use after that constitutes acceptance. If you do not accept a change, stop using the Service and, if you hold a paid plan, contact us about the remainder of your term.",
      },
    ],
  },
  {
    n: 14,
    title: "Disclaimers and limitation of liability",
    body: [
      {
        p: "To the fullest extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, accuracy, completeness or uninterrupted availability. AI-composed material may contain errors despite the context we ground it in.",
      },
      {
        p: "To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive loss, or for loss of profit, revenue, data or goodwill, or for any consequence of teaching material being used without review — including a lesson that misstated a fact, an assessment marked to an incorrect scheme, or content that proved unsuitable for a class. Our total aggregate liability arising out of or relating to the Service is limited to the greater of the amount you paid us in the twelve months before the event giving rise to the claim, or AED 500.",
      },
      {
        p: "Nothing in these Terms excludes or limits liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, or for fraud.",
      },
    ],
  },
  {
    n: 15,
    title: "Suspension and termination",
    body: [
      {
        p: "You may stop using the Service and delete your account at any time from the account page. We may suspend or terminate access, with notice where practicable, if you breach these Terms, if your use threatens the security, integrity or availability of the Service, or if the law requires it.",
      },
      {
        p: "On termination, the sections on your content, liability, indemnity and governing law survive. We delete or de-identify your data as described in the Privacy Policy. Where we terminate for reasons other than your breach, unused paid time may be refunded at our discretion.",
      },
      {
        p: "Before you delete an account, export anything you want to keep. Deleting it removes your material, classes and pupil records, and we cannot recover them afterwards.",
      },
    ],
  },
  {
    n: 16,
    title: "Indemnity",
    body: [
      {
        p: "You agree to indemnify and hold us harmless against claims, losses and reasonable costs arising from your breach of these Terms, your misuse of the Service, your violation of law or third-party rights, or personal data you entered that you were not entitled to enter.",
      },
    ],
  },
  {
    n: 17,
    title: "Governing law and disputes",
    body: [
      {
        p: "These Terms are governed by the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates, without regard to conflict-of-law rules. The courts of Dubai, UAE have exclusive jurisdiction, save that we may seek injunctive relief in any competent court. Nothing here removes a mandatory protection or forum available to you as a consumer under the law of your country of residence.",
      },
    ],
  },
  {
    n: 18,
    title: "General",
    body: [
      {
        p: "These Terms, together with the Privacy Policy, are the entire agreement between us about the Service. If a provision is unenforceable, the rest continues in force, and our failure to enforce a provision is not a waiver of it. You may not assign these Terms; we may assign them to an affiliate or in connection with a merger, acquisition or sale of assets. Nothing here creates a partnership, agency or employment relationship.",
      },
    ],
  },
  {
    n: 19,
    title: "Contact",
    body: [
      {
        p: "Questions about these Terms? Write to hello@murchid.app, or use the account page inside the app.",
      },
    ],
  },
];
