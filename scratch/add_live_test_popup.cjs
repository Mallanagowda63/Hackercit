const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const hackerPath = path.join(__dirname, '../hacker.jsx');
let content = fs.readFileSync(hackerPath, 'utf8');

// 1. Add state variables for showLiveTestPopup
const stateMarker = 'const [studentNotifications, setStudentNotifications] = useState([]);';
if (!content.includes('const [showLiveTestPopup, setShowLiveTestPopup]')) {
  const newStates = `const [showLiveTestPopup, setShowLiveTestPopup] = useState(false);
  const [liveTestPopupDismissedId, setLiveTestPopupDismissedId] = useState(null);
  ${stateMarker}`;
  content = content.replace(stateMarker, newStates);
  console.log('✅ Added showLiveTestPopup state variables!');
}

// 2. Trigger popup in loadStudentPortalData
const portalDataMarker = 'setActiveAssignment(assignment);';
if (content.includes(portalDataMarker) && !content.includes('setShowLiveTestPopup(true)')) {
  const replacement = `setActiveAssignment(assignment);
      if (assignment && (assignment.status === "LIVE" || assignment.status === "live" || assignment.active) && !contestEntered) {
        setShowLiveTestPopup(true);
      }`;
  content = content.replace(portalDataMarker, replacement);
  console.log('✅ Added popup trigger in loadStudentPortalData!');
}

// 3. Add renderLiveTestPopupModal function
const modalFunction = `  const renderLiveTestPopupModal = () => {
    if (!showLiveTestPopup || !activeContestAssignment || contestEntered) return null;

    return (
      <div style={S.modalBackdrop} onClick={() => setShowLiveTestPopup(false)}>
        <div
          style={{
            width: "min(520px, 90vw)",
            background: "linear-gradient(145deg, #0f172a, #1e1b4b)",
            color: "#f8fafc",
            border: "2px solid #818cf8",
            borderRadius: 24,
            padding: "28px",
            boxShadow: "0 25px 80px rgba(99, 102, 241, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            animation: "modalFadeIn 0.3s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>📢</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  LIVE TEST ANNOUNCEMENT
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff" }}>
                  Assessment Available!
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowLiveTestPopup(false)}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontSize: 12, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(129, 140, 248, 0.3)", borderRadius: 16, padding: "18px", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>
              {activeContestAssignment.title || "Live Assessment"}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
              {activeContestAssignment.description || "An official test is active now. Click below to start your test attempt immediately."}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>
              <span>⏱ Duration: {activeContestAssignment.duration || 60} mins</span>
              <span>📝 Questions: {activeContestAssignment.problems?.length || 0}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              onClick={() => {
                setLiveTestPopupDismissedId(activeContestAssignment.id);
                setShowLiveTestPopup(false);
              }}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}
            >
              Dismiss for Now
            </button>
            <button
              onClick={() => {
                setShowLiveTestPopup(false);
                openContest();
              }}
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#ffffff", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)" }}
            >
              🚀 Start Test Now
            </button>
          </div>
        </div>
      </div>
    );
  };
`;

const renderPdfUploadModalMarker = 'const renderPdfUploadModal = () => {';
if (!content.includes('const renderLiveTestPopupModal = () => {')) {
  content = content.replace(renderPdfUploadModalMarker, `${modalFunction}\n\n  ${renderPdfUploadModalMarker}`);
  console.log('✅ Added renderLiveTestPopupModal function!');
}

// 4. Mount renderLiveTestPopupModal in main render tree
const modalMountMarker = '{renderPdfUploadModal()}';
if (content.includes(modalMountMarker) && !content.includes('{renderLiveTestPopupModal()}')) {
  content = content.replace(modalMountMarker, `${modalMountMarker}\n          {renderLiveTestPopupModal()}`);
  console.log('✅ Mounted renderLiveTestPopupModal in render tree!');
}

fs.writeFileSync(hackerPath, content, 'utf8');

try {
  babel.transform(content, { presets: ['react'] });
  console.log('✅ SUCCESS! Live test popup added and Babel transform passed with 0 errors!');
} catch (e) {
  console.error('❌ Babel transform error:', e.message);
  process.exit(1);
}
