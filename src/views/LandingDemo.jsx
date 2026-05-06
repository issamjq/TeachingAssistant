import React, { useState, useEffect, useRef } from "react";

const lessonTemplates = {
  Science: {
    objectives: [
      "Explain how plants convert sunlight into chemical energy.",
      "Identify the three main inputs (light, water, CO₂) and outputs (glucose, oxygen).",
      "Diagram the photosynthesis process using accurate scientific labels.",
    ],
    materials: "Leaf samples, magnifying glasses, projector, worksheet handouts, colored pencils.",
    differentiation:
      "Advanced learners explore the chemical equation 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ and complete extension questions on cellular respiration. Support learners receive a labeled diagram and sentence starters for written explanations.",
    standards:
      "Aligned to UAE MOE Science Framework — Strand 3: Life Sciences, Outcome 6.3.2 (Plant Processes & Energy Transfer).",
    timeline: [
      { time: "0–5 min", text: "<strong>Hook:</strong> Show a wilted plant beside a thriving one. Ask: what makes the difference?" },
      { time: "5–15 min", text: "<strong>Direct instruction:</strong> Walk through photosynthesis using slide deck + leaf cross-section model." },
      { time: "15–25 min", text: "<strong>Pair activity:</strong> Students sketch the process on whiteboards. Teacher circulates." },
      { time: "25–38 min", text: "<strong>Worksheet:</strong> Students complete differentiated questions individually." },
      { time: "38–45 min", text: "<strong>Exit ticket:</strong> 5-question quick check + introduce homework." },
    ],
    slides: [
      "Why are leaves green?",
      "Three ingredients: sun, water, air",
      "Inside a chloroplast",
      "Inputs and outputs diagram",
      "The chemical equation",
      "Why it matters: oxygen for us",
      "Quick check — your turn",
      "Recap & exit ticket",
      "Homework preview",
    ],
    worksheet:
      "Tier 1 (core): Label the diagram of a leaf. Match inputs to outputs. Tier 2 (extension): Explain in 3–4 sentences why a plant in a dark room dies, using scientific vocabulary. Predict what would happen if Earth had no plants.",
    quiz:
      "1. What gas do plants take in?  2. What gas do plants release?  3. Where in the cell does photosynthesis happen?  4. What's the role of chlorophyll?  5. Name one human activity that depends on photosynthesis.",
    homework:
      "Find a plant at home. Sketch it and label the parts involved in photosynthesis. Write 3 sentences explaining what would happen if it were placed in a dark closet for one week.",
  },
  Mathematics: {
    objectives: [
      "Solve multi-step word problems using order of operations.",
      "Apply PEMDAS to algebraic expressions accurately.",
      "Justify each step of the working using mathematical reasoning.",
    ],
    materials: "Whiteboard, individual mini-whiteboards, worksheet, calculator (optional for tier 2).",
    differentiation: "Tier 1: scaffolded steps with visual cues. Tier 2: open-ended problem-solving with multiple solution paths and proof requirements.",
    standards: "UAE MOE Mathematics Framework, Number & Algebra strand. Common Core alignment: 6.EE.A.2.",
    timeline: [
      { time: "0–5 min", text: "<strong>Warm-up:</strong> Quick mental maths review on the board." },
      { time: "5–15 min", text: "<strong>Direct instruction:</strong> Demonstrate worked examples step-by-step." },
      { time: "15–25 min", text: "<strong>Guided practice:</strong> Students work in pairs on whiteboards." },
      { time: "25–38 min", text: "<strong>Independent practice:</strong> Differentiated worksheet." },
      { time: "38–45 min", text: "<strong>Exit ticket:</strong> Three quick problems to check understanding." },
    ],
    slides: [
      "Today's challenge",
      "Why order matters",
      "Worked example 1",
      "Worked example 2 (with traps)",
      "Common mistakes",
      "Your turn — pair work",
      "Independent practice",
      "Exit ticket",
      "Homework",
    ],
    worksheet: "Tier 1: 8 problems with step-by-step prompts. Tier 2: 5 challenge problems requiring written justification of each step.",
    quiz:
      "1. Solve: 3 + 4 × 2.  2. Solve: (5+3)² ÷ 4.  3. Solve: 12 − 6 ÷ 2 + 1.  4. What's wrong with: 2 + 3 × 4 = 20?  5. Write your own multi-step problem.",
    homework: "Complete problems 1–10 from textbook section 4.2. Show all working. Choose one problem to explain in writing as if teaching a younger student.",
  },
  English: {
    objectives: [
      "Identify character feelings using textual evidence.",
      "Make logical inferences beyond what is explicitly stated.",
      "Write a short paragraph supporting a claim with two pieces of evidence.",
    ],
    materials: "Short story handout, highlighters, graphic organizer, sticky notes.",
    differentiation: "Support: pre-highlighted text and sentence frames. Core: standard text with graphic organizer. Extension: students compare two characters' emotional arcs.",
    standards: "Cambridge Stage 6 Reading. UAE MOE English Reading Outcome 6.2.4 (inference & analysis).",
    timeline: [
      { time: "0–5 min", text: "<strong>Hook:</strong> Show a photo. Ask: what is this person feeling? How can you tell?" },
      { time: "5–15 min", text: "<strong>Modeled reading:</strong> Read first paragraph aloud. Think aloud about inferences." },
      { time: "15–28 min", text: "<strong>Independent reading:</strong> Students read and annotate." },
      { time: "28–40 min", text: "<strong>Pair discussion + writing:</strong> Students draft response paragraph." },
      { time: "40–45 min", text: "<strong>Share-out + exit ticket.</strong>" },
    ],
    slides: [
      "What is inference?",
      "Reading between the lines",
      "Modeling: think-aloud",
      "Evidence + reasoning",
      "Your reading task",
      "Pair discussion prompts",
      "Writing the response",
      "Share-out",
      "Exit ticket",
    ],
    worksheet: "Tier 1: graphic organizer with sentence stems. Tier 2: free-response inference task with at least two pieces of evidence required.",
    quiz:
      "1. Define inference in your own words.  2. Find one piece of evidence the character is nervous.  3. What's the difference between stated and implied?  4. Write one sentence about how the character changes.  5. What clue helped you most?",
    homework: "Read pages 12–18. Annotate three moments where you made an inference. Be ready to share one with the class tomorrow.",
  },
  Arabic: {
    objectives: [
      "التعرف على الحروف العربية الأساسية: الألف، الباء، التاء.",
      "تكوين كلمات بسيطة من هذه الحروف.",
      "كتابة الحروف بشكل صحيح في أشكالها المختلفة.",
    ],
    materials:
      "بطاقات الحروف، أوراق عمل، أقلام تلوين، مسجل صوت لأغنية الحروف.",
    differentiation:
      "للمتقدمين: تكوين جمل بسيطة باستخدام الحروف الثلاثة. للمحتاجين لدعم: تتبع الحروف على ورقة محضرة مسبقاً.",
    standards:
      "منهج وزارة التربية والتعليم — اللغة العربية، الصف الأول، الوحدة 1.",
    timeline: [
      { time: "0–5 min", text: "<strong>الافتتاحية:</strong> أغنية الحروف العربية الترحيبية." },
      { time: "5–15 min", text: "<strong>التقديم:</strong> عرض الحروف الثلاثة بطرق متعددة." },
      { time: "15–25 min", text: "<strong>نشاط جماعي:</strong> ألعاب البحث عن الحرف." },
      { time: "25–38 min", text: "<strong>الكتابة:</strong> تتبع الحروف وتلوينها." },
      { time: "38–45 min", text: "<strong>تقويم سريع:</strong> بطاقات التعرف." },
    ],
    slides: [
      "أهلاً بكم!",
      "حرف الألف",
      "حرف الباء",
      "حرف التاء",
      "كلمات من حروفنا",
      "نشاط الكتابة",
      "اللعبة",
      "الواجب",
      "إلى اللقاء",
    ],
    worksheet:
      "المستوى الأول: تتبع الحروف. المستوى الثاني: كتابة الحرف بأشكاله المختلفة وتكوين كلمتين.",
    quiz:
      "1. ما هو هذا الحرف؟  2. اكتب حرف الألف.  3. اختر الكلمة التي تبدأ بحرف الباء.  4. كم حرفاً تعلمنا اليوم؟  5. ارسم شيئاً يبدأ بحرف التاء.",
    homework:
      "كتابة الحروف الثلاثة خمس مرات في الكراسة. ارسم شيئاً يبدأ بكل حرف.",
  },
  "Islamic Studies": {
    objectives: [
      "Understand the meaning and significance of the five pillars of Islam.",
      "Identify each pillar by name and core practice.",
      "Reflect on how the pillars shape daily Muslim life.",
    ],
    materials: "Visual chart of the five pillars, student journals, group activity cards.",
    differentiation: "Support: matching activity with images. Core: pillar summary task. Extension: short essay on which pillar resonates most personally and why.",
    standards: "UAE MOE Islamic Studies Framework, Foundation Strand.",
    timeline: [
      { time: "0–5 min", text: "<strong>Opening du'a + recap of last lesson.</strong>" },
      { time: "5–18 min", text: "<strong>Direct teaching:</strong> Walk through each pillar with examples." },
      { time: "18–30 min", text: "<strong>Group work:</strong> Each group presents one pillar." },
      { time: "30–40 min", text: "<strong>Reflective journaling.</strong>" },
      { time: "40–45 min", text: "<strong>Exit ticket + closing.</strong>" },
    ],
    slides: [
      "Bismillah — opening",
      "What is a pillar?",
      "1. Shahada",
      "2. Salah",
      "3. Zakat",
      "4. Sawm",
      "5. Hajj",
      "Reflection",
      "Closing du'a",
    ],
    worksheet: "Tier 1: match each pillar to its description. Tier 2: write a paragraph explaining how one pillar appears in your weekly life.",
    quiz: "1. Name the five pillars in order.  2. What does Shahada mean?  3. How many times a day is Salah?  4. When is Sawm performed?  5. Who is required to do Hajj?",
    homework: "Talk to a family member about a pillar that's meaningful to them. Write 3 sentences sharing what they said.",
  },
  "Social Studies": {
    objectives: [
      "Identify key trade routes connecting the Arabian Peninsula to the wider world.",
      "Analyze how geography shaped trade and culture.",
      "Connect historical trade to modern UAE economic strengths.",
    ],
    materials: "Wall map, route cards, primary source excerpts, timeline handout.",
    differentiation: "Support: pre-labeled map and guided questions. Core: blank map activity. Extension: research one trade good and present a one-minute mini-lesson.",
    standards: "UAE MOE Social Studies Framework, Strand: Heritage & Geography.",
    timeline: [
      { time: "0–5 min", text: "<strong>Hook:</strong> A coin from 1,000 years ago — how did it get here?" },
      { time: "5–18 min", text: "<strong>Map exploration + direct teaching.</strong>" },
      { time: "18–30 min", text: "<strong>Group activity:</strong> Trace a route, identify goods." },
      { time: "30–40 min", text: "<strong>Discussion:</strong> Connections to modern UAE." },
      { time: "40–45 min", text: "<strong>Exit ticket.</strong>" },
    ],
    slides: [
      "A coin and a question",
      "Where is the Arabian Peninsula?",
      "The land routes",
      "The sea routes",
      "Goods that traveled",
      "Cultures that mixed",
      "From dhows to skyscrapers",
      "Your turn",
      "Exit ticket",
    ],
    worksheet: "Tier 1: label major routes on a provided map. Tier 2: write a short paragraph connecting one historical route to a modern UAE city or industry.",
    quiz: "1. Name two trade routes.  2. Name one good that came from China.  3. Why was the Peninsula's location strategic?  4. What's a dhow?  5. How does trade today resemble trade then?",
    homework: "Find one item in your house that came from a faraway country. Write a short story imagining its journey to you.",
  },
  Art: {
    objectives: [
      "Use primary colors to create secondary colors through mixing.",
      "Apply color theory to a small artwork.",
      "Reflect on the mood different colors create.",
    ],
    materials: "Tempera paints, brushes, paper, mixing palettes, smocks.",
    differentiation: "Support: pre-mixed colors with labels. Extension: students explore tertiary colors and warm/cool families.",
    standards: "UAE MOE Art Framework, Color Theory unit.",
    timeline: [
      { time: "0–5 min", text: "<strong>Hook:</strong> Show two paintings — one warm, one cool. How do they make you feel?" },
      { time: "5–15 min", text: "<strong>Direct demo:</strong> Mixing primaries to make secondaries." },
      { time: "15–35 min", text: "<strong>Studio time:</strong> Students create their own color wheel." },
      { time: "35–43 min", text: "<strong>Gallery walk + reflection.</strong>" },
      { time: "43–45 min", text: "<strong>Cleanup + exit ticket.</strong>" },
    ],
    slides: [
      "Color and feeling",
      "The three primaries",
      "Watch this happen",
      "Your turn",
      "Studio rules",
      "Tips for clean mixing",
      "Gallery walk",
      "Reflection",
      "Cleanup",
    ],
    worksheet: "Tier 1: complete a color-wheel template. Tier 2: design a small painting using only warm or only cool colors and write a sentence about its mood.",
    quiz: "1. Name the primary colors.  2. Red + yellow = ?  3. Blue + yellow = ?  4. Name one warm color.  5. What mood do cool colors create?",
    homework: "Find three things at home in primary colors. Sketch them and label each color.",
  },
};

