const fs = require('fs');

let content = fs.readFileSync('hacker.jsx', 'utf8');

// 1. Remove REFERENCE_SOLUTIONS
const refStart = content.indexOf('// ─────\n// HIDDEN REFERENCE SOLUTIONS');
const refStartAlt = content.indexOf('const REFERENCE_SOLUTIONS = {');
const actualRefStart = refStart !== -1 ? refStart : refStartAlt;

const refEnd = content.indexOf('async function requestExecutionResult');

if (actualRefStart === -1 || refEnd === -1 || actualRefStart >= refEnd) {
  console.error('Error: Could not locate REFERENCE_SOLUTIONS block cleanly.');
  process.exit(1);
}

content = content.slice(0, actualRefStart) + content.slice(refEnd);

// 2. Remove PROBLEMS
const probStart = content.indexOf('const PROBLEMS = [');
const probEnd = content.indexOf('function CodeHighlightLayer');

if (probStart === -1 || probEnd === -1 || probStart >= probEnd) {
  console.error('Error: Could not locate PROBLEMS block cleanly.');
  process.exit(1);
}

content = content.slice(0, probStart) + content.slice(probEnd);

// 3. Replace all remaining fallbacks to PROBLEMS in hacker.jsx
content = content.replace(
  /const defaultAdminProblems = \[\d+,\s*\d+,\s*\d+\]\s*\.map\(\(problemId\) => PROBLEMS\.find\(\(problem\) => problem\.id === problemId\)\)\s*\.filter\(Boolean\);/g,
  'const defaultAdminProblems = [];'
);

content = content.replace(
  'const loadStudentPortalData = async (availableProblems = problemBank.length ? problemBank : PROBLEMS) => {',
  'const loadStudentPortalData = async (availableProblems = problemBank) => {'
);

content = content.replace(
  '(loadedProblems.length ? loadedProblems : PROBLEMS)',
  'loadedProblems'
);

content = content.replace(
  '|| PROBLEMS.find((problem) => problem.id === adminSubmissionProblemId);',
  '|| null;'
);

content = content.replace(
  'const rawProblemList = problemBank.length ? problemBank : PROBLEMS;',
  'const rawProblemList = problemBank;'
);

const targetRefSnippet = '{REFERENCE_SOLUTIONS[p.id]?.[lang] || "// No solution available for this language yet."}';
if (content.includes(targetRefSnippet)) {
  content = content.replace(targetRefSnippet, '{"// Reference solutions are managed server-side and protected."}');
}

fs.writeFileSync('hacker.jsx', content, 'utf8');
console.log('Successfully cleaned hacker.jsx! Hardcoded PROBLEMS and REFERENCE_SOLUTIONS removed.');
