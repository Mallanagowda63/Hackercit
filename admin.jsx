const { useEffect, useMemo, useState } = React;
const API_HOST = window.location.hostname || "127.0.0.1";
const LOCAL_API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const LOCAL_BACKEND_API_BASE = `${LOCAL_API_PROTOCOL}//${API_HOST}:4000`;
const CONFIGURED_BACKEND_API_BASE_RAW = (
  window.__CODEARENA_CONFIG__?.backendApiBase ||
  document.querySelector('meta[name="codearena-backend-api-base"]')?.content ||
  ""
).trim();
const IS_LOCAL_FRONTEND = API_HOST === "127.0.0.1" || API_HOST === "localhost";
const USES_SAME_ORIGIN_BACKEND = CONFIGURED_BACKEND_API_BASE_RAW.toLowerCase() === "same-origin";
const CONFIGURED_BACKEND_API_BASE = USES_SAME_ORIGIN_BACKEND
  ? ""
  : CONFIGURED_BACKEND_API_BASE_RAW.replace(/\/+$/, "");
const BACKEND_API_BASE = CONFIGURED_BACKEND_API_BASE_RAW
  ? CONFIGURED_BACKEND_API_BASE
  : (IS_LOCAL_FRONTEND ? LOCAL_BACKEND_API_BASE : null);
const BACKEND_API_CONFIGURATION_ERROR = 'Backend API is not configured for this deployment. Set <meta name="codearena-backend-api-base" content="https://your-backend.example.com"> in index.html, or use content="same-origin" only when this host proxies /api requests to your backend.';

function buildBackendApiUrl(path) {
  if (!BACKEND_API_BASE && BACKEND_API_BASE !== "") {
    throw new Error(BACKEND_API_CONFIGURATION_ERROR);
  }

  return `${BACKEND_API_BASE}${path}`;
}