const libLessons = [
  { tag: "G6 · Science", title: "Photosynthesis: how leaves make food from sunlight", meta: "45 min · UAE MOE", rating: "4.9 · 412 used" },
  { tag: "KG 2 · Arabic", title: "الحروف الهجائية: الألف، الباء، التاء", meta: "30 min · KHDA", rating: "5.0 · 287 used" },
  { tag: "G11 · Maths", title: "Introduction to differential calculus from first principles", meta: "60 min · IB DP SL", rating: "4.8 · 198 used" },
  { tag: "G3 · English", title: "Reading comprehension: inferring character feelings", meta: "45 min · Cambridge", rating: "4.9 · 356 used" },
  { tag: "G8 · History", title: "The trade routes of the Arabian Peninsula", meta: "50 min · UAE MOE", rating: "4.7 · 142 used" },
  { tag: "G10 · Chem", title: "Balancing chemical equations: a structured approach", meta: "45 min · Cambridge IGCSE", rating: "4.9 · 223 used" },
  { tag: "G1 · Maths", title: "Counting and grouping with manipulatives", meta: "30 min · UAE MOE", rating: "4.8 · 189 used" },
  { tag: "G9 · Bio", title: "Cells: the building blocks of all living things", meta: "50 min · IB MYP", rating: "4.9 · 267 used" },
  { tag: "G4 · Islamic", title: "The five pillars of Islam: an introduction", meta: "45 min · UAE MOE", rating: "5.0 · 401 used" },
];

