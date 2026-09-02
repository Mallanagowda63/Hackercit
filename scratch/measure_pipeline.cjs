const http = require('http');

async function httpGet(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:4000${endpoint}`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function obtainAuthToken() {
  const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const registerPayload = JSON.stringify({
    email: `benchmarker_${uniqueId}@devorbit.com`,
    password: 'Password123!',
    name: 'Benchmarker',
    usn: `USN_${uniqueId}`,
    department: 'CSE',
    role: 'student',
  });

  return new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:4000/api/auth/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(registerPayload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.token) return resolve(data.token);
          } catch {}
          resolve(null);
        });
      }
    );
    req.write(registerPayload);
    req.end();
  });
}

async function executeApi(endpoint, payload, token) {
  const jsonStr = JSON.stringify(payload);
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.request(
      `http://127.0.0.1:4000${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonStr),
          'Authorization': `Bearer ${token}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const elapsed = Date.now() - start;
          let parsed = {};
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = { raw: body };
          }
          resolve({ statusCode: res.statusCode, elapsed, data: parsed });
        });
      }
    );
    req.on('error', (err) => resolve({ statusCode: 500, elapsed: Date.now() - start, error: err.message }));
    req.write(jsonStr);
    req.end();
  });
}

async function runBenchmark() {
  console.log('--- STARTING DEVORBIT PIPELINE BENCHMARK ---');
  const token = await obtainAuthToken();

  const problemData = await httpGet('/api/problems?includeContent=1');
  const problem = problemData.problems?.[0];
  const problemId = problem ? String(problem.id) : '1';
  console.log(`Testing with Problem ID: ${problemId} (${problem?.title || 'Fallback'})`);

  const testCases = [
    { name: 'Python Run Code', endpoint: '/api/submissions/run', payload: { problemId, language: 'python', code: 'def twoSum(nums, target):\n    return [0, 1]' } },
    { name: 'JavaScript Run Code', endpoint: '/api/submissions/run', payload: { problemId, language: 'javascript', code: 'function twoSum(nums, target) { return [0, 1]; }' } },
    { name: 'Java Run Code', endpoint: '/api/submissions/run', payload: { problemId, language: 'java', code: 'class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    return new int[]{0, 1};\n  }\n}' } },
    { name: 'Python Submit', endpoint: '/api/submissions/submit', payload: { problemId, language: 'python', code: 'def twoSum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        if target - num in lookup:\n            return [lookup[target - num], i]\n        lookup[num] = i\n    return []' } },
    { name: 'JavaScript Submit', endpoint: '/api/submissions/submit', payload: { problemId, language: 'javascript', code: 'function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const diff = target - nums[i];\n    if (map.has(diff)) return [map.get(diff), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}' } },
    { name: 'Java Submit', endpoint: '/api/submissions/submit', payload: { problemId, language: 'java', code: 'class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    java.util.Map<Integer, Integer> map = new java.util.HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n      int diff = target - nums[i];\n      if (map.containsKey(diff)) return new int[]{map.get(diff), i};\n      map.put(nums[i], i);\n    }\n    return new int[]{};\n  }\n}' } },
    { name: 'Wrong Answer', endpoint: '/api/submissions/submit', payload: { problemId, language: 'python', code: 'def twoSum(nums, target):\n    return [99, 99]' } },
    { name: 'Syntax Error', endpoint: '/api/submissions/run', payload: { problemId, language: 'python', code: 'def twoSum(nums, target\n    return 0' } },
    { name: 'Runtime Error', endpoint: '/api/submissions/run', payload: { problemId, language: 'python', code: 'def twoSum(nums, target):\n    return 1 / 0' } },
    { name: 'Infinite Loop (Timeout)', endpoint: '/api/submissions/run', payload: { problemId, language: 'python', code: 'def twoSum(nums, target):\n    while True: pass' } },
  ];

  const results = [];
  for (const test of testCases) {
    console.log(`Executing ${test.name}...`);
    const res = await executeApi(test.endpoint, test.payload, token);
    const timings = res.data?.timings || {};
    results.push({
      name: test.name,
      status: res.statusCode,
      passed: res.data?.passed ?? res.data?.status ?? (res.data?.error ? res.data.error : 'N/A'),
      elapsedMs: res.elapsed,
      problemQueryMs: timings.problemQueryMs ?? 0,
      executionMs: timings.executionMs ?? 0,
      dbSaveMs: timings.dbSaveMs ?? 0,
    });
  }

  console.log('\n======================================================');
  console.log('          DEVORBIT PIPELINE TIMING BENCHMARK          ');
  console.log('======================================================');
  console.table(results);
}

runBenchmark().catch(console.error);
