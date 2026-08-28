const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const hackerPath = path.join(__dirname, '../hacker.jsx');
const content = fs.readFileSync(hackerPath, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex((l) => l.includes('const renderPdfUploadModal = () => {'));
const endIndex = lines.findIndex((l) => l.includes('const renderAdminPreviewModal = () => {'));

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find start/end index of renderPdfUploadModal!');
  process.exit(1);
}

const newFunctionText = `  const renderPdfUploadModal = () => {
    if (!pdfModalOpen) return null;

    const handlePdfFileSelect = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setPdfStage("uploading");
      setPdfProgressText("Uploading PDF document...");

      try {
        let extractedText = "";

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          setPdfStage("extracting");
          setPdfProgressText("Extracting PDF pages and text content...");

          const arrayBuffer = await file.arrayBuffer();
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item) => item.str).join(" ");
              fullText += \`\\nQuestion \${pageNum}:\\n\` + pageText;
            }
            extractedText = fullText;
          } else {
            extractedText = await file.text();
          }
        } else {
          setPdfStage("extracting");
          setPdfProgressText("Reading document text...");
          extractedText = await file.text();
        }

        setPdfStage("processing");
        setPdfProgressText("Parsing questions, A/B/C/D options, and correct answers...");

        const data = await performApiRequest("/api/problems/upload-mcq-pdf", {
          method: "POST",
          body: JSON.stringify({ rawText: extractedText }),
        });

        setPdfDraftQuestions(data.questions || []);
        setPdfStage("ready");
        setPdfProgressText("");
      } catch (err) {
        setPortalError(err.message || "Failed to extract questions from PDF document.");
        setPdfStage("idle");
        setPdfProgressText("");
      }
    };

    const handleImportAllPdfs = async () => {
      if (!pdfDraftQuestions.length) return;
      setPdfImporting(true);

      try {
        const data = await performApiRequest("/api/problems/import-mcq-bulk", {
          method: "POST",
          body: JSON.stringify({ questions: pdfDraftQuestions }),
        });

        const createdCount = data.count || data.problems?.length || 0;
        setPortalMessage(\`Successfully imported \${createdCount} MCQ question(s) into database!\`);

        await loadAdminPortalData();

        setPdfModalOpen(false);
        setPdfStage("idle");
        setPdfDraftQuestions([]);
        setPdfEditingIndex(null);
      } catch (err) {
        setPortalError(err.message || "Failed to import questions.");
      } finally {
        setPdfImporting(false);
      }
    };

    const currentDraft = pdfEditingIndex !== null ? pdfDraftQuestions[pdfEditingIndex] : null;

    return (
      <div style={S.modalBackdrop} onClick={() => { if (!pdfImporting) setPdfModalOpen(false); }}>
        <div
          style={{
            width: "min(920px, 94vw)",
            maxHeight: "calc(100vh - 40px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                BULK MCQ PDF IMPORTER
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                Upload & Extract MCQ Questions
              </div>
            </div>
            <button
              onClick={() => setPdfModalOpen(false)}
              disabled={pdfImporting}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>

          {pdfEditingIndex !== null && currentDraft ? (
            <div style={{ background: "#1e293b", border: "1px solid #8b5cf6", borderRadius: 16, padding: "20px", display: "grid", gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#a78bfa" }}>
                ✏️ Edit Extracted Draft Question #{pdfEditingIndex + 1}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>Question Statement</label>
                <textarea
                  value={currentDraft.statement || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = [...pdfDraftQuestions];
                    next[pdfEditingIndex] = { ...next[pdfEditingIndex], statement: val, title: val.slice(0, 80) };
                    setPdfDraftQuestions(next);
                  }}
                  style={{ width: "100%", minHeight: 70, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: 10, color: "#f8fafc", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>Options (A, B, C, D)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["A", "B", "C", "D"].map((letter, oIdx) => (
                    <div key={letter} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <strong style={{ color: "#38bdf8", width: 16 }}>{letter}.</strong>
                      <input
                        type="text"
                        value={currentDraft.options?.[oIdx] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...pdfDraftQuestions];
                          const opts = [...(next[pdfEditingIndex].options || ["", "", "", ""])];
                          opts[oIdx] = val;
                          next[pdfEditingIndex] = { ...next[pdfEditingIndex], options: opts };
                          setPdfDraftQuestions(next);
                        }}
                        style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", color: "#f8fafc", fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>Correct Answer Choice</label>
                  <select
                    value={currentDraft.correctAnswerIndex ?? 0}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      const next = [...pdfDraftQuestions];
                      const targetOpt = next[pdfEditingIndex].options?.[idx] || "";
                      next[pdfEditingIndex] = { ...next[pdfEditingIndex], correctAnswerIndex: idx, correctAnswer: targetOpt };
                      setPdfDraftQuestions(next);
                    }}
                    style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", color: "#4ade80", fontWeight: 700 }}
                  >
                    {["A", "B", "C", "D"].map((letter, oIdx) => (
                      <option key={letter} value={oIdx}>Option {letter} ({currentDraft.options?.[oIdx] || \`Option \${letter}\`})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>Marks</label>
                  <input
                    type="number"
                    value={currentDraft.marks || 2}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 2;
                      const next = [...pdfDraftQuestions];
                      next[pdfEditingIndex] = { ...next[pdfEditingIndex], marks: val };
                      setPdfDraftQuestions(next);
                    }}
                    style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", color: "#f8fafc", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>Category / Topic</label>
                  <input
                    type="text"
                    value={currentDraft.category || "Python"}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = [...pdfDraftQuestions];
                      next[pdfEditingIndex] = { ...next[pdfEditingIndex], category: val };
                      setPdfDraftQuestions(next);
                    }}
                    style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", color: "#f8fafc", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...pdfDraftQuestions];
                    const q = next[pdfEditingIndex];
                    const validOpts = (q.options || []).filter((o) => String(o).trim());
                    next[pdfEditingIndex].isMalformed = !q.statement || validOpts.length < 2;
                    setPdfDraftQuestions(next);
                    setPdfEditingIndex(null);
                  }}
                  style={{ ...S.adminButton("submit"), padding: "8px 20px" }}
                >
                  ✓ Done Editing
                </button>
              </div>
            </div>
          ) : pdfStage !== "ready" && pdfStage !== "idle" ? (
            <div style={{ padding: "40px", textAlign: "center", display: "grid", gap: 12 }}>
              <div style={{ fontSize: 32 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{pdfProgressText}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Stage: {pdfStage.toUpperCase()}</div>
            </div>
          ) : !pdfDraftQuestions.length ? (
            <div style={{ border: "2px dashed #334155", borderRadius: 16, padding: "40px", textAlign: "center", background: "#1e293b" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>Select MCQ PDF or Document File</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 18 }}>Supports PDF, TXT, DOC documents containing formatted questions, options A/B/C/D, & correct answers.</div>
              <input type="file" accept=".pdf,.txt,.doc" onChange={handlePdfFileSelect} style={{ display: "none" }} id="pdf_mcq_input" />
              <label htmlFor="pdf_mcq_input" style={{ ...S.adminButton("submit"), padding: "12px 28px", cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center" }}>
                <span>📁 Select MCQ Document</span>
              </label>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>
                  Extracted {pdfDraftQuestions.length} Question(s) — Ready for Review & Import
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => { setPdfDraftQuestions([]); setPdfStage("idle"); }}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontSize: 12, cursor: "pointer" }}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleImportAllPdfs}
                    disabled={pdfImporting}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#ffffff",
                      fontWeight: 800,
                      cursor: pdfImporting ? "not-allowed" : "pointer",
                      opacity: pdfImporting ? 0.6 : 1,
                    }}
                  >
                    {pdfImporting ? "Importing..." : \`IMPORT ALL (\${pdfDraftQuestions.length} QUESTIONS)\`}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16, maxHeight: "calc(100vh - 220px)", overflowY: "auto", paddingRight: 4 }}>
                {pdfDraftQuestions.map((q, idx) => {
                  const letterAns = ["A", "B", "C", "D"][q.correctAnswerIndex ?? 0] || "A";
                  const ansText = q.correctAnswer || q.options?.[q.correctAnswerIndex ?? 0] || "";

                  return (
                    <div key={q.tempId || idx} style={{ background: "#1e293b", border: \`1px solid \${q.isMalformed ? "#f87171" : "#334155"}\`, borderRadius: 14, padding: "18px", display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ fontWeight: 800, color: "#f8fafc", fontSize: 15, lineHeight: 1.4 }}>
                          Q\${idx + 1}. \${q.statement || q.title}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {q.isMalformed && (
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                              ⚠️ Malformed
                            </span>
                          )}
                          <button
                            onClick={() => setPdfEditingIndex(idx)}
                            style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #8b5cf6", background: "rgba(139,92,246,0.14)", color: "#c4b5fd", cursor: "pointer" }}
                          >
                            ✏️ EDIT
                          </button>
                          <button
                            onClick={() => setPdfDraftQuestions(pdfDraftQuestions.filter((_, i) => i !== idx))}
                            style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #f87171", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer" }}
                          >
                            🗑 DELETE
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {(q.options || ["Option A", "Option B", "Option C", "Option D"]).map((opt, oIdx) => {
                          const optLetter = ["A", "B", "C", "D"][oIdx];
                          const isCorrectChoice = (q.correctAnswerIndex === oIdx) || opt === q.correctAnswer;
                          return (
                            <div
                              key={oIdx}
                              style={{
                                background: isCorrectChoice ? "rgba(34,197,94,0.12)" : "#0f172a",
                                border: \`1px solid \${isCorrectChoice ? "rgba(34,197,94,0.4)" : "#334155"}\`,
                                padding: "8px 12px",
                                borderRadius: 8,
                                fontSize: 12,
                                color: isCorrectChoice ? "#4ade80" : "#cbd5e1",
                                fontWeight: isCorrectChoice ? 700 : 400,
                              }}
                            >
                              <strong style={{ color: "#38bdf8" }}>{optLetter}.</strong> {opt} {isCorrectChoice && "✓"}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 18, borderTop: "1px dashed #334155", paddingTop: 10, flexWrap: "wrap" }}>
                        <span>Correct Answer: <strong style={{ color: "#4ade80" }}>{letterAns} ({ansText})</strong></span>
                        <span>Marks: <strong style={{ color: "#f8fafc" }}>{q.marks || 2}</strong></span>
                        <span>Category: <strong style={{ color: "#38bdf8" }}>{q.category || "Python"}</strong></span>
                        <span>Difficulty: <strong style={{ color: "#a78bfa" }}>{q.difficulty || "Easy"}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };`;

lines.splice(startIndex, endIndex - startIndex, newFunctionText);
const updatedContent = lines.join('\n');
fs.writeFileSync(hackerPath, updatedContent, 'utf8');

try {
  babel.transform(updatedContent, { presets: ['react'] });
  console.log('✅ SUCCESS! hacker.jsx updated and Babel transform passed perfectly!');
} catch (e) {
  console.error('❌ Babel transform error:', e.message);
  process.exit(1);
}
