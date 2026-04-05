const { useEffect, useMemo, useState } = React;
const API_HOST = window.location.hostname || "127.0.0.1";
const LOCAL_API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const LOCAL_BACKEND_API_BASE = `${LOCAL_API_PROTOCOL}//${API_HOST}:4000`;
const CONFIGURED_BACKEND_API_BASE = (
  window.__CODEARENA_CONFIG__?.backendApiBase ||
  document.querySelector('meta[name="codearena-backend-api-base"]')?.content ||
  ""
).trim().replace(/\/+$/, "");
const IS_LOCAL_FRONTEND = API_HOST === "127.0.0.1" || API_HOST === "localhost";
const BACKEND_API_BASE = CONFIGURED_BACKEND_API_BASE || (IS_LOCAL_FRONTEND ? LOCAL_BACKEND_API_BASE : "");

function AdminPortal({
  problems = [],
  onSignOut = () => {},
  onGoHome = () => {},
}) {
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
      const response = await fetch(`${BACKEND_API_BASE}/api/run`, {
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
      const data = text ? JSON.parse(text) : {};

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
    app: { fontFamily: "'Outfit','Space Grotesk',sans-serif", background: "#0a0a0f", color: "#e0e0e0", minHeight: "100vh", display: "flex", flexDirection: "column" },
    nav: { background: "#111118", borderBottom: "1px solid #1e1e2e", padding: "0 24px", display: "flex", alignItems: "center", height: 56, gap: 24, position: "sticky", top: 0, zIndex: 100 },
    logo: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 20, background: "linear-gradient(135deg,#7c6af7,#4fd1c5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", cursor: "pointer", letterSpacing: "-0.5px" },
    btn: (v) => ({
      padding: "8px 18px",
      borderRadius: 6,
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 12.5,
      fontFamily: "'Space Grotesk',sans-serif",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      transition: "all 0.15s",
      ...(v === "run"
        ? { background: "#1a2a1a", color: "#4ade80", border: "1px solid #2a3a2a" }
        : v === "submit"
          ? { background: "linear-gradient(135deg,#7c6af7,#4fd1c5)", color: "#fff" }
          : { background: "#1e1e2e", color: "#aaa", border: "1px solid #2a2a3e" }),
    }),
    fieldLabel: { display: "block", marginBottom: 8, color: "#8f93b4", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Space Grotesk',sans-serif" },
    input: { width: "100%", boxSizing: "border-box", background: "#0f1018", border: "1px solid #26263d", color: "#eef0ff", borderRadius: 12, padding: "13px 14px", fontSize: 14, outline: "none", fontFamily: "'Outfit','Space Grotesk',sans-serif" },
    shell: { maxWidth: 1240, margin: "0 auto", width: "100%", padding: "28px 24px 40px", display: "grid", gap: 22 },
    cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
    card: { background: "linear-gradient(180deg,#12121d,#0d0d15)", border: "1px solid #25253b", borderRadius: 18, padding: "18px 18px 20px", boxShadow: "0 16px 40px #00000024, inset 0 1px 0 #ffffff08" },
    sectionTitle: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: "#7a7f9e", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 },
    tableWrap: { background: "linear-gradient(180deg,#12121d,#0d0d15)", border: "1px solid #25253b", borderRadius: 18, overflow: "hidden", boxShadow: "0 16px 40px #00000024, inset 0 1px 0 #ffffff08" },
    tableHead: { padding: "14px 16px", textAlign: "left", fontSize: 11, color: "#7a7f9e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Space Grotesk',sans-serif" },
    tableCell: { padding: "14px 16px", borderTop: "1px solid #1c1d2a", fontSize: 14, color: "#dfe2ff" },
    subCard: { background: "#0e0f17", border: "1px solid #202233", borderRadius: 14, padding: "14px" },
  };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      <nav style={S.nav}>
        <span style={S.logo} onClick={onGoHome}>{"</> CodeArena"}</span>
        <span style={{ color: "#eef0ff", fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: "0.03em" }}>Test Assignment Leaderboard</span>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={onSignOut} style={{ ...S.btn("default"), color: "#c8c8e8" }}>Sign Out</button>
        </div>
      </nav>

      <div style={S.shell}>
        {warning && (
          <div style={{ background: "#181108", border: "1px solid #5b4514", color: "#ffd37a", borderRadius: 14, padding: "12px 14px", fontSize: 13 }}>
            {warning}
          </div>
        )}

        <div style={S.cardGrid}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Current Test</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#f4f5ff", marginBottom: 14 }}>{currentTest.title}</div>
            <div style={{ display: "grid", gap: 8, color: "#a9aed0", fontSize: 14 }}>
              <div>Level: <span style={{ color: "#ff8fa3", fontWeight: 700 }}>{currentTest.level}</span></div>
              <div>Date: <span style={{ color: "#eef0ff" }}>{currentTest.date}</span></div>
              <div>Duration: <span style={{ color: "#eef0ff" }}>{currentTest.duration} mins</span></div>
              <div>Timer: <span style={{ color: currentTestEnded ? "#ff6b6b" : "#4fd1c5", fontWeight: 700 }}>{formatCountdown(timerSeconds)}</span></div>
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
                    background: selectedPreviousTest?.id === test.id ? "#18192a" : "#0f1018",
                    border: selectedPreviousTest?.id === test.id ? "1px solid #7c6af7" : "1px solid #202233",
                    borderRadius: 12,
                    color: "#dfe2ff",
                    padding: "12px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{test.name}</div>
                  <div style={{ color: "#8f93b4", fontSize: 12 }}>{test.date} • {test.difficulty}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Participants</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#4fd1c5", lineHeight: 1, marginBottom: 10 }}>{participantsCount}</div>
            <div style={{ color: "#8f93b4", fontSize: 14, marginBottom: 12 }}>Users currently taking the test</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#0e1c16", border: "1px solid #214235", color: "#73f0b3", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 12px #4ade80" }} />
              Live Count
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Solutions</div>
            <div style={{ fontSize: 14, color: "#8f93b4", marginBottom: 14 }}>Submitted solutions become viewable after the timer ends.</div>
            <button
              onClick={() => setSolutionsVisible((prev) => !prev)}
              disabled={!currentTestEnded}
              style={{
                ...S.btn("default"),
                color: currentTestEnded ? "#ffc01e" : "#666",
                border: currentTestEnded ? "1px solid #5b4514" : "1px solid #2a2a3e",
                background: currentTestEnded ? "#191309" : "#12121a",
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
                    <td style={{ ...S.tableCell, color: "#73f0b3", fontWeight: 700 }}>{entry.score}</td>
                    <td style={S.tableCell}>{entry.timeTaken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}>Previous Test Result</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f4f5ff", marginBottom: 10 }}>{selectedPreviousTest?.name}</div>
              <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#a9aed0" }}>
                <div>Date: <span style={{ color: "#eef0ff" }}>{selectedPreviousTest?.date}</span></div>
                <div>Difficulty: <span style={{ color: "#ffc01e" }}>{selectedPreviousTest?.difficulty}</span></div>
                <div>Winner: <span style={{ color: "#4fd1c5" }}>{selectedPreviousTest?.winner}</span></div>
                <div>Average Score: <span style={{ color: "#eef0ff" }}>{selectedPreviousTest?.average}</span></div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sectionTitle}>Monitor Active Users</div>
              <div style={{ display: "grid", gap: 10 }}>
                {activeUsers.map((user) => (
                  <div key={user.name} style={{ ...S.subCard, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#eef0ff", fontWeight: 700 }}>{user.name}</div>
                      <div style={{ color: "#8f93b4", fontSize: 12 }}>{user.department}</div>
                    </div>
                    <div style={{ color: user.status === "Submitted" ? "#73f0b3" : "#ffc01e", fontSize: 12, fontWeight: 700 }}>{user.status}</div>
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
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #202233", color: "#8f93b4", fontSize: 12 }}>
                  Write solution for {selectedProblem ? selectedProblem.title : "selected problem"}
                </div>
                <textarea
                  value={submissionCode}
                  onChange={(e) => setSubmissionCode(e.target.value)}
                  spellCheck={false}
                  style={{ width: "100%", minHeight: 240, background: "#0b0c14", color: "#dfe2ff", border: "none", outline: "none", resize: "vertical", padding: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.7, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => handleRun(false)} disabled={executing || !selectedProblem} style={S.btn("run")}>
                  {executing ? "Running..." : "Run Code"}
                </button>
                <div style={{ color: "#8f93b4", fontSize: 13, alignSelf: "center" }}>
                  Uses the current `/api/run` backend. Replace that backend with Judge0 later if you want hosted execution.
                </div>
              </div>

              {execution && (
                <div style={S.subCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                    <div style={{ color: execution.status === "passed" ? "#73f0b3" : "#ff9b9b", fontWeight: 700 }}>
                      {execution.autoSubmitted ? "Auto-submitted" : "Execution Result"}
                    </div>
                    <div style={{ color: "#8f93b4", fontSize: 12 }}>Runtime: {execution.runtime}</div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {execution.tests.map((test, index) => (
                      <div key={index} style={{ background: "#0a0b12", border: "1px solid #202233", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ color: "#eef0ff", fontWeight: 700, marginBottom: 6 }}>Case {index + 1}</div>
                        <div style={{ color: test.status === "pass" ? "#73f0b3" : test.status === "fail" ? "#ff9b9b" : "#ffc01e", fontSize: 13, marginBottom: 6 }}>
                          {String(test.status).toUpperCase()}
                        </div>
                        {test.error ? (
                          <div style={{ color: "#ffb0b0", fontSize: 12, whiteSpace: "pre-wrap" }}>{test.error}</div>
                        ) : (
                          <div style={{ color: "#8f93b4", fontSize: 12 }}>
                            Expected: <span style={{ color: "#dfe2ff" }}>{test.expected}</span>
                            <br />
                            Got: <span style={{ color: "#dfe2ff" }}>{test.actual}</span>
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
                        <div style={{ color: "#eef0ff", fontWeight: 700, marginBottom: 4 }}>{problem ? problem.title : `Problem ${id}`}</div>
                        <div style={{ color: "#8f93b4", fontSize: 12 }}>
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
