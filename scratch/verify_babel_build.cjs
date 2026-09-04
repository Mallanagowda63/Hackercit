const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const code = fs.readFileSync(path.join(__dirname, '../hacker.jsx'), 'utf8');

try {
  const result = babel.transform(code, {
    presets: ['react'],
    filename: 'hacker.jsx'
  });
  console.log("Babel JSX Compilation: SUCCESS (Transpiled length: " + result.code.length + " bytes)");
} catch (err) {
  console.error("Babel JSX Compilation FAILED:", err.message);
  process.exit(1);
}
