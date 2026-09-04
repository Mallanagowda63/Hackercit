const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../hacker.jsx'), 'utf8');

const lines = code.split('\n');
lines.forEach((line, idx) => {
  const matches = [...line.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g)];
  matches.forEach(m => {
    const comp = m[1];
    const defRegex = new RegExp(`(function|const|let|var|class)\\s+${comp}\\b`);
    if (!defRegex.test(code)) {
      console.log(`Line ${idx + 1}: Missing component <${comp}> -> ${line.trim()}`);
    }
  });
});
