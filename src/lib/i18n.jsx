import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// Lightweight in-house i18n — no dependency. EN + AR with full RTL.
// t("some.key", { name }) → string; falls back to EN then the key.
// Translation is rolled out surface by surface; anything not yet keyed
// just shows its English literal.

const STORAGE_KEY = "mudir.lang";
const RTL_LANGS = new Set(["ar"]);

// ── Dictionaries ──────────────────────────────────────────────────
const EN = {
  // global nav / sidebar
  "nav.planning": "Planning",
  "nav.teaching": "Teaching",
  "nav.data": "Data",
  "nav.admin": "Admin",
  "nav.dev": "Dev",
  "nav.planner": "Planner",
  "nav.lesson-plans": "Lesson Plans",
  "nav.quizzes": "Quizzes",
  "nav.homework": "Homework",
  "nav.presentations": "Presentations",
  "nav.activities": "Activities",
  "nav.database": "My students",
  "nav.admin-console": "Admin console",
  "nav.dev-console": "Dev console",
  "nav.account": "Account",
  "nav.studio": "Studio",
  "nav.reports": "Reports",
  // studio launcher card
  "studio.name": "Studio",
  "studio.subtitle": "Your AI co-pilot for teaching",
  "studio.tagline": "Create · Plan · Inspire",
  "studio.open": "Open Studio",
  "studio.badge": "AI",
  // account footer
  "account.teacher": "Teacher",
  "account.admin": "Admin",
  "account.dev": "Dev",
  // common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.new": "New",
  "common.close": "Close",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.language": "Language",
  // landing — top nav
  "landing.nav.problem": "Problem",
  "landing.nav.solution": "Solution",
  "landing.nav.tools": "Tools",
  "landing.nav.dashboard": "Dashboard",
  "landing.nav.studio": "Studio",
  "landing.nav.try": "Try it",
  "landing.nav.openPlanner": "Lesson Planner →",
  // landing — hero
  "landing.hero.eyebrow": "For teachers, KG–G12 / UAE & beyond",
  "landing.hero.title": "Lesson prep in thirty seconds.",
  "landing.hero.sub":
    "Teachers spend 10+ hours a week preparing lessons after school. Mudir is the AI lesson director that turns a topic into a complete teaching package — plan, slides, worksheet, quiz, homework — aligned to your curriculum. KG through Grade 12. English and Arabic.",
  "landing.hero.ctaPrimary": "Try the prototype →",
  "landing.hero.ctaGhost": "See how it works",
  // common
  "common.deleting": "Deleting…",
  "common.cantUndo": "This action can’t be undone.",
  // shared data-view chrome
  "dv.cards": "Cards",
  "dv.list": "List",
  "dv.recentlyDeleted": "Recently deleted",
  "dv.allTime": "All time",
  "dv.thisWeek": "This week",
  "dv.thisMonth": "This month",
  "dv.customRange": "Custom range",
  "dv.from": "From",
  "dv.to": "To",
  "dv.create": "Create",
  "dv.howA": "How would you like to ",
  "dv.howB": "?",
  "dv.manually": "Manually",
  "dv.manuallyDesc": "Fill in the fields yourself. Best when you already know what you want.",
  "dv.withAI": "With Studio AI",
  "dv.withAIDesc": "Describe what you need and let Mudir draft it for you.",
  "confirm.eyebrow": "Delete",
  "trash.title": "Trash",
  "trash.note": "Items here are auto-purged after 30 days. Restore brings them back; Delete forever clears them now.",
  "trash.empty": "Nothing in the trash. Items you delete will show up here for 30 days.",
  "trash.restore": "Restore",
  "trash.deleteForever": "Delete forever",
  "trash.confirmForever": "Delete forever? This cannot be undone.",
  "dp.placeholder": "dd / mm / yyyy",
  "dp.clear": "Clear",
  "dp.today": "Today",
  // planner
  "nav.schedule": "Schedule",
  "planner.subtitle": "Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.",
  "planner.all": "All",
  "planner.schedule": "Schedule",
  "planner.today": "Today",
  "planner.prevMonth": "Previous month",
  "planner.nextMonth": "Next month",
  "planner.thisMonth": "This Month Overview",
  "planner.planned": "Planned",
  "planner.completed": "Completed",
  "planner.todo": "To do",
  "planner.progress": "Progress",
  "planner.upcoming": "Upcoming",
  "planner.viewAll": "View all",
  "planner.allDay": "All day",
  "planner.quickActions": "Quick Actions",
  "planner.thisDay": "This day",
  "planner.noEntries": "No entries yet on this day.",
  "planner.newEntry": "New entry",
  "planner.studioAI": "Studio AI",
  "planner.heroA": "What would you like to ",
  "planner.heroCreate": "create",
  "planner.heroB": " today?",
  "planner.heroSub": "Your AI co-pilot that helps you plan, save time, and make every class amazing.",
  "planner.qa.lesson": "New Lesson Plan",
  "planner.qa.quiz": "New Quiz",
  "planner.qa.homework": "New Homework",
  "planner.qa.presentation": "New Presentation",
  "hero.lesson.verb": "Generate",       "hero.lesson.noun": "Lesson Plan",
  "hero.quiz.verb": "Create",           "hero.quiz.noun": "Quiz",
  "hero.presentation.verb": "Build",    "hero.presentation.noun": "Presentation",
  "hero.weekly.verb": "Plan",           "hero.weekly.noun": "Weekly Schedule",
  "hero.insights.verb": "Analyze",      "hero.insights.noun": "Students",
  "hero.ask.verb": "Ask",               "hero.ask.noun": "Anything",
  // chip pages
  "chip.loading": "Loading…",
  "chip.noFilterMatch": "Nothing matches the current filters.",
  "q.eyebrow": "Quizzes & exams",
  "q.titlePlain": "Quizzes & ",
  "q.titleEm": "exams",
  "q.sub": "Build, schedule, and grade. MCQ, true/false, short, and essay.",
  "q.new": "New quiz",
  "q.empty": "No quizzes yet — click “New quiz” to build one.",
  "hw.eyebrow": "Homework",
  "hw.titleEm": "Homework",
  "hw.titlePlain": " tasks",
  "hw.sub": "Assign work to a class, track who's done it, grade and give feedback.",
  "hw.new": "New homework",
  "hw.empty": "No homework yet — click “New homework” to assign one.",
  "ac.eyebrow": "Activities",
  "ac.titlePlain": "Classroom ",
  "ac.titleEm": "activities",
  "ac.sub": "Pair-work, group tasks, individual exercises — with materials and timing.",
  "ac.new": "New activity",
  "ac.empty": "No activities yet — click “New activity” to create one.",
  "pr.eyebrow": "Presentations",
  "pr.titlePlain": "Slide ",
  "pr.titleEm": "decks",
  "pr.sub": "Build slide-based presentations linked to your lessons.",
  "pr.new": "New presentation",
  "pr.empty": "No presentations yet — click “New presentation” to build one.",
  "tp.eyebrow": "Templates",
  "tp.titlePlain": "Templates ",
  "tp.titleEm": "library",
  "tp.sub": "Pick a starting point. Edit it once, reuse it forever.",
  "tp.new": "New template",
  "tp.search": "Search templates by name, subject, topic…",
  "tp.loading": "Loading templates from Neon…",
  "tp.empty": "No templates match your filters.",
  "dr.eyebrow": "Drafts",
  "dr.titlePlain": "Your ",
  "dr.titleEm": "drafts",
  "dr.sub": "Lesson plans you started, paused, or saved to reuse later. Only you can see these.",
  "dr.search": "Search drafts by name, subject, topic…",
  "dr.loading": "Loading drafts from Neon…",
  "dr.empty": "No drafts match the current filters.",
  "dr.new": "New lesson plan",
  // studio shell
  "studio.pdf": "PDF",
  "studio.copy": "Copy",
  "studio.copied": "Copied",
  "studio.save": "Save",
  "studio.saving": "Saving…",
  "studio.new": "New",
  "studio.cancel": "Cancel",
  "studio.generating": "Generating",
  "studio.done": "Done",
  "studio.thinking": "Mudir is thinking…",
  "studio.refine": "Refine with Mudir",
  "studio.refinePicked": "Edit by chatting — Mudir applies your instruction to the picked scope.",
  "studio.refineSection": "Edit by chatting — Mudir applies your instruction to the open section.",
  "kind.lesson_plan": "Lesson",
  "kind.quiz": "Quiz",
  "kind.homework": "Homework",
  "kind.activity": "Activity",
  "kind.presentation": "Presentation",
  "kind.schedule": "Schedule",
  // landing body — section headings (plain text; <em>/<br> dropped)
  "lp.problem.eyebrow": "The problem",
  "lp.problem.title": "Teachers don't have a time problem. They have a prep problem.",
  "lp.solution.eyebrow": "The solution",
  "lp.solution.title": "From topic to taught, in four steps.",
  "lp.tools.eyebrow": "Inside Mudir",
  "lp.tools.title": "Eight tools. One studio.",
  "lp.hub.eyebrow": "The teacher's hub",
  "lp.hub.title": "A home base, not another inbox.",
  "lp.studio.eyebrow": "In the studio",
  "lp.studio.title": "Mudir drafts. You direct.",
  "lp.static.eyebrow": "Static screens",
  "lp.static.title": "What it looks like.",
  "lp.pricing.eyebrow": "What's included",
  "lp.try.eyebrow": "Live prototype · click around",
  "lp.try.title": "Try it yourself.",
  // landing — nav
  "lp.nav.how": "How it works",
  "lp.nav.features": "Features",
  "lp.nav.aistudio": "AI studio",
  "lp.nav.build": "How we build",
  "lp.nav.signin": "Sign in",
  "lp.nav.openPlanner": "Open the planner",
  // landing — brand (kept latin in every language)
  "lp.brand": "Mudir",
  // landing — hero
  "lp.hero.eyebrow": "An AI lesson director · Built for UAE schools",
  "lp.hero.h1a": "The teacher directs.",
  "lp.hero.brand": "Mudir",
  "lp.hero.h1b": "drafts.",
  "lp.hero.studioEyebrow": "The studio",
  "lp.hero.studioBody": "One studio for every artifact. You direct the lesson — Mudir builds the rest, classroom-ready.",
  "lp.hero.seeHow": "See how it works",
  "lp.hero.mobileSub": "Lessons, quizzes, slides, homework — every teaching artifact, drafted for you and ready to teach.",
  // landing — showcase
  "lp.show.libraryEyebrow": "The library",
  "lp.show.libraryWin": "Library",
  "lp.show.mHeadA": "Whether you're planning tomorrow's lesson or building a full unit —",
  "lp.show.mHeadB": "turns intent into",
  "lp.show.mHeadAccent": "classroom-ready",
  "lp.show.mHeadC": "material.",
  "lp.show.visionA": "One studio.",
  "lp.show.visionEm": "Every subject,",
  "lp.show.visionB": "every grade.",
  "lp.show.visionSub": "Every lesson tells a story. Mudir helps you plan it, build it, and teach it.",
  // landing — community
  "lp.comm.headA": "You'll find",
  "lp.comm.headEm": "every subject",
  "lp.comm.headB": "here.",
  "lp.comm.sub": "Built with teachers across the UAE — from KG to Grade 12, every classroom.",
  // accessibility widget
  "a11y.open": "Accessibility tools",
  "a11y.title": "Accessibility",
  "a11y.subtitle": "Adjust the page to suit you. Choices are saved on this device.",
  "a11y.reset": "Reset all",
  "a11y.done": "Done",
  "a11y.textSize": "Text size",
  "a11y.textSizeHint": "Make all text bigger",
  "a11y.readableFont": "Readable font",
  "a11y.readableFontHint": "Switch to a clearer, dyslexia-friendly typeface",
  "a11y.letterSpacing": "Letter spacing",
  "a11y.wordSpacing": "Word spacing",
  "a11y.lineHeight": "Line spacing",
  "a11y.contrast": "High contrast",
  "a11y.contrastHint": "Stronger colours and outlines",
  "a11y.grayscale": "Grayscale",
  "a11y.grayscaleHint": "Remove colour",
  "a11y.lowSaturation": "Low saturation",
  "a11y.lowSaturationHint": "Soften colours",
  "a11y.colorBlind": "Colour-blind filter",
  "a11y.colorBlindHint": "Shift colours for colour-vision deficiency",
  "a11y.cb.off": "Off",
  "a11y.cb.prot": "Red",
  "a11y.cb.deut": "Green",
  "a11y.cb.trit": "Blue",
  "a11y.bigCursor": "Big cursor",
  "a11y.highlightLinks": "Highlight links",
  "a11y.highlightLinksHint": "Outline every link and button",
  "a11y.stopAnimations": "Stop animations",
  "a11y.stopAnimationsHint": "Pause motion and transitions",
  "a11y.readAloud": "Read aloud",
  "a11y.readAloudOn": "Click any text to hear it",
  "a11y.readAloudHint": "Have the page read to you",
  "a11y.stopReading": "Stop reading",
  "a11y.off": "Off",
  "a11y.on": "On",
  "a11y.profilesTitle": "Quick profiles",
  "a11y.visionProfile": "Low vision",
  "a11y.dyslexiaProfile": "Dyslexia",
  "a11y.motorProfile": "Motor / focus",
};

