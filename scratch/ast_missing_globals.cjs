const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const code = fs.readFileSync(path.join(__dirname, '../hacker.jsx'), 'utf8');

const unboundDetails = [];
const globals = new Set([
  'window', 'document', 'console', 'fetch', 'URL', 'Buffer', 'Date', 'Math', 'JSON',
  'String', 'Number', 'Boolean', 'Array', 'Set', 'Map', 'Object', 'RegExp', 'Error',
  'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Promise', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'React', 'ReactDOM', 'Babel',
  'undefined', 'null', 'true', 'false', 'Infinity', 'NaN', 'eval', 'arguments', 'event',
  'process', 'Image', 'Audio', 'FileReader', 'FormData', 'Headers', 'Request', 'Response',
  'Blob', 'localStorage', 'sessionStorage', 'history', 'location', 'navigator', 'screen',
  'performance', 'alert', 'confirm', 'prompt'
]);

function findUnboundPlugin({ types: t }) {
  return {
    visitor: {
      Identifier(path) {
        if (path.isReferencedIdentifier()) {
          const name = path.node.name;
          if (!globals.has(name) && !path.scope.hasBinding(name)) {
            const loc = path.node.loc;
            unboundDetails.push({ name, line: loc ? loc.start.line : 0 });
          }
        }
      }
    }
  };
}

babel.transform(code, {
  presets: ['react'],
  plugins: [findUnboundPlugin],
  filename: 'hacker.jsx'
});

console.log("UNBOUND IDENTIFIERS WITH LINE NUMBERS:", unboundDetails);
