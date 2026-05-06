import React, { useEffect, useRef } from "react";
import "../landing.css";
import LandingDemo from "./LandingDemo";

const introPara = {
  fontSize: 17,
  lineHeight: 1.6,
  color: "var(--ink-soft)",
  marginBottom: 24,
};

const sectionLeadDark = {
  fontSize: 17,
  lineHeight: 1.6,
  color: "rgba(244,237,224,0.75)",
  maxWidth: 640,
  marginTop: 16,
};

const sectionLead = {
  fontSize: 17,
  color: "var(--ink-soft)",
  maxWidth: 640,
  marginTop: 16,
};

export default function Landing({ onOpenStudio }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = root.querySelectorAll("section");
    sections.forEach((s) => s.classList.add("reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const openStudio = (e) => {
    e?.preventDefault?.();
    onOpenStudio?.();
  };

  return (
    <div ref={rootRef} className="landing-root">
      <nav className="topnav">
        <div className="logo">Mudir</div>
        <div className="nav-links">
          <a href="#problem">Problem</a>
          <a href="#solution">Solution</a>
          <a href="#studio-map">Tools</a>
          <a href="#hub">Dashboard</a>
          <a href="#studio">Studio</a>
          <a href="#try">Try it</a>
          <a href="#" className="open-studio-btn" onClick={openStudio}>
            Lesson Planner →
          </a>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">For teachers, KG–G12 / UAE & beyond</span>
            <h1 className="hero-title">
              Lesson prep<br />
              in <em>thirty</em><br />
              seconds<span className="arabic-mark">.</span>
            </h1>
            <p className="hero-sub">
              Teachers spend <strong>10+ hours a week</strong> preparing lessons after school. Mudir is the AI lesson director that turns a topic into a complete teaching package — plan, slides, worksheet, quiz, homework — aligned to your curriculum. KG through Grade 12. English and Arabic.
            </p>
            <div className="hero-cta">
              <a href="#try" className="btn-primary">Try the prototype →</a>
              <a href="#problem" className="btn-ghost">See how it works</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="lesson-card c1">
              <div className="card-meta">Grade 6 · Science</div>
              <div className="card-title">Photosynthesis: How leaves eat sunlight</div>
              <div className="card-body">A 45-minute exploration with live demonstration, paired discussion, and exit ticket assessment.</div>
              <div className="card-tag">UAE MOE</div>
            </div>
            <div className="lesson-card c2">
              <div className="card-meta">KG 2 · Arabic</div>
              <div className="card-title">الحروف العربية: الألف والباء</div>
              <div className="card-body">نشاط حركي مع بطاقات الحروف وأغنية تعليمية للمساعدة في التذكر.</div>
            </div>
            <div className="lesson-card c3">
              <div className="card-meta">G11 · Maths · IB</div>
              <div className="card-title">Differential Calculus<br />— first principles</div>
              <div className="card-body">Limit definition, worked examples, paired problem-solving, formative assessment.</div>
              <div className="card-tag">IB DP · SL</div>
            </div>
            <div className="timer-badge">
              <div className="num">30s</div>
              <div className="lbl">to ready</div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="num"><em>10+</em>hrs</div>
              <div className="lbl">average teacher prep time per week</div>
            </div>
            <div className="stat">
              <div className="num"><em>30</em>sec</div>
              <div className="lbl">to generate a complete lesson package</div>
            </div>
            <div className="stat">
              <div className="num"><em>K–12</em></div>
              <div className="lbl">every grade, every subject covered</div>
            </div>
            <div className="stat">
              <div className="num"><em>2</em></div>
              <div className="lbl">languages: Arabic & English, side-by-side</div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem">
        <div className="container">
          <div className="problem-grid">
            <div>
              <span className="eyebrow">The problem</span>
              <h2 className="section-title">
                Teachers don't<br />have a <em>time</em> problem.<br />They have a <em>prep</em> problem.
              </h2>
              <p style={introPara}>
                The classroom is only the visible part. Behind every lesson is hours of unseen labor — researching content, building slides, writing worksheets, aligning to the curriculum, differentiating for different learners.
              </p>
              <p style={{ ...introPara, marginBottom: 0 }}>
                That work happens at night. On weekends. During what should be life. And next week, the cycle repeats.
              </p>
            </div>
            <div className="problem-stats">
              <div className="problem-stat-row">
                <div className="big-num">68%</div>
                <div className="desc">of teachers report unhealthy work-life balance, citing lesson prep as the top cause.</div>
              </div>
              <div className="problem-stat-row">
                <div className="big-num">12hr</div>
                <div className="desc">average weekly time on lesson planning, slide creation, and material design.</div>
              </div>
              <div className="problem-stat-row">
                <div className="big-num">44%</div>
                <div className="desc">of new teachers leave the profession within 5 years — burnout is the leading factor.</div>
              </div>
              <div className="quote-card" style={{ marginTop: 24 }}>
                <p>"I love teaching. I just don't love spending my Sundays building slide decks from scratch every single week."</p>
                <div className="author">— Grade 4 teacher, Dubai</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="solution" id="solution">
        <div className="container">
          <span className="eyebrow">The solution</span>
          <h2 className="section-title">From topic to <em>taught</em>,<br />in four steps.</h2>
          <p style={sectionLeadDark}>
            Mudir is your lesson director. You bring the expertise and the students. Mudir handles the production work — the slides, the worksheets, the timing, the differentiation.
          </p>
          <div className="solution-flow">
            <div className="flow-step">
              <div className="step-num">01</div>
              <div className="step-title">Tell Mudir</div>
              <div className="step-body">Speak or type: grade, subject, topic, length. "Grade 6 science, photosynthesis, 45 minutes."</div>
              <div className="step-time">~ 10 sec</div>
            </div>
            <div className="flow-step">
              <div className="step-num">02</div>
              <div className="step-title">It generates</div>
              <div className="step-body">Complete lesson plan, slide deck, worksheet, exit-ticket quiz, homework — aligned to your curriculum.</div>
              <div className="step-time">~ 30 sec</div>
            </div>
            <div className="flow-step">
              <div className="step-num">03</div>
              <div className="step-title">You refine</div>
              <div className="step-body">Edit anything inline. Add your style. Adjust difficulty. Differentiate for advanced or struggling students.</div>
              <div className="step-time">~ 5 min</div>
            </div>
            <div className="flow-step">
              <div className="step-num">04</div>
              <div className="step-title">You teach</div>
              <div className="step-body">Export to PowerPoint, PDF, Google Classroom, or present from Mudir directly. Save to your library to reuse.</div>
              <div className="step-time">Ready</div>
            </div>
          </div>
        </div>
      </section>

      <section className="studio-map" id="studio-map">
        <div className="container">
          <span className="eyebrow">Inside Mudir</span>
          <h2 className="section-title">Eight tools.<br />One <em>studio</em>.</h2>
          <p style={sectionLead}>
            Mudir Studio is the home base for everything a teacher prepares. Each tool stands on its own — and they all share the same students, schedule, and curriculum context.
          </p>

          <div className="tools-hub">
            <div className="tools-hub-core">Mudir Studio</div>
            <div className="tools-hub-line"></div>
          </div>

          <div className="tools-grid">
            {[
              { glyph: "L", num: "01 / Plan", title: "Lesson Plans", body: "Generate, edit, and version full lesson plans with timing, objectives, and differentiation." },
              { glyph: "S", num: "02 / Schedule", title: "Scheduling", body: "Drag lessons onto your weekly timetable. Auto-detect conflicts and missing prep." },
              { glyph: "Q", num: "03 / Test", title: "Quizzes & Exams", body: "Quick exit tickets to summative exams. Auto-graded, with Bloom's-tagged questions." },
              { glyph: "H", num: "04 / Assign", title: "Homework", body: "Take-home tasks linked to today's lesson. Push to Google Classroom or print." },
              { glyph: "D", num: "05 / Track", title: "Student Data", body: "Roster, progress over time, learning gaps. Mudir flags who needs extra support." },
              { glyph: "B", num: "06 / Library", title: "Subjects", body: "Curriculum-aligned content libraries. UAE MOE, KHDA, Cambridge, IB — one place." },
              { glyph: "P", num: "07 / Present", title: "Presentations", body: "Slides built around your lesson plan. Editable, exportable, presentable from anywhere." },
              { glyph: "A", num: "08 / Engage", title: "Activities", body: "Hands-on, group, and extension activities matched to your topic and grade level." },
            ].map((t) => (
              <div key={t.title} className="tool-card">
                <div className="tool-glyph">{t.glyph}</div>
                <div className="tool-num">{t.num}</div>
                <h4>{t.title}</h4>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="hub">
        <div className="container">
          <span className="eyebrow">The teacher's hub</span>
          <h2 className="section-title">A home base,<br />not another <em>inbox</em>.</h2>
          <p style={sectionLead}>
            Open Mudir in the morning and the day is already laid out — today's classes, what's prepared, what's still pending. Everything one click away.
          </p>

          <div className="dash-mock">
            <aside className="dash-side">
              <div className="dash-logo">Mudir</div>

              <div className="dash-side-section">Workspace</div>
              <div className="dash-side-link active"><span className="dot-icon">◇</span> Dashboard</div>
              <div className="dash-side-link"><span className="dot-icon">+</span> Studio</div>
              <div className="dash-side-link"><span className="dot-icon">≡</span> Library</div>

              <div className="dash-side-section">Teaching</div>
              <div className="dash-side-link"><span className="dot-icon">L</span> Lesson Plans</div>
              <div className="dash-side-link"><span className="dot-icon">S</span> Schedule</div>
              <div className="dash-side-link"><span className="dot-icon">Q</span> Quizzes & Exams</div>
              <div className="dash-side-link"><span className="dot-icon">H</span> Homework</div>
              <div className="dash-side-link"><span className="dot-icon">P</span> Presentations</div>
              <div className="dash-side-link"><span className="dot-icon">A</span> Activities</div>

              <div className="dash-side-section">People</div>
              <div className="dash-side-link"><span className="dot-icon">St</span> Students</div>
              <div className="dash-side-link"><span className="dot-icon">Gr</span> Grades</div>

              <div className="dash-side-section">Account</div>
              <div className="dash-side-link"><span className="dot-icon">R</span> Reports</div>
              <div className="dash-side-link"><span className="dot-icon">⚙</span> Settings</div>

              <div className="dash-profile">
                <div className="dash-profile-avatar">س</div>
                <div>
                  <div className="dash-profile-name">Sara Al-Mansoori</div>
                  <div className="dash-profile-role">Science · G6–G9</div>
                </div>
              </div>
            </aside>

            <main className="dash-main">
              <div className="dash-topbar">
                <div className="dash-greeting">
                  <h2>Good morning, <em>Sara</em>.</h2>
                  <p>Tuesday · 4 classes today · 2 still need slides</p>
                </div>
                <input className="dash-search" placeholder="🔍  Search lessons, students…" />
              </div>

              <div className="dash-kpis">
                <div className="kpi">
                  <div className="kpi-label">This Week</div>
                  <div className="kpi-value"><em>12</em></div>
                  <div className="kpi-sub">lessons prepared</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Today</div>
                  <div className="kpi-value"><em>4</em></div>
                  <div className="kpi-sub">scheduled classes</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Pending</div>
                  <div className="kpi-value"><em>2</em></div>
                  <div className="kpi-sub">drafts to review</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Students</div>
                  <div className="kpi-value"><em>118</em></div>
                  <div className="kpi-sub">across 4 sections</div>
                </div>
              </div>

              <div className="dash-cols">
                <div>
                  <div className="dash-block">
                    <h3>Today's schedule <span className="more">View calendar →</span></h3>
                    {[
                      { time: "08:00", cls: "Photosynthesis · 6A", room: "Lab 2 · 28 students", pill: "Done", pillCls: "done" },
                      { time: "10:15", cls: "Cell structure · 6B", room: "Room 304 · 30 students", pill: "Live now", pillCls: "live" },
                      { time: "12:30", cls: "Force & motion · 7A", room: "Lab 1 · 32 students", pill: "Next", pillCls: "next" },
                      { time: "14:00", cls: "Lab safety · 7B", room: "Lab 1 · 28 students · slides pending", pill: "3:00", pillCls: "next" },
                    ].map((r, i) => (
                      <div key={i} className="schedule-row">
                        <div className="schedule-time">{r.time}</div>
                        <div>
                          <div className="schedule-class">{r.cls}</div>
                          <div className="schedule-room">{r.room}</div>
                        </div>
                        <span className={`status-pill ${r.pillCls}`}>{r.pill}</span>
                      </div>
                    ))}
                  </div>

                  <div className="dash-block">
                    <h3>Quick actions</h3>
                    <div className="quick-grid">
                      {[
                        { i: "+", l: "New Lesson" },
                        { i: "Q", l: "Build Quiz" },
                        { i: "H", l: "Assign Homework" },
                        { i: "P", l: "New Slides" },
                      ].map((q, idx) => (
                        <div key={idx} className="quick-tile">
                          <div className="qicon">{q.i}</div>
                          <div className="qlabel">{q.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="dash-block">
                    <h3>Recent AI activity <span className="more">View all →</span></h3>
                    <div className="activity-row">
                      <div className="activity-dot"></div>
                      <div className="activity-text">Mudir drafted the <em>Cell structure</em> lesson — review when you're ready.</div>
                      <div className="activity-time">12m</div>
                    </div>
                    <div className="activity-row">
                      <div className="activity-dot"></div>
                      <div className="activity-text">Quiz "<em>Photosynthesis basics</em>" auto-graded. 26/28 passed.</div>
                      <div className="activity-time">1h</div>
                    </div>
                    <div className="activity-row">
                      <div className="activity-dot"></div>
                      <div className="activity-text">Suggested differentiation for 6B — 4 students may need extra scaffolding.</div>
                      <div className="activity-time">2h</div>
                    </div>
                    <div className="activity-row">
                      <div className="activity-dot"></div>
                      <div className="activity-text">Generated homework for <em>Force & motion</em>. Push to Google Classroom?</div>
                      <div className="activity-time">3h</div>
                    </div>
                  </div>

                  <div className="dash-block">
                    <h3>Pending review</h3>
                    <div className="activity-row">
                      <div className="activity-dot" style={{ background: "var(--gold)" }}></div>
                      <div className="activity-text">2 lesson drafts waiting</div>
                      <div className="activity-time">→</div>
                    </div>
                    <div className="activity-row">
                      <div className="activity-dot" style={{ background: "var(--gold)" }}></div>
                      <div className="activity-text">3 quizzes ready to send</div>
                      <div className="activity-time">→</div>
                    </div>
                    <div className="activity-row">
                      <div className="activity-dot" style={{ background: "var(--sage)" }}></div>
                      <div className="activity-text">Grades to publish · G6A photosynthesis</div>
                      <div className="activity-time">→</div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="container">
          <span className="eyebrow">In the studio</span>
          <h2 className="section-title">Mudir <em>drafts</em>.<br />You direct.</h2>
          <p style={sectionLead}>
            AI gets you 90% of the way there in 30 seconds. The last 10% is yours — your voice, your students, your judgment. Edit anything inline. Add what's missing. Strike what doesn't fit. <em style={{ color: "var(--accent)" }}>Hover the right side</em> to see edit controls.
          </p>

          <div className="studio-split">
            <div className="studio-pane ai">
              <div className="studio-pane-label">Mudir's draft <span className="badge">AI</span></div>
              <div className="studio-block">
                <div className="block-tag">Hook · 5 min</div>
                Show a wilted plant beside a thriving one. Ask students what makes the difference.
              </div>
              <div className="studio-block">
                <div className="block-tag">Direct teaching · 10 min</div>
                Walk through photosynthesis using slide deck and a leaf cross-section diagram. Reference chlorophyll and the role of sunlight.
              </div>
              <div className="studio-block">
                <div className="block-tag">Pair activity · 10 min</div>
                Students sketch the photosynthesis process on whiteboards. Teacher circulates.
              </div>
              <div className="studio-block">
                <div className="block-tag">Worksheet · 13 min</div>
                Differentiated worksheet — Tier 1 labels diagram, Tier 2 explains in 3–4 sentences.
              </div>
              <div className="studio-block">
                <div className="block-tag">Exit ticket · 7 min</div>
                5-question quick check + introduce homework.
              </div>
            </div>

            <div className="studio-pane you">
              <div className="studio-pane-label">Your version <span className="badge">YOU</span></div>
              <div className="studio-block edited">
                <div className="block-tag">Hook · 5 min</div>
                Show <span className="studio-highlight">the bean plants the class grew last week</span> beside a wilted one. Ask students what makes the difference.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-block">
                <div className="block-tag">Direct teaching · 10 min</div>
                Walk through photosynthesis using slide deck and a leaf cross-section diagram. Reference chlorophyll and the role of sunlight.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-block added">
                <div className="block-tag">Live demo · 5 min <span className="block-badge">Added</span></div>
                Hold a leaf to the projector light to show the veins. Students predict where sugar gets stored.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-block edited">
                <div className="block-tag">Pair activity · <span className="studio-strikethrough">10</span> 8 min</div>
                Students sketch the photosynthesis process on whiteboards. Teacher circulates.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-block">
                <div className="block-tag">Worksheet · 13 min</div>
                Differentiated worksheet — Tier 1 labels diagram, Tier 2 explains in 3–4 sentences.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-block">
                <div className="block-tag">Exit ticket · 7 min</div>
                5-question quick check + introduce homework.
                <div className="edit-controls">
                  <button className="edit-btn" title="Edit">✎</button>
                  <button className="edit-btn" title="Delete">✕</button>
                </div>
              </div>
              <div className="studio-add">+ Add another step</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="screens">
        <div className="container">
          <span className="eyebrow">Static screens</span>
          <h2 className="section-title">What it <em>looks</em> like.</h2>
          <p style={{ fontSize: 17, color: "var(--ink-soft)", maxWidth: 600, marginTop: 16 }}>
            Two flagship screens — the AI Generator and the Lesson Library — built for the way teachers actually think.
          </p>

          <div style={{ marginTop: 60 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>SCREEN 01</span>
              <h3 className="serif" style={{ fontSize: 28, fontWeight: 500 }}>The AI Generator</h3>
            </div>
            <p style={{ color: "var(--ink-soft)", maxWidth: 700 }}>A focused, single-purpose canvas. Type or speak the lesson context, hit generate, get a complete teaching package in 30 seconds.</p>

            <div className="screen-mockup">
              <div className="mock-toolbar">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <div className="url">mudir.app/generate</div>
              </div>
              <div className="generator-screen">
                <aside className="gen-sidebar">
                  <div className="side-logo">Mudir</div>
                  <div className="side-section">Workspace</div>
                  <div className="side-link active">+ New Lesson</div>
                  <div className="side-link">My Library</div>
                  <div className="side-link">Shared with me</div>
                  <div className="side-section">Curricula</div>
                  <div className="side-link">UAE MOE</div>
                  <div className="side-link">KHDA</div>
                  <div className="side-link">Cambridge</div>
                  <div className="side-link">IB MYP/DP</div>
                  <div className="side-link">US Common Core</div>
                  <div className="side-section">Account</div>
                  <div className="side-link">Ms. Sara A.</div>
                </aside>
                <main className="gen-main">
                  <h1>Let's build your <em>next lesson</em>.</h1>
                  <p className="gen-sub">Tell me the basics. I'll handle the rest.</p>

                  <div className="input-block">
                    <label>Topic</label>
                    <input type="text" className="text-input" defaultValue="Photosynthesis — how leaves make food from sunlight" readOnly />
                  </div>

                  <div className="gen-grid">
                    <div className="input-block">
                      <label>Grade level</label>
                      <div className="gen-pills">
                        <span className="gen-pill">KG</span>
                        <span className="gen-pill">G1-3</span>
                        <span className="gen-pill">G4-5</span>
                        <span className="gen-pill selected">Grade 6</span>
                        <span className="gen-pill">G7-9</span>
                        <span className="gen-pill">G10-12</span>
                      </div>
                    </div>
                    <div className="input-block">
                      <label>Duration</label>
                      <div className="gen-pills">
                        <span className="gen-pill">30m</span>
                        <span className="gen-pill selected">45m</span>
                        <span className="gen-pill">60m</span>
                        <span className="gen-pill">90m</span>
                      </div>
                    </div>
                  </div>

                  <div className="gen-grid">
                    <div className="input-block">
                      <label>Curriculum</label>
                      <div className="gen-pills">
                        <span className="gen-pill selected">UAE MOE</span>
                        <span className="gen-pill">Cambridge</span>
                        <span className="gen-pill">IB</span>
                      </div>
                    </div>
                    <div className="input-block">
                      <label>Language</label>
                      <div className="gen-pills">
                        <span className="gen-pill selected">English</span>
                        <span className="gen-pill">العربية</span>
                        <span className="gen-pill">Bilingual</span>
                      </div>
                    </div>
                  </div>

                  <button className="generate-btn">◈  Generate complete lesson package</button>
                </main>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 80 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>SCREEN 02</span>
              <h3 className="serif" style={{ fontSize: 28, fontWeight: 500 }}>The Lesson Library</h3>
            </div>
            <p style={{ color: "var(--ink-soft)", maxWidth: 700 }}>Browse thousands of teacher-tested lessons. Filter by grade, subject, curriculum. Remix any lesson into your own.</p>

            <div className="screen-mockup">
              <div className="mock-toolbar">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <div className="url">mudir.app/library</div>
              </div>
              <div className="library-screen">
                <div className="library-header">
                  <div>
                    <h2 className="serif" style={{ fontSize: 28, fontWeight: 500 }}>Library</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>2,847 lessons · curated by educators</p>
                  </div>
                  <input type="text" className="lib-search" placeholder="🔍  Search lessons, topics, standards…" readOnly />
                </div>
                <div className="lib-filters" style={{ marginBottom: 24 }}>
                  <span className="gen-pill selected">All grades</span>
                  <span className="gen-pill">Science</span>
                  <span className="gen-pill">Maths</span>
                  <span className="gen-pill">English</span>
                  <span className="gen-pill">Arabic</span>
                  <span className="gen-pill">Islamic Studies</span>
                  <span className="gen-pill">Social Studies</span>
                </div>
                <div className="lib-grid">
                  {[
                    { tag: "G6 · Science", title: "Photosynthesis: how leaves make food from sunlight", meta: "45 min · UAE MOE", rating: "4.9 · 412 used" },
                    { tag: "KG 2 · Arabic", title: "الحروف الهجائية: الألف، الباء، التاء", meta: "30 min · KHDA", rating: "5.0 · 287 used" },
                    { tag: "G11 · Maths", title: "Introduction to differential calculus", meta: "60 min · IB DP SL", rating: "4.8 · 198 used" },
                    { tag: "G3 · English", title: "Reading comprehension: inferring character feelings", meta: "45 min · Cambridge", rating: "4.9 · 356 used" },
                    { tag: "G8 · History", title: "The trade routes of the Arabian Peninsula", meta: "50 min · UAE MOE", rating: "4.7 · 142 used" },
                    { tag: "G10 · Chem", title: "Balancing chemical equations: a structured approach", meta: "45 min · Cambridge IGCSE", rating: "4.9 · 223 used" },
                  ].map((l, i) => (
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
            </div>
          </div>

          <div style={{ marginTop: 100 }}>
            <span className="eyebrow">What's included</span>
            <h3 className="serif" style={{ fontSize: 36, fontWeight: 500, marginTop: 16 }}>
              A complete teaching <em style={{ color: "var(--accent)", fontStyle: "italic" }}>package</em>, every time.
            </h3>
          </div>
          <div className="feature-grid">
            {[
              { icon: "i", title: "Lesson Plan", body: "Structured timing, clear learning objectives, anticipated questions, differentiation strategies for mixed levels." },
              { icon: "ii", title: "Slide Deck", body: "Visually consistent, age-appropriate slides. Editable in Mudir or exported to PowerPoint and Google Slides." },
              { icon: "iii", title: "Worksheet", body: "Two difficulty tiers per worksheet — for advanced learners and those who need extra support." },
              { icon: "iv", title: "Exit Ticket", body: "A 5-question formative quiz to check understanding before students leave the room." },
              { icon: "v", title: "Homework", body: "A take-home extension that builds on the lesson without overwhelming. Auto-graded options available." },
              { icon: "vi", title: "Bilingual Mode", body: "Arabic ↔ English side-by-side rendering. Perfect for UAE classrooms with mixed-language learners." },
            ].map((f) => (
              <div key={f.title} className="feature">
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="interactive" id="try">
        <div className="container">
          <span className="eyebrow">Live prototype · click around</span>
          <h2 className="section-title">Try it <em>yourself</em>.</h2>
          <p style={{ fontSize: 17, color: "var(--ink-soft)", maxWidth: 600, marginTop: 16 }}>
            A working prototype of the core experience. Pick a topic, hit generate, and watch a complete lesson package come together in seconds. When you're ready for the real teacher workspace,{" "}
            <a href="#" onClick={openStudio} style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)", textDecoration: "none" }}>
              open the lesson planner
            </a>
            .
          </p>

          <LandingDemo />
        </div>
      </section>

      <footer>
        <div className="arabic-tag">المُدير</div>
        <div className="logo-big">Mudir</div>
        <p className="tagline">The lesson director, in your pocket.</p>
        <p style={{ fontSize: 14, color: "var(--paper)", maxWidth: 420, margin: "0 auto" }}>
          Built for teachers who'd rather spend evenings teaching their own kids — not preparing for someone else's.
        </p>
        <p className="credit">Mockup · KG–Grade 12 · UAE & International</p>
      </footer>
    </div>
  );
}
