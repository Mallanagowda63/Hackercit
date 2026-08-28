const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const hackerPath = path.join(__dirname, '../hacker.jsx');
let content = fs.readFileSync(hackerPath, 'utf8');

// 1. Insert goBackFromAdmin right after goBackFromProblem
const goBackFromProblemMarker = 'const goBackFromProblem = () => {';
if (content.includes(goBackFromProblemMarker) && !content.includes('const goBackFromAdmin =')) {
  const replacement = `  const goBackFromAdmin = () => {
    setView("home");
  };

  const goBackFromProblem = () => {`;
  content = content.replace(goBackFromProblemMarker, replacement);
  console.log('✅ Added goBackFromAdmin definition!');
}

// 2. Replace trailing root.render with ErrorBoundary + root.render
const rootIndex = content.lastIndexOf('const root = ReactDOM.createRoot');
if (rootIndex !== -1) {
  content = content.slice(0, rootIndex).trim() + '\n\n';
}

content += `class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("DevOrbit ErrorBoundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 24px", maxWidth: 800, margin: "60px auto", background: "#0f172a", border: "1px solid #ef4444", borderRadius: 16, color: "#f8fafc", fontFamily: "'Outfit', sans-serif" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f87171", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span>⚠️</span>
            <span>Application Exception</span>
          </div>
          <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            DevOrbit encountered an unexpected runtime error.
          </p>
          <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#f87171", marginBottom: 20, whiteSpace: "pre-wrap", overflowX: "auto" }}>
            {this.state.error && this.state.error.toString()}
            {this.state.errorInfo?.componentStack && \`\\n\${this.state.errorInfo.componentStack}\`}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#38bdf8", color: "#08080d", fontWeight: 700, cursor: "pointer" }}
            >
              🔄 Reload Application
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              🏠 Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <CodingPlatform />
  </ErrorBoundary>
);\n`;

fs.writeFileSync(hackerPath, content, 'utf8');

try {
  babel.transform(content, { presets: ['react'] });
  console.log('✅ SUCCESS! All updates applied and Babel transform passed with 0 errors!');
} catch (e) {
  console.error('❌ Babel transform error:', e.message);
  process.exit(1);
}