const STEP_LABELS = [
  "Aligning to curriculum standards",
  "Drafting learning objectives",
  "Building the slide deck",
  "Composing worksheets & quiz",
  "Finalizing your package",
];

export default function LandingDemo() {
  const [mainTab, setMainTab] = useState("generate");
  const [mode, setMode] = useState("input");
  const [stepsDone, setStepsDone] = useState([false, false, false, false, false]);
  const [resultTab, setResultTab] = useState("plan");
  const [form, setForm] = useState({
    topic: "Photosynthesis",
    grade: "Grade 6",
    subject: "Science",
    duration: "45 minutes",
    curriculum: "UAE MOE",
  });
  const [result, setResult] = useState(null);
  const timersRef = useRef([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const updateForm = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleGenerate = () => {
    setMode("generating");
    setStepsDone([false, false, false, false, false]);

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    [0, 1, 2, 3, 4].forEach((i) => {
      const t = setTimeout(() => {
        setStepsDone((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, (i + 1) * 600);
      timersRef.current.push(t);
    });

    const finalT = setTimeout(() => {
      const tpl = lessonTemplates[form.subject] || lessonTemplates.Science;
      setResult({
        title:
          form.topic.charAt(0).toUpperCase() +
          form.topic.slice(1) +
          " — a " +
          form.grade +
          " " +
          form.subject.toLowerCase() +
          " lesson",
        meta: [`${form.grade} · ${form.subject}`, form.duration, form.curriculum],
        tpl,
      });
      setResultTab("plan");
      setMode("result");
    }, 3500);
    timersRef.current.push(finalT);
  };

  const handleReset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStepsDone([false, false, false, false, false]);
    setResult(null);
    setResultTab("plan");
    setMode("input");
  };

  return (
    <div className="live-demo">
      <div className="demo-tabs">
        <button
          className={`demo-tab ${mainTab === "generate" ? "active" : ""}`}
          onClick={() => setMainTab("generate")}
        >
          ⚡ Generate
        </button>
        <button
          className={`demo-tab ${mainTab === "library" ? "active" : ""}`}
          onClick={() => setMainTab("library")}
        >
          ⊏ Library
        </button>
      </div>
      <div className="demo-body">
        {mainTab === "generate" && (
          <div className="demo-pane active">
            {mode === "input" && (
              <div className="demo-input-view">
                <div className="demo-input-area">
                  <label>What are you teaching?</label>
                  <input
                    type="text"
                    value={form.topic}
                    onChange={updateForm("topic")}
                    placeholder="e.g. Photosynthesis, multiplication, Arabic letters…"
                  />
                </div>
                <div className="demo-row">
                  <div className="demo-input-area">
                    <label>Grade level</label>
                    <select value={form.grade} onChange={updateForm("grade")}>
                      {["KG 1","KG 2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"].map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="demo-input-area">
                    <label>Subject</label>
                    <select value={form.subject} onChange={updateForm("subject")}>
                      {["Science","Mathematics","English","Arabic","Islamic Studies","Social Studies","Art"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="demo-row">
                  <div className="demo-input-area">
                    <label>Duration</label>
                    <select value={form.duration} onChange={updateForm("duration")}>
                      {["30 minutes","45 minutes","60 minutes","90 minutes"].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="demo-input-area">
                    <label>Curriculum</label>
                    <select value={form.curriculum} onChange={updateForm("curriculum")}>
                      {["UAE MOE","KHDA International","Cambridge","IB MYP/DP","US Common Core","British National"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="demo-go" onClick={handleGenerate}>
                  ◈  Generate complete lesson package
                </button>
              </div>
            )}

            {mode === "generating" && (
              <div className="generating active">
                <div className="gen-spinner"></div>
                <div className="gen-text">Mudir is composing your lesson…</div>
                <div className="gen-step-list">
                  {STEP_LABELS.map((label, i) => (
                    <div key={i} className={`gen-step-item ${stepsDone[i] ? "done" : ""}`}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === "result" && result && (
              <div className="demo-result active">
                <div className="result-header">
                  <div>
                    <div className="result-title">{result.title}</div>
                    <div className="result-meta">
                      {result.meta.map((m, i) => (
                        <span key={i} className="meta-pill">{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="result-actions">
                    <button className="action-btn" onClick={handleReset}>↺ New</button>
                    <button className="action-btn">⬇ Export</button>
                    <button className="action-btn">★ Save</button>
                  </div>
                </div>

                <div className="result-tabs">
                  {[
                    { key: "plan", label: "Lesson Plan" },
                    { key: "timeline", label: "Timeline" },
                    { key: "slides", label: "Slides" },
                    { key: "materials", label: "Materials" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      className={`result-tab ${resultTab === t.key ? "active" : ""}`}
                      onClick={() => setResultTab(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="result-content">
                  {resultTab === "plan" && (
                    <div className="result-section active">
                      <div className="lp-block">
                        <div className="lp-label">Learning Objectives</div>
                        <div className="lp-content">
                          <ul>
                            {result.tpl.objectives.map((o, i) => <li key={i}>{o}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="lp-block">
                        <div className="lp-label">Materials Needed</div>
                        <div className="lp-content">{result.tpl.materials}</div>
                      </div>
                      <div className="lp-block">
                        <div className="lp-label">Differentiation</div>
                        <div className="lp-content">{result.tpl.differentiation}</div>
                      </div>
                      <div className="lp-block">
                        <div className="lp-label">Standards Alignment</div>
                        <div className="lp-content">{result.tpl.standards}</div>
                      </div>
                    </div>
                  )}

                  {resultTab === "timeline" && (
                    <div className="result-section active">
                      {result.tpl.timeline.map((r, i) => (
                        <div key={i} className="timeline-row">
                          <div className="timeline-time">{r.time}</div>
                          <div className="timeline-content" dangerouslySetInnerHTML={{ __html: r.text }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {resultTab === "slides" && (
                    <div className="result-section active">
                      <div className="slide-strip">
                        {result.tpl.slides.map((s, i) => (
                          <div key={i} className="mini-slide">
                            <div className="slide-num">SLIDE {String(i + 1).padStart(2, "0")}</div>
                            <div className="slide-title">{s}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultTab === "materials" && (
                    <div className="result-section active">
                      <div className="lp-block">
                        <div className="lp-label">Worksheet (Two Levels)</div>
                        <div className="lp-content">{result.tpl.worksheet}</div>
                      </div>
                      <div className="lp-block">
                        <div className="lp-label">Exit Ticket Quiz</div>
                        <div className="lp-content">{result.tpl.quiz}</div>
                      </div>
                      <div className="lp-block">
                        <div className="lp-label">Homework</div>
                        <div className="lp-content">{result.tpl.homework}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === "library" && (
          <div className="demo-pane active">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 className="serif" style={{ fontSize: 26, fontWeight: 500 }}>Browse the library</h2>
              <input type="text" className="lib-search" placeholder="🔍  Search…" />
            </div>
            <div className="lib-filters" style={{ marginBottom: 20 }}>
              <span className="gen-pill selected">All</span>
              <span className="gen-pill">KG–G3</span>
              <span className="gen-pill">G4–G6</span>
              <span className="gen-pill">G7–G9</span>
              <span className="gen-pill">G10–G12</span>
            </div>
            <div className="demo-lib-grid">
              {libLessons.map((l, i) => (
                <div key={i} className="lib-card">
                  <span className="lib-tag">{l.tag}</span>
                  <div className="lib-title">{l.title}</div>
                  <div className="lib-meta">
                    <span>{l.meta}</span>
                    <span className="lib-rating">★ {l.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
