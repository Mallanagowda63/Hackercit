const fs = require('fs');

const jsxText = fs.readFileSync('hacker.jsx', 'utf8');

// Extract REFERENCE_SOLUTIONS substring
const refStart = jsxText.indexOf('const REFERENCE_SOLUTIONS = {');
const refEnd = jsxText.indexOf('const PROBLEMS = [');
const refBlock = jsxText.substring(refStart, refEnd);

// Extract PROBLEMS substring up to ErrorBanner
const bannerStart = jsxText.indexOf('function ErrorBanner');
const probBlock = jsxText.substring(refEnd, bannerStart).trim();

fs.writeFileSync('scratch/extracted_data.cjs', `${refBlock}\n${probBlock}\nmodule.exports = { REFERENCE_SOLUTIONS, PROBLEMS };`);

console.log('Extracted hardcoded problem data into scratch/extracted_data.cjs');