const AR = {
  "nav.planning": "التخطيط",
  "nav.teaching": "التدريس",
  "nav.data": "البيانات",
  "nav.admin": "الإدارة",
  "nav.dev": "المطوّر",
  "nav.planner": "المخطّط",
  "nav.lesson-plans": "خطط الدروس",
  "nav.quizzes": "الاختبارات",
  "nav.homework": "الواجبات",
  "nav.presentations": "العروض التقديمية",
  "nav.activities": "الأنشطة",
  "nav.database": "طلابي",
  "nav.admin-console": "لوحة الإدارة",
  "nav.dev-console": "لوحة المطوّر",
  "nav.account": "الحساب",
  "nav.studio": "الاستوديو",
  "nav.reports": "التقارير",
  "studio.name": "الاستوديو",
  "studio.subtitle": "مساعدك الذكي في التدريس",
  "studio.tagline": "أنشئ · خطّط · ألهم",
  "studio.open": "افتح الاستوديو",
  "studio.badge": "ذكاء",
  "account.teacher": "معلّم",
  "account.admin": "مدير",
  "account.dev": "مطوّر",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.new": "جديد",
  "common.close": "إغلاق",
  "common.edit": "تعديل",
  "common.delete": "حذف",
  "common.loading": "جارٍ التحميل…",
  "common.language": "اللغة",
  "landing.nav.problem": "المشكلة",
  "landing.nav.solution": "الحل",
  "landing.nav.tools": "الأدوات",
  "landing.nav.dashboard": "لوحة التحكم",
  "landing.nav.studio": "الاستوديو",
  "landing.nav.try": "جرّبه",
  "landing.nav.openPlanner": "مخطّط الدروس ←",
  "landing.hero.eyebrow": "للمعلّمين، من الروضة إلى الصف 12 / الإمارات وما بعدها",
  "landing.hero.title": "تحضير الدرس في ثلاثين ثانية.",
  "landing.hero.sub":
    "يقضي المعلّمون أكثر من 10 ساعات أسبوعيًا في تحضير الدروس بعد المدرسة. مدير هو مدير الدروس الذكي الذي يحوّل أي موضوع إلى حزمة تدريس متكاملة — خطة وشرائح وورقة عمل واختبار وواجب — متوافقة مع منهجك. من الروضة إلى الصف 12. بالعربية والإنجليزية.",
  "landing.hero.ctaPrimary": "جرّب النموذج ←",
  "landing.hero.ctaGhost": "شاهد كيف يعمل",
  "common.deleting": "جارٍ الحذف…",
  "common.cantUndo": "لا يمكن التراجع عن هذا الإجراء.",
  "dv.cards": "بطاقات",
  "dv.list": "قائمة",
  "dv.recentlyDeleted": "المحذوفة مؤخرًا",
  "dv.allTime": "كل الوقت",
  "dv.thisWeek": "هذا الأسبوع",
  "dv.thisMonth": "هذا الشهر",
  "dv.customRange": "نطاق مخصص",
  "dv.from": "من",
  "dv.to": "إلى",
  "dv.create": "إنشاء",
  "dv.howA": "كيف تريد ",
  "dv.howB": "؟",
  "dv.manually": "يدويًا",
  "dv.manuallyDesc": "املأ الحقول بنفسك. الأفضل عندما تعرف ما تريد بالضبط.",
  "dv.withAI": "باستخدام استوديو الذكاء",
  "dv.withAIDesc": "صِف ما تحتاجه ودَع مدير يكتبه لك.",
  "confirm.eyebrow": "حذف",
  "trash.title": "المهملات",
  "trash.note": "تُحذف العناصر هنا تلقائيًا بعد 30 يومًا. الاستعادة تعيدها، والحذف النهائي يمسحها الآن.",
  "trash.empty": "لا شيء في المهملات. تظهر العناصر المحذوفة هنا لمدة 30 يومًا.",
  "trash.restore": "استعادة",
  "trash.deleteForever": "حذف نهائي",
  "trash.confirmForever": "حذف نهائي؟ لا يمكن التراجع عن ذلك.",
  "dp.placeholder": "يوم / شهر / سنة",
  "dp.clear": "مسح",
  "dp.today": "اليوم",
  "nav.schedule": "الجدول",
  "planner.subtitle": "خطط الدروس والجدول والاختبارات والواجبات والعروض والأنشطة — كلها في شبكة واحدة.",
  "planner.all": "الكل",
  "planner.schedule": "الجدول",
  "planner.today": "اليوم",
  "planner.prevMonth": "الشهر السابق",
  "planner.nextMonth": "الشهر التالي",
  "planner.thisMonth": "ملخّص هذا الشهر",
  "planner.planned": "مخطّط",
  "planner.completed": "مكتمل",
  "planner.todo": "المتبقّي",
  "planner.progress": "التقدّم",
  "planner.upcoming": "القادم",
  "planner.viewAll": "عرض الكل",
  "planner.allDay": "طوال اليوم",
  "planner.quickActions": "إجراءات سريعة",
  "planner.thisDay": "هذا اليوم",
  "planner.noEntries": "لا توجد إدخالات في هذا اليوم بعد.",
  "planner.newEntry": "إدخال جديد",
  "planner.studioAI": "استوديو الذكاء",
  "planner.heroA": "ماذا تريد أن ",
  "planner.heroCreate": "تُنشئ",
  "planner.heroB": " اليوم؟",
  "planner.heroSub": "مساعدك الذكي الذي يساعدك على التخطيط وتوفير الوقت وجعل كل حصة رائعة.",
  "planner.qa.lesson": "خطة درس جديدة",
  "planner.qa.quiz": "اختبار جديد",
  "planner.qa.homework": "واجب جديد",
  "planner.qa.presentation": "عرض جديد",
  "hero.lesson.verb": "أنشئ",      "hero.lesson.noun": "خطة درس",
  "hero.quiz.verb": "أنشئ",        "hero.quiz.noun": "اختبار",
  "hero.presentation.verb": "ابنِ", "hero.presentation.noun": "عرض تقديمي",
  "hero.weekly.verb": "خطّط",      "hero.weekly.noun": "جدول أسبوعي",
  "hero.insights.verb": "حلّل",    "hero.insights.noun": "الطلاب",
  "hero.ask.verb": "اسأل",         "hero.ask.noun": "أي شيء",
  "chip.loading": "جارٍ التحميل…",
  "chip.noFilterMatch": "لا شيء يطابق عوامل التصفية الحالية.",
  "q.eyebrow": "الاختبارات والامتحانات",
  "q.titlePlain": "الاختبارات و",
  "q.titleEm": "الامتحانات",
  "q.sub": "أنشئ وجدوِل وصحّح. اختيار من متعدد، صح/خطأ، إجابة قصيرة، ومقالي.",
  "q.new": "اختبار جديد",
  "q.empty": "لا اختبارات بعد — اضغط «اختبار جديد» لإنشاء واحد.",
  "hw.eyebrow": "الواجبات",
  "hw.titleEm": "واجبات",
  "hw.titlePlain": " منزلية",
  "hw.sub": "كلّف صفًّا بعمل، وتابع من أنجزه، وصحّح وقدّم ملاحظات.",
  "hw.new": "واجب جديد",
  "hw.empty": "لا واجبات بعد — اضغط «واجب جديد» لتكليف واحد.",
  "ac.eyebrow": "الأنشطة",
  "ac.titlePlain": "أنشطة ",
  "ac.titleEm": "صفّية",
  "ac.sub": "عمل ثنائي، مهام جماعية، تمارين فردية — مع المواد والتوقيت.",
  "ac.new": "نشاط جديد",
  "ac.empty": "لا أنشطة بعد — اضغط «نشاط جديد» لإنشاء واحد.",
  "pr.eyebrow": "العروض التقديمية",
  "pr.titlePlain": "حزم ",
  "pr.titleEm": "شرائح",
  "pr.sub": "أنشئ عروضًا تقديمية بالشرائح مرتبطة بدروسك.",
  "pr.new": "عرض جديد",
  "pr.empty": "لا عروض بعد — اضغط «عرض جديد» لإنشاء واحد.",
  "tp.eyebrow": "القوالب",
  "tp.titlePlain": "مكتبة ",
  "tp.titleEm": "القوالب",
  "tp.sub": "اختر نقطة بداية. عدّلها مرة، وأعد استخدامها للأبد.",
  "tp.new": "قالب جديد",
  "tp.search": "ابحث في القوالب بالاسم أو المادة أو الموضوع…",
  "tp.loading": "جارٍ تحميل القوالب من Neon…",
  "tp.empty": "لا قوالب تطابق عوامل التصفية.",
  "dr.eyebrow": "المسودّات",
  "dr.titlePlain": "مسودّاتك",
  "dr.titleEm": "",
  "dr.sub": "خطط دروس بدأتها أو أوقفتها أو حفظتها لإعادة استخدامها لاحقًا. أنت وحدك من يراها.",
  "dr.search": "ابحث في المسودّات بالاسم أو المادة أو الموضوع…",
  "dr.loading": "جارٍ تحميل المسودّات من Neon…",
  "dr.empty": "لا مسودّات تطابق عوامل التصفية الحالية.",
  "dr.new": "خطة درس جديدة",
  "studio.pdf": "PDF",
  "studio.copy": "نسخ",
  "studio.copied": "تم النسخ",
  "studio.save": "حفظ",
  "studio.saving": "جارٍ الحفظ…",
  "studio.new": "جديد",
  "studio.cancel": "إلغاء",
  "studio.generating": "جارٍ الإنشاء",
  "studio.done": "تم",
  "studio.thinking": "مدير يفكّر…",
  "studio.refine": "حسّن مع مدير",
  "studio.refinePicked": "عدّل بالمحادثة — يطبّق مدير تعليمك على النطاق المحدّد.",
  "studio.refineSection": "عدّل بالمحادثة — يطبّق مدير تعليمك على القسم المفتوح.",
  "kind.lesson_plan": "درس",
  "kind.quiz": "اختبار",
  "kind.homework": "واجب",
  "kind.activity": "نشاط",
  "kind.presentation": "عرض",
  "kind.schedule": "جدول",
  "lp.problem.eyebrow": "المشكلة",
  "lp.problem.title": "ليست لدى المعلّمين مشكلة وقت، بل مشكلة تحضير.",
  "lp.solution.eyebrow": "الحل",
  "lp.solution.title": "من الموضوع إلى التدريس، في أربع خطوات.",
  "lp.tools.eyebrow": "داخل مدير",
  "lp.tools.title": "ثماني أدوات. استوديو واحد.",
  "lp.hub.eyebrow": "مركز المعلّم",
  "lp.hub.title": "قاعدة انطلاق، لا صندوق وارد آخر.",
  "lp.studio.eyebrow": "في الاستوديو",
  "lp.studio.title": "مدير يكتب. أنت توجّه.",
  "lp.static.eyebrow": "لقطات ثابتة",
  "lp.static.title": "كيف يبدو.",
  "lp.pricing.eyebrow": "ما المتضمَّن",
  "lp.try.eyebrow": "نموذج حي · جرّب بنفسك",
  "lp.try.title": "جرّبه بنفسك.",
  // landing — nav
  "lp.nav.how": "كيف يعمل",
  "lp.nav.features": "المزايا",
  "lp.nav.aistudio": "استوديو الذكاء",
  "lp.nav.build": "منهجيّتنا",
  "lp.nav.signin": "تسجيل الدخول",
  "lp.nav.openPlanner": "افتح المُخطِّط",
  // landing — brand (kept latin in every language)
  "lp.brand": "Mudir",
  // landing — hero
  "lp.hero.eyebrow": "مُخرِج دروس بالذكاء الاصطناعي · مصمَّم لمدارس الإمارات",
  "lp.hero.h1a": "المعلّم يُوجِّه.",
  "lp.hero.brand": "Mudir",
  "lp.hero.h1b": "يَصوغ.",
  "lp.hero.studioEyebrow": "الاستوديو",
  "lp.hero.studioBody": "استوديو واحد لكل مُخرَج. أنت تُوجِّه الدرس — وMudir يبني الباقي جاهزًا للصَّف.",
  "lp.hero.seeHow": "شاهد كيف يعمل",
  "lp.hero.mobileSub": "دروس واختبارات وشرائح وواجبات — كل مُخرَج تعليمي يُصاغ لك وجاهز للتدريس.",
  // landing — showcase
  "lp.show.libraryEyebrow": "المكتبة",
  "lp.show.libraryWin": "المكتبة",
  "lp.show.mHeadA": "سواء تُحضّر درس الغد أو تبني وحدة كاملة —",
  "lp.show.mHeadB": "يحوّل النيّة إلى",
  "lp.show.mHeadAccent": "مادّة جاهزة",
  "lp.show.mHeadC": "للصَّف.",
  "lp.show.visionA": "استوديو واحد.",
  "lp.show.visionEm": "كل مادّة،",
  "lp.show.visionB": "كل صف.",
  "lp.show.visionSub": "كل درس يحكي قصّة. يساعدك Mudir على تخطيطه وبنائه وتدريسه.",
  // landing — community
  "lp.comm.headA": "ستجد",
  "lp.comm.headEm": "كل مادّة",
  "lp.comm.headB": "هنا.",
  "lp.comm.sub": "بُني مع معلّمين من كل أنحاء الإمارات — من الروضة إلى الصف 12، كل صفّ.",
  "a11y.open": "أدوات الوصول",
  "a11y.title": "إمكانية الوصول",
  "a11y.subtitle": "اضبط الصفحة بما يناسبك. تُحفظ اختياراتك على هذا الجهاز.",
  "a11y.reset": "إعادة الكل",
  "a11y.done": "تم",
  "a11y.textSize": "حجم النص",
  "a11y.textSizeHint": "تكبير كل النصوص",
  "a11y.readableFont": "خط مقروء",
  "a11y.readableFontHint": "التبديل إلى خط أوضح ومناسب لعسر القراءة",
  "a11y.letterSpacing": "تباعد الأحرف",
  "a11y.wordSpacing": "تباعد الكلمات",
  "a11y.lineHeight": "تباعد الأسطر",
  "a11y.contrast": "تباين عالٍ",
  "a11y.contrastHint": "ألوان وحدود أقوى",
  "a11y.grayscale": "تدرّج رمادي",
  "a11y.grayscaleHint": "إزالة الألوان",
  "a11y.lowSaturation": "تشبّع منخفض",
  "a11y.lowSaturationHint": "تخفيف الألوان",
  "a11y.colorBlind": "مرشّح عمى الألوان",
  "a11y.colorBlindHint": "تعديل الألوان لقصور رؤية الألوان",
  "a11y.cb.off": "إيقاف",
  "a11y.cb.prot": "أحمر",
  "a11y.cb.deut": "أخضر",
  "a11y.cb.trit": "أزرق",
  "a11y.bigCursor": "مؤشّر كبير",
  "a11y.highlightLinks": "إبراز الروابط",
  "a11y.highlightLinksHint": "تحديد كل رابط وزر",
  "a11y.stopAnimations": "إيقاف الحركة",
  "a11y.stopAnimationsHint": "إيقاف الحركة والانتقالات",
  "a11y.readAloud": "قراءة بصوت",
  "a11y.readAloudOn": "انقر أي نص لسماعه",
  "a11y.readAloudHint": "اجعل الصفحة تُقرأ لك",
  "a11y.stopReading": "إيقاف القراءة",
  "a11y.off": "إيقاف",
  "a11y.on": "تشغيل",
  "a11y.profilesTitle": "ملفات سريعة",
  "a11y.visionProfile": "ضعف البصر",
  "a11y.dyslexiaProfile": "عسر القراءة",
  "a11y.motorProfile": "حركي / تركيز",
};