function AdminPortal({
  problems = [],
  onSignOut = () => {},
  onGoHome = () => {},
}) {
  const THEME = {
    "--bg": "#F9FAFB",
    "--card": "#FFFFFF",
    "--border": "#E5E7EB",
    "--hover-bg": "#F3F4F6",
    "--primary": "#2563EB",
    "--primary-hover": "#1D4ED8",
    "--primary-light": "#DBEAFE",
    "--secondary": "#7C3AED",
    "--secondary-hover": "#6D28D9",
    "--text": "#111827",
    "--text-secondary": "#4B5563",
    "--text-muted": "#9CA3AF",
    "--success": "#16A34A",
    "--warning": "#D97706",
    "--error": "#DC2626",
    "--info": "#2563EB",
    "--sidebar-bg": "#FFFFFF",
    "--sidebar-active": "#DBEAFE",
    "--btn-secondary": "#F3F4F6",
    "--divider": "#E5E7EB",
    "--shadow-soft": "0 1px 3px rgba(0,0,0,0.05)",
    "--shadow-hover": "0 10px 25px rgba(0,0,0,0.05)",
  };

  const defaultTest = {
    title: "Current Test",
    level: "Hard",
    date: "23/03/2026",
    duration: 60,
    questions: problems.length ? [problems[0].id] : [],
  };

  const defaultPreviousTests = [
    { id: "t-2203", name: "Algorithm Sprint 1", date: "22/03/2026", difficulty: "Medium", winner: "Aarav", average: 82 },
    { id: "t-2103", name: "Campus Mock Round", date: "21/03/2026", difficulty: "Hard", winner: "Diya", average: 76 },
    { id: "t-1903", name: "Data Structures Drill", date: "19/03/2026", difficulty: "Easy", winner: "Nikhil", average: 91 },
  ];

  const defaultLeaderboard = [
    { rank: 1, username: "Aarav", score: 98, timeTaken: "41m 12s" },
    { rank: 2, username: "Diya", score: 95, timeTaken: "44m 08s" },
    { rank: 3, username: "Karthik", score: 91, timeTaken: "47m 20s" },
    { rank: 4, username: "Meera", score: 88, timeTaken: "49m 03s" },
    { rank: 5, username: "Rohan", score: 84, timeTaken: "53m 44s" },
  ];

  const defaultActiveUsers = [
    { name: "Aarav", department: "CSE", status: "Solving" },
    { name: "Diya", department: "ISE", status: "Running tests" },
    { name: "Meera", department: "AIML", status: "Reviewing" },
    { name: "Rohan", department: "ECE", status: "Submitted" },
  ];

  const [currentTest, setCurrentTest] = useState(defaultTest);
  const [previousTests, setPreviousTests] = useState(defaultPreviousTests);
  const [selectedPreviousTest, setSelectedPreviousTest] = useState(defaultPreviousTests[0]);
  const [leaderboard] = useState(defaultLeaderboard);
  const [activeUsers, setActiveUsers] = useState(defaultActiveUsers);
  const [participantsCount, setParticipantsCount] = useState(defaultActiveUsers.length);
  const [timerSeconds, setTimerSeconds] = useState(defaultTest.duration * 60);
  const [warning, setWarning] = useState("");
  const [solutionsVisible, setSolutionsVisible] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "Fresh Challenge",
    level: "Hard",
    date: "24/03/2026",
    duration: "60",
    questions: defaultTest.questions.join(","),
  });
  const [submissionProblemId, setSubmissionProblemId] = useState(defaultTest.questions[0] || "");
  const [submissionLang, setSubmissionLang] = useState("javascript");
  const [submissionCode, setSubmissionCode] = useState("");
  const [execution, setExecution] = useState(null);
  const [executing, setExecuting] = useState(false);

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.id === Number(submissionProblemId)) || problems[0] || null,
    [problems, submissionProblemId],
  );

  useEffect(() => {
    if (!selectedProblem) return;
    setSubmissionCode(selectedProblem.starterCode?.[submissionLang] || "");
  }, [selectedProblem, submissionLang]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setTimerSeconds((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    const liveParticipants = setInterval(() => {
      setParticipantsCount((prev) => Math.max(1, Math.min(50, prev + (Math.random() > 0.5 ? 1 : -1))));
      setActiveUsers((prev) =>
        prev.map((user, index) => {
          const statuses = ["Solving", "Running tests", "Reviewing", "Submitted"];
          return {
            ...user,
            status: statuses[(index + Math.floor(Date.now() / 4000)) % statuses.length],
          };
        }),
      );
    }, 4000);

    const handleVisibility = () => {
      if (document.hidden) {
        setWarning("Warning: tab switching detected while the test dashboard is active.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(countdown);
      clearInterval(liveParticipants);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (timerSeconds !== 0 || !submissionCode.trim() || executing || execution?.autoSubmitted) return;
    handleRun(true);
  }, [timerSeconds]);

  function formatCountdown(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function handleCreateInput(field, value) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCreateTest() {
    const questionIds = createForm.questions
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && problems.some((problem) => problem.id === value));

    const duration = Math.max(1, Number(createForm.duration) || 60);
    const nextTest = {
      title: createForm.title.trim() || "Fresh Challenge",
      level: createForm.level,
      date: createForm.date.trim() || "24/03/2026",
      duration,
      questions: questionIds.length ? questionIds : (problems[0] ? [problems[0].id] : []),
    };

    setCurrentTest(nextTest);
    setTimerSeconds(duration * 60);
    setSubmissionProblemId(nextTest.questions[0] || "");
    setSolutionsVisible(false);
    setPreviousTests((prev) => [
      {
        id: `t-${Date.now()}`,
        name: nextTest.title,
        date: nextTest.date,
        difficulty: nextTest.level,
        winner: "-",
        average: 0,
      },
      ...prev,
    ]);
  }

  async function handleRun(autoSubmitted = false) {
    if (!selectedProblem) return;

    setExecuting(true);
    setExecution(null);

    try {
      const response = await fetch(buildBackendApiUrl("/api/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: submissionLang,
          sourceCode: submissionCode,
          fnName: selectedProblem.fnName,
          testCases: selectedProblem.testCases,
        }),
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim();
        throw new Error(
          snippet.startsWith("<")
            ? "Expected JSON from the configured backend API, but received HTML. Check the deployed backend URL."
            : `Backend returned invalid JSON.${snippet ? ` Response started with: ${snippet}` : ""}`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Execution failed.");
      }

      setExecution({
        tests: data.tests || [],
        runtime: data.runtime || "N/A",
        status: data.status || "failed",
        autoSubmitted,
      });
    } catch (error) {
      setExecution({
        tests: selectedProblem.testCases.map((tc, index) => ({
          ...tc,
          actual: null,
          status: "error",
          error: `Case ${index + 1}: ${error.message}`,
        })),
        runtime: "N/A",
        status: "failed",
        autoSubmitted,
      });
    } finally {
      setExecuting(false);
    }
  }

  const currentTestEnded = timerSeconds === 0;

  const S = {
    app: {
      ...THEME,
      fontFamily: "'Outfit','Space Grotesk',sans-serif",
      background: "var(--bg)",
      color: "var(--text)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    },
    nav: {
      background: "var(--card)",
      borderBottom: "1px solid var(--divider)",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      height: 56,
      gap: 24,
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    logo: {
      fontFamily: "'Space Grotesk',sans-serif",
      fontWeight: 800,
      fontSize: 20,
      color: "var(--text)",
      cursor: "pointer",
      letterSpacing: "-0.5px",
    },
    btn: (v) => ({
      padding: "8px 18px",
      borderRadius: 6,
      border: "1px solid var(--border)",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 12.5,
      fontFamily: "'Space Grotesk',sans-serif",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      transition: "all 0.15s",
      ...(v === "run"
        ? { background: "var(--success)", color: "#fff", border: "1px solid var(--success)" }
        : v === "submit"
          ? { background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" }
          : { background: "var(--btn-secondary)", color: "var(--text)", border: "1px solid var(--border)" }),
    }),
    fieldLabel: { display: "block", marginBottom: 8, color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Space Grotesk',sans-serif" },
    input: { width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 12, padding: "13px 14px", fontSize: 14, outline: "none", fontFamily: "'Outfit','Space Grotesk',sans-serif" },
    shell: { maxWidth: 1240, margin: "0 auto", width: "100%", padding: "28px 24px 40px", display: "grid", gap: 22 },
    cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
    card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 18px 20px", boxShadow: "var(--shadow-soft)" },
    sectionTitle: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 },
    tableWrap: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", boxShadow: "var(--shadow-soft)" },
    tableHead: { padding: "14px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Space Grotesk',sans-serif" },
    tableCell: { padding: "14px 16px", borderTop: "1px solid var(--divider)", fontSize: 14, color: "var(--text)" },
    subCard: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px" },
  };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      <nav style={S.nav}>
        <span style={S.logo} onClick={onGoHome}>{"</> CodeArena"}</span>
        <span style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: "0.03em" }}>Test Assignment Leaderboard</span>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={onSignOut} style={S.btn("default")}>Sign Out</button>
        </div>
      </nav>

      <div style={S.shell}>
        {warning && (
          <div style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.35)", color: "var(--warning)", borderRadius: 14, padding: "12px 14px", fontSize: 13 }}>
            {warning}
          </div>
        )}

        <div style={S.cardGrid}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Current Test</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>{currentTest.title}</div>
            <div style={{ display: "grid", gap: 8, color: "var(--text-secondary)", fontSize: 14 }}>
              <div>Level: <span style={{ color: "var(--secondary)", fontWeight: 700 }}>{currentTest.level}</span></div>
              <div>Date: <span style={{ color: "var(--text)" }}>{currentTest.date}</span></div>
              <div>Duration: <span style={{ color: "var(--text)" }}>{currentTest.duration} mins</span></div>
              <div>Timer: <span style={{ color: currentTestEnded ? "var(--error)" : "var(--success)", fontWeight: 700 }}>{formatCountdown(timerSeconds)}</span></div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Previous Tests</div>
            <div style={{ display: "grid", gap: 10 }}>
              {previousTests.slice(0, 4).map((test) => (
                <button
                  key={test.id}
                  onClick={() => setSelectedPreviousTest(test)}
                  style={{
                    background: selectedPreviousTest?.id === test.id ? "var(--primary-light)" : "var(--card)",
                    border: selectedPreviousTest?.id === test.id ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--text)",
                    padding: "12px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{test.name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{test.date} • {test.difficulty}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Participants</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)", lineHeight: 1, marginBottom: 10 }}>{participantsCount}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}>Users currently taking the test</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.25)", color: "var(--success)", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
              Live Count
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Solutions</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 14 }}>Submitted solutions become viewable after the timer ends.</div>
            <button
              onClick={() => setSolutionsVisible((prev) => !prev)}
              disabled={!currentTestEnded}
              style={{
                ...S.btn("default"),
                color: currentTestEnded ? "var(--secondary)" : "var(--text-muted)",
                border: currentTestEnded ? "1px solid var(--secondary)" : "1px solid var(--border)",
                background: currentTestEnded ? "var(--primary-light)" : "var(--btn-secondary)",
                opacity: currentTestEnded ? 1 : 0.7,
              }}
            >
              View Solutions
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
          <div style={S.tableWrap}>
            <div style={{ padding: "18px 18px 10px" }}>
              <div style={S.sectionTitle}>Leaderboard</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Rank", "Username", "Score", "Time Taken"].map((heading) => (
                    <th key={heading} style={S.tableHead}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.rank}>
                    <td style={S.tableCell}>{entry.rank}</td>
                    <td style={S.tableCell}>{entry.username}</td>
                    <td style={{ ...S.tableCell, color: "var(--success)", fontWeight: 700 }}>{entry.score}</td>
                    <td style={S.tableCell}>{entry.timeTaken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}>Previous Test Result</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{selectedPreviousTest?.name}</div>
              <div style={{ display: "grid", gap: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                <div>Date: <span style={{ color: "var(--text)" }}>{selectedPreviousTest?.date}</span></div>
                <div>Difficulty: <span style={{ color: "var(--secondary)" }}>{selectedPreviousTest?.difficulty}</span></div>
                <div>Winner: <span style={{ color: "var(--primary)" }}>{selectedPreviousTest?.winner}</span></div>
                <div>Average Score: <span style={{ color: "var(--text)" }}>{selectedPreviousTest?.average}</span></div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sectionTitle}>Monitor Active Users</div>
              <div style={{ display: "grid", gap: 10 }}>
                {activeUsers.map((user) => (
                  <div key={user.name} style={{ ...S.subCard, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "var(--text)", fontWeight: 700 }}>{user.name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{user.department}</div>
                    </div>
                    <div style={{ color: user.status === "Submitted" ? "var(--success)" : "var(--warning)", fontSize: 12, fontWeight: 700 }}>{user.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Code Submission</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.fieldLabel}>Question</label>
                  <select value={submissionProblemId} onChange={(e) => setSubmissionProblemId(Number(e.target.value))} style={S.input}>
                    {currentTest.questions.map((id) => {
                      const problem = problems.find((item) => item.id === id);
                      return <option key={id} value={id}>{problem ? `${problem.id}. ${problem.title}` : id}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={S.fieldLabel}>Language</label>
                  <select value={submissionLang} onChange={(e) => setSubmissionLang(e.target.value)} style={S.input}>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                  </select>
                </div>
              </div>

              <div style={{ ...S.subCard, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--divider)", color: "var(--text-muted)", fontSize: 12 }}>
                  Write solution for {selectedProblem ? selectedProblem.title : "selected problem"}
                </div>
                <textarea
                  value={submissionCode}
                  onChange={(e) => setSubmissionCode(e.target.value)}
                  spellCheck={false}
                  style={{ width: "100%", minHeight: 240, background: "var(--card)", color: "var(--text)", border: "none", outline: "none", resize: "vertical", padding: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.7, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => handleRun(false)} disabled={executing || !selectedProblem} style={S.btn("run")}>
                  {executing ? "Running..." : "Run Code"}
                </button>
                <div style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>
                  Uses the current `/api/run` backend, now backed by Judge0 for hosted execution.
                </div>
              </div>

              {execution && (
                <div style={S.subCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                    <div style={{ color: execution.status === "passed" ? "var(--success)" : "var(--error)", fontWeight: 700 }}>
                      {execution.autoSubmitted ? "Auto-submitted" : "Execution Result"}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Runtime: {execution.runtime}</div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {execution.tests.map((test, index) => (
                      <div key={index} style={{ background: "var(--hover-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 6 }}>Case {index + 1}</div>
                        <div style={{ color: test.status === "pass" ? "var(--success)" : test.status === "fail" ? "var(--error)" : "var(--warning)", fontSize: 13, marginBottom: 6 }}>
                          {String(test.status).toUpperCase()}
                        </div>
                        {test.error ? (
                          <div style={{ color: "var(--error)", fontSize: 12, whiteSpace: "pre-wrap" }}>{test.error}</div>
                        ) : (
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            Expected: <span style={{ color: "var(--text)" }}>{test.expected}</span>
                            <br />
                            Got: <span style={{ color: "var(--text)" }}>{test.actual}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}>Create New Test</div>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={S.fieldLabel}>Test Title</label>
                  <input value={createForm.title} onChange={(e) => handleCreateInput("title", e.target.value)} style={S.input} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={S.fieldLabel}>Difficulty</label>
                    <select value={createForm.level} onChange={(e) => handleCreateInput("level", e.target.value)} style={S.input}>
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.fieldLabel}>Duration (mins)</label>
                    <input value={createForm.duration} onChange={(e) => handleCreateInput("duration", e.target.value)} style={S.input} />
                  </div>
                </div>
                <div>
                  <label style={S.fieldLabel}>Date</label>
                  <input value={createForm.date} onChange={(e) => handleCreateInput("date", e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.fieldLabel}>Question IDs</label>
                  <input value={createForm.questions} onChange={(e) => handleCreateInput("questions", e.target.value)} style={S.input} placeholder="29,34,39" />
                </div>
                <button onClick={handleCreateTest} style={S.btn("submit")}>Create Test</button>
              </div>
            </div>

            {solutionsVisible && (
              <div style={S.card}>
                <div style={S.sectionTitle}>Submitted Solutions</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {currentTest.questions.map((id) => {
                    const problem = problems.find((item) => item.id === id);
                    return (
                      <div key={id} style={S.subCard}>
                        <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>{problem ? problem.title : `Problem ${id}`}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Top submission visible after test completion. Connect secure storage/backend to load real submitted code.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.AdminPortal = AdminPortal;
