const fs = require('fs');

const jsxText = fs.readFileSync('hacker.jsx', 'utf8');
const lines = jsxText.split('\n');

// Line 390 to line 2795 (0-indexed 389 to 2794)
const before = lines.slice(0, 389);
const after = lines.slice(2795);

const newLines = [
  ...before,
  '// All problem definitions and reference solutions are stored and served dynamically from MongoDB database.',
  '',
  ...after,
];

fs.writeFileSync('hacker.jsx', newLines.join('\n'), 'utf8');
console.log('[PASS] Successfully removed hardcoded REFERENCE_SOLUTIONS and PROBLEMS from hacker.jsx!');
