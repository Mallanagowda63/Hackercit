const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const code = fs.readFileSync(path.join(__dirname, '../hacker.jsx'), 'utf8');

// Transpile JSX to JS first
const transformed = babel.transform(code, {
  presets: ['react'],
  filename: 'hacker.jsx'
}).code;

// Track defined global identifiers and find references
const knownGlobals = new Set([
  'window', 'document', 'console', 'fetch', 'URL', 'Buffer', 'Date', 'Math', 'JSON',
  'String', 'Number', 'Boolean', 'Array', 'Set', 'Map', 'Object', 'RegExp', 'Error',
  'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Promise', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'React', 'ReactDOM', 'Babel',
  'undefined', 'null', 'true', 'false', 'Infinity', 'NaN', 'eval', 'arguments', 'event'
]);

// Find all top-level declarations (function X, const X, let X, var X, class X)
const topLevelDefs = new Set();
const defMatches = [...code.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)];
defMatches.forEach(m => topLevelDefs.add(m[1]));

console.log("Top-level definitions found:", topLevelDefs.size);

// Scan transformed JS for capitalized or UPPERCASE constants and identifiers used but not defined
const idMatches = [...transformed.matchAll(/\b([A-Z0-9_]{3,})\b/g)].map(m => m[1]);
const uniqueUpper = [...new Set(idMatches)];

const missingConsts = [];
uniqueUpper.forEach(id => {
  if (!topLevelDefs.has(id) && !knownGlobals.has(id) && !id.startsWith('REACT_') && id !== 'JSX') {
    missingConsts.push(id);
  }
});

console.log("Potentially missing UPPERCASE constants/globals:", missingConsts);

// Let's also check lines around 7273 and 8525 in hacker.jsx
const lines = code.split('\n');
console.log("\nChecking lines referencing SUPPORTED_LANGUAGES:");
lines.forEach((l, idx) => {
  if (l.includes('SUPPORTED_LANGUAGES')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});
