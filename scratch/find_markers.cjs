const fs = require('fs');

const jsxText = fs.readFileSync('hacker.jsx', 'utf8');
const lines = jsxText.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('const REFERENCE_SOLUTIONS')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
  if (line.includes('const PROBLEMS')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
  if (line.includes('function ErrorBanner')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