const DICTS = { en: EN, ar: AR };

// ── Context ───────────────────────────────────────────────────────
const I18nContext = createContext({
  lang: "en",
  dir: "ltr",
  isRTL: false,
  setLang: () => {},
  t: (k) => k,
});

function applyDocumentLang(lang) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof localStorage === "undefined") return "en";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "en";
  });

  useEffect(() => { applyDocumentLang(lang); }, [lang]);

  const setLang = useCallback((next) => {
    const v = next === "ar" ? "ar" : "en";
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    setLangState(v);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || EN;
      let s = dict[key];
      if (s == null) s = EN[key];
      if (s == null) return key;
      if (vars) {
        for (const [k, val] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
        }
      }
      return s;
    },
    [lang]
  );

  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  const value = { lang, dir, isRTL: dir === "rtl", setLang, t };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
// Convenience: const t = useT();
export function useT() {
  return useContext(I18nContext).t;
}

// ── Language toggle ───────────────────────────────────────────────
// Compact EN | ع pill. Drop it anywhere (sidebar, landing nav).
export function LangToggle({ className = "" }) {
  const { lang, setLang } = useI18n();
  const opts = [
    { v: "en", label: "EN" },
    { v: "ar", label: "ع" },
  ];
  return (
    <div
      className={`inline-flex items-center rounded-full border border-line bg-paper-cool p-0.5 ${className}`}
      role="group"
      aria-label="Language"
      dir="ltr"
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setLang(o.v)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium leading-none transition ${
            lang === o.v
              ? "bg-ink text-paper-cool"
              : "text-ink-soft hover:text-ink"
          }`}
          aria-pressed={lang === o.v}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
