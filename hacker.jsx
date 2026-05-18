const { useState, useRef, useEffect } = React;

const API_HOST = window.location.hostname || "127.0.0.1";
const LOCAL_API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const LOCAL_BACKEND_API_BASE = `${LOCAL_API_PROTOCOL}//${API_HOST}:4000`;
const CONFIGURED_BACKEND_API_BASE_RAW = (
  window.__CODEARENA_CONFIG__?.backendApiBase ||
  document.querySelector('meta[name="codearena-backend-api-base"]')?.content ||
  ""
).trim();
const IS_LOCAL_FRONTEND = API_HOST === "127.0.0.1" || API_HOST === "localhost";
const USES_SAME_ORIGIN_BACKEND = CONFIGURED_BACKEND_API_BASE_RAW.toLowerCase() === "same-origin";
const CONFIGURED_BACKEND_API_BASE = USES_SAME_ORIGIN_BACKEND
  ? ""
  : CONFIGURED_BACKEND_API_BASE_RAW.replace(/\/+$/, "");
const BACKEND_API_BASE = CONFIGURED_BACKEND_API_BASE_RAW
  ? CONFIGURED_BACKEND_API_BASE
  : (IS_LOCAL_FRONTEND ? LOCAL_BACKEND_API_BASE : null);
const BACKEND_API_TARGET = USES_SAME_ORIGIN_BACKEND
  ? `${window.location.origin}/api/...`
  : (BACKEND_API_BASE || "backend API (not configured)");
const BACKEND_API_CONFIGURATION_ERROR = 'Backend API is not configured for this deployment. Set <meta name="codearena-backend-api-base" content="https://your-backend.example.com"> in index.html, or use content="same-origin" only when this host proxies /api requests to your backend.';
const AUTH_SESSION_STORAGE_KEY = "codearena.authSession";
const EMPTY_CURRENT_USER = {
  id: "",
  role: "",
  email: "",
  name: "",
  usn: "",
  department: "",
  verified: false,
  createdAt: null,
  lastLoginAt: null,
  loginCount: 0,
  badgeTier: null,
  badgeLabel: null,
  badgeIds: [],
  solvedProblemCount: 0,
  badgeUpdatedAt: null,
};
const ACHIEVEMENT_BADGES = Object.freeze({
  SILVER: {
    label: "Silver Solver",
    shortLabel: "Silver",
    icon: "◇",
    color: "#e2e8f0",
    border: "#94a3b8",
    background: "linear-gradient(135deg, rgba(226,232,240,0.22), rgba(148,163,184,0.10))",
  },
  GOLD: {
    label: "Gold Solver",
    shortLabel: "Gold",
    icon: "✦",
    color: "#fde68a",
    border: "#f59e0b",
    background: "linear-gradient(135deg, rgba(250,204,21,0.24), rgba(245,158,11,0.10))",
  },
});

function getAchievementBadgeMeta(tier) {
  return ACHIEVEMENT_BADGES[String(tier || "").toUpperCase()] || null;
}

function normalizeAuthenticatedUser(user = {}, fallback = {}) {
  return {
    ...EMPTY_CURRENT_USER,
    ...fallback,
    id: user.id || fallback.id || "",
    role: user.role || fallback.role || "",
    email: user.email || fallback.email || "",
    name: user.name || "",
    usn: user.usn || "",
    department: user.department || "",
    verified: Boolean(user.verified),
    createdAt: user.createdAt || fallback.createdAt || null,
    lastLoginAt: user.lastLoginAt || fallback.lastLoginAt || null,
    loginCount: Number(user.loginCount || 0),
    badgeTier: user.badgeTier || null,
    badgeLabel: user.badgeLabel || null,
    badgeIds: Array.isArray(user.badgeIds) ? user.badgeIds : [],
    solvedProblemCount: Number(user.solvedProblemCount || 0),
    badgeUpdatedAt: user.badgeUpdatedAt || null,
  };
}

function DevOrbitLogo({ onClick, lightSurface = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"inline-flex",
        alignItems:"center",
        gap:10,
        cursor:onClick ? "pointer" : "default",
        userSelect:"none",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill={lightSurface ? "#EEF2FF" : "#111827"} />
        <ellipse cx="15" cy="15" rx="11" ry="5.8" transform="rotate(-18 15 15)" stroke="#7C6AF7" strokeWidth="2" />
        <ellipse cx="15" cy="15" rx="7.4" ry="11.2" transform="rotate(28 15 15)" stroke="#4FD1C5" strokeWidth="1.6" strokeDasharray="4 4" />
        <circle cx="15" cy="15" r="4.2" fill="#4FD1C5" />
        <circle cx="24" cy="10" r="2.3" fill="#FFC01E" />
      </svg>
      <span
        style={{
          fontFamily:"'Space Grotesk',sans-serif",
          fontWeight:800,
          fontSize:20,
          color:lightSurface ? "#111827" : "#F4F5FF",
          letterSpacing:"-0.5px",
        }}
      >
        DevOrbit
      </span>
    </div>
  );
}

function AchievementBadge({ tier, compact = false }) {
  const badge = getAchievementBadgeMeta(tier);
  if (!badge) return null;

  return (
    <span
      style={{
        display:"inline-flex",
        alignItems:"center",
        gap:compact ? 5 : 7,
        padding:compact ? "4px 8px" : "8px 12px",
        borderRadius:999,
        border:`1px solid ${badge.border}`,
        background:badge.background,
        color:badge.color,
        fontSize:compact ? 11 : 12,
        fontWeight:700,
        letterSpacing:"0.06em",
        textTransform:"uppercase",
      }}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {compact ? badge.shortLabel : badge.label}
    </span>
  );
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim();

    if (snippet.startsWith("<")) {
      throw new Error(
        `Expected JSON from ${response.url || BACKEND_API_TARGET}, but received HTML. Check the configured backend API URL.`
      );
    }

    throw new Error(
      `Backend returned invalid JSON (${contentType}).${snippet ? ` Response started with: ${snippet}` : ""}`
    );
  }
}

function buildBackendApiUrl(path) {
  if (!BACKEND_API_BASE && BACKEND_API_BASE !== "") {
    throw new Error(BACKEND_API_CONFIGURATION_ERROR);
  }

  return `${BACKEND_API_BASE}${path}`;
}

function createAuthHeaders(token, hasBody = false) {
  return {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPortalDate(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameValue(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function mapProblemRecord(problem) {
  if (!problem) return null;

  const starterCode = problem.starterCode && typeof problem.starterCode === "object"
    ? problem.starterCode
    : { javascript: "", python: "", java: "" };

  return {
    id: problem.number ?? problem.legacyId ?? problem.id,
    dbId: problem.id,
    number: problem.number ?? problem.legacyId ?? null,
    slug: problem.slug || "",
    title: problem.title || "Untitled Problem",
    fnName: problem.fnName || "",
    difficulty: problem.difficulty || "Medium",
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    acceptance: problem.acceptance || "Custom",
    description: problem.description || problem.statement || "",
    examples: Array.isArray(problem.examples) ? problem.examples : [],
    constraints: Array.isArray(problem.constraints) ? problem.constraints : [],
    starterCode: {
      javascript: starterCode.javascript || "",
      python: starterCode.python || "",
      java: starterCode.java || "",
    },
    testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
    samples: Array.isArray(problem.samples) ? problem.samples : [],
    createdAt: problem.createdAt || null,
    updatedAt: problem.updatedAt || null,
  };
}

function resolveSubmissionProblemKey(submission, availableProblems = []) {
  const matchedProblem = availableProblems.find((problem) => (
    sameValue(problem.dbId, submission.problemId)
    || sameValue(problem.id, submission.problem?.number)
    || sameValue(problem.id, submission.problem?.legacyId)
    || sameValue(problem.dbId, submission.problem?.id)
    || sameValue(problem.id, submission.problemId)
  ));

  return matchedProblem?.id
    ?? submission.problem?.number
    ?? submission.problem?.legacyId
    ?? null;
}

function deriveSubmissionProgress(submissions, availableProblems = []) {
  const solved = new Set();
  const attempted = new Set();

  (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
    const problemKey = resolveSubmissionProblemKey(submission, availableProblems);
    if (problemKey === null || problemKey === undefined) return;

    if (submission.status === "ACCEPTED") {
      solved.add(problemKey);
      attempted.delete(problemKey);
      return;
    }

    if (!solved.has(problemKey)) {
      attempted.add(problemKey);
    }
  });

  return { solved, attempted };
}

function mapAssignmentRecord(assignment) {
  if (!assignment) return null;

  const problems = Array.isArray(assignment.problems)
    ? assignment.problems.map(mapProblemRecord).filter(Boolean)
    : [];

  return {
    id: assignment.id,
    title: assignment.title || "Untitled Test",
    level: assignment.difficulty || "Mixed",
    difficulty: assignment.difficulty || "Mixed",
    duration: Number(assignment.durationMinutes || 60),
    durationMinutes: Number(assignment.durationMinutes || 60),
    status: assignment.status || "DRAFT",
    startsAt: assignment.startsAt || null,
    endsAt: assignment.endsAt || null,
    createdAt: assignment.createdAt || null,
    updatedAt: assignment.updatedAt || null,
    attempt: assignment.attempt || null,
    date: formatPortalDate(assignment.startsAt || assignment.createdAt),
    questions: problems.map((problem) => problem.id),
    questionIds: problems.map((problem) => problem.id),
    problemDbIds: problems.map((problem) => problem.dbId),
    problems,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HIDDEN REFERENCE SOLUTIONS  (never shown to student – merged silently in bg)
// ─────────────────────────────────────────────────────────────────────────────
const REFERENCE_SOLUTIONS = {
  1: {
    javascript: `
function twoSum(nums, target) {
  let map = {};
  for (let i = 0; i < nums.length; i++) {
    let complement = target - nums[i];
    if (map[complement] !== undefined) {
      return [map[complement], i];
    }
    map[nums[i]] = i;
  }
}`,
    python: `
def twoSum(nums, target):
    num_map = {}
    for i in range(len(nums)):
        complement = target - nums[i]
        if complement in num_map:
            return [num_map[complement], i]
        num_map[nums[i]] = i`,
    java: `
import java.util.HashMap;
public class TwoSum {
  public static int[] twoSum(int[] nums, int target) {
    HashMap<Integer, Integer> map = new HashMap<>();
    for(int i = 0; i < nums.length; i++){
      int complement = target - nums[i];
      if(map.containsKey(complement)){
        return new int[]{map.get(complement), i};
      }
      map.put(nums[i], i);
    }
    return new int[]{};
  }
}`,
  },
  5: {
    javascript: `
function addTwoNumbers(l1, l2) {
  const result = [];
  let carry = 0;
  let i = 0;

  while (i < l1.length || i < l2.length || carry) {
    const sum = (l1[i] || 0) + (l2[i] || 0) + carry;
    result.push(sum % 10);
    carry = Math.floor(sum / 10);
    i += 1;
  }

  return result;
}`,
    python: `
def addTwoNumbers(l1, l2):
    result = []
    carry = 0
    i = 0

    while i < len(l1) or i < len(l2) or carry:
        total = (l1[i] if i < len(l1) else 0) + (l2[i] if i < len(l2) else 0) + carry
        result.append(total % 10)
        carry = total // 10
        i += 1

    return result`,
    java: `
class Solution {
    public int[] addTwoNumbers(int[] l1, int[] l2) {
        java.util.ArrayList<Integer> digits = new java.util.ArrayList<>();
        int carry = 0;
        int i = 0;

        while (i < l1.length || i < l2.length || carry > 0) {
            int total = (i < l1.length ? l1[i] : 0) + (i < l2.length ? l2[i] : 0) + carry;
            digits.add(total % 10);
            carry = total / 10;
            i++;
        }

        int[] result = new int[digits.size()];
        for (int index = 0; index < digits.size(); index++) {
            result[index] = digits.get(index);
        }
        return result;
    }
}`,
  },
  6: {
    javascript: `
function lengthOfLongestSubstring(s) {
  let left = 0;
  let best = 0;
  const seen = new Map();

  for (let right = 0; right < s.length; right += 1) {
    const ch = s[right];
    if (seen.has(ch) && seen.get(ch) >= left) {
      left = seen.get(ch) + 1;
    }
    seen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }

  return best;
}`,
    python: `
def lengthOfLongestSubstring(s):
    left = 0
    best = 0
    seen = {}

    for right, ch in enumerate(s):
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1
        seen[ch] = right
        best = max(best, right - left + 1)

    return best`,
    java: `
class Solution {
    public int lengthOfLongestSubstring(String s) {
        java.util.HashMap<Character, Integer> seen = new java.util.HashMap<>();
        int left = 0;
        int best = 0;

        for (int right = 0; right < s.length(); right++) {
            char ch = s.charAt(right);
            if (seen.containsKey(ch) && seen.get(ch) >= left) {
                left = seen.get(ch) + 1;
            }
            seen.put(ch, right);
            best = Math.max(best, right - left + 1);
        }

        return best;
    }
}`,
  },
  7: {
    javascript: `
function findMedianSortedArrays(nums1, nums2) {
  const merged = [];
  let i = 0;
  let j = 0;

  while (i < nums1.length || j < nums2.length) {
    if (j >= nums2.length || (i < nums1.length && nums1[i] <= nums2[j])) {
      merged.push(nums1[i]);
      i += 1;
    } else {
      merged.push(nums2[j]);
      j += 1;
    }
  }

  const mid = Math.floor(merged.length / 2);
  if (merged.length % 2 === 1) return merged[mid];
  return (merged[mid - 1] + merged[mid]) / 2;
}`,
    python: `
def findMedianSortedArrays(nums1, nums2):
    merged = []
    i = 0
    j = 0

    while i < len(nums1) or j < len(nums2):
        if j >= len(nums2) or (i < len(nums1) and nums1[i] <= nums2[j]):
            merged.append(nums1[i])
            i += 1
        else:
            merged.append(nums2[j])
            j += 1

    mid = len(merged) // 2
    if len(merged) % 2 == 1:
        return merged[mid]
    return (merged[mid - 1] + merged[mid]) / 2`,
    java: `
class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        int[] merged = new int[nums1.length + nums2.length];
        int i = 0;
        int j = 0;
        int index = 0;

        while (i < nums1.length || j < nums2.length) {
            if (j >= nums2.length || (i < nums1.length && nums1[i] <= nums2[j])) {
                merged[index++] = nums1[i++];
            } else {
                merged[index++] = nums2[j++];
            }
        }

        int mid = merged.length / 2;
        if (merged.length % 2 == 1) {
            return merged[mid];
        }
        return (merged[mid - 1] + merged[mid]) / 2.0;
    }
}`,
  },
  8: {
    javascript: `
function longestPalindrome(s) {
  if (s.length < 2) return s;

  let start = 0;
  let end = 0;

  function expand(left, right) {
    while (left >= 0 && right < s.length && s[left] === s[right]) {
      left -= 1;
      right += 1;
    }
    return [left + 1, right - 1];
  }

  for (let i = 0; i < s.length; i += 1) {
    const [oddStart, oddEnd] = expand(i, i);
    const [evenStart, evenEnd] = expand(i, i + 1);

    if (oddEnd - oddStart > end - start) {
      start = oddStart;
      end = oddEnd;
    }
    if (evenEnd - evenStart > end - start) {
      start = evenStart;
      end = evenEnd;
    }
  }

  return s.slice(start, end + 1);
}`,
    python: `
def longestPalindrome(s):
    if len(s) < 2:
        return s

    start = 0
    end = 0

    def expand(left, right):
        while left >= 0 and right < len(s) and s[left] == s[right]:
            left -= 1
            right += 1
        return left + 1, right - 1

    for i in range(len(s)):
        odd_start, odd_end = expand(i, i)
        even_start, even_end = expand(i, i + 1)

        if odd_end - odd_start > end - start:
            start, end = odd_start, odd_end
        if even_end - even_start > end - start:
            start, end = even_start, even_end

    return s[start:end + 1]`,
    java: `
class Solution {
    public String longestPalindrome(String s) {
        if (s.length() < 2) {
            return s;
        }

        int start = 0;
        int end = 0;

        for (int i = 0; i < s.length(); i++) {
            int odd = expand(s, i, i);
            int even = expand(s, i, i + 1);
            int length = Math.max(odd, even);

            if (length > end - start + 1) {
                start = i - (length - 1) / 2;
                end = i + length / 2;
            }
        }

        return s.substring(start, end + 1);
    }

    private int expand(String s, int left, int right) {
        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
            left--;
            right++;
        }
        return right - left - 1;
    }
}`,
  },
  9: {
    javascript: `
function convert(s, numRows) {
  if (numRows === 1 || s.length <= numRows) return s;

  const rows = Array.from({ length: numRows }, () => "");
  let row = 0;
  let step = 1;

  for (const ch of s) {
    rows[row] += ch;
    if (row === 0) step = 1;
    if (row === numRows - 1) step = -1;
    row += step;
  }

  return rows.join("");
}`,
    python: `
def convert(s, numRows):
    if numRows == 1 or len(s) <= numRows:
        return s

    rows = [""] * numRows
    row = 0
    step = 1

    for ch in s:
        rows[row] += ch
        if row == 0:
            step = 1
        elif row == numRows - 1:
            step = -1
        row += step

    return "".join(rows)`,
    java: `
class Solution {
    public String convert(String s, int numRows) {
        if (numRows == 1 || s.length() <= numRows) {
            return s;
        }

        StringBuilder[] rows = new StringBuilder[numRows];
        for (int i = 0; i < numRows; i++) {
            rows[i] = new StringBuilder();
        }

        int row = 0;
        int step = 1;

        for (int i = 0; i < s.length(); i++) {
            rows[row].append(s.charAt(i));
            if (row == 0) {
                step = 1;
            } else if (row == numRows - 1) {
                step = -1;
            }
            row += step;
        }

        StringBuilder result = new StringBuilder();
        for (StringBuilder builder : rows) {
            result.append(builder);
        }
        return result.toString();
    }
}`,
  },
  10: {
    javascript: `
function isPalindrome(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;
  let reversedHalf = 0;
  while (x > reversedHalf) {
    reversedHalf = reversedHalf * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === reversedHalf || x === Math.floor(reversedHalf / 10);
}`,
    python: `
def isPalindrome(x):
    if x < 0 or (x % 10 == 0 and x != 0):
        return False
    reversed_half = 0
    while x > reversed_half:
        reversed_half = reversed_half * 10 + x % 10
        x //= 10
    return x == reversed_half or x == reversed_half // 10`,
    java: `
class Solution {
    public boolean isPalindrome(int x) {
        if (x < 0 || (x % 10 == 0 && x != 0)) {
            return false;
        }
        int reversedHalf = 0;
        while (x > reversedHalf) {
            reversedHalf = reversedHalf * 10 + x % 10;
            x /= 10;
        }
        return x == reversedHalf || x == reversedHalf / 10;
    }
}`,
  },
  11: {
    javascript: `
function romanToInt(s) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const current = values[s[i]];
    const next = values[s[i + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total;
}`,
    python: `
def romanToInt(s):
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    for i, ch in enumerate(s):
        current = values[ch]
        next_value = values[s[i + 1]] if i + 1 < len(s) else 0
        total += -current if current < next_value else current
    return total`,
    java: `
class Solution {
    public int romanToInt(String s) {
        java.util.HashMap<Character, Integer> values = new java.util.HashMap<>();
        values.put('I', 1);
        values.put('V', 5);
        values.put('X', 10);
        values.put('L', 50);
        values.put('C', 100);
        values.put('D', 500);
        values.put('M', 1000);

        int total = 0;
        for (int i = 0; i < s.length(); i++) {
            int current = values.get(s.charAt(i));
            int next = i + 1 < s.length() ? values.get(s.charAt(i + 1)) : 0;
            total += current < next ? -current : current;
        }
        return total;
    }
}`,
  },
  12: {
    javascript: `
function longestCommonPrefix(strs) {
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i += 1) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}`,
    python: `
def longestCommonPrefix(strs):
    prefix = strs[0]
    for word in strs[1:]:
        while not word.startswith(prefix):
            prefix = prefix[:-1]
            if prefix == "":
                return ""
    return prefix`,
    java: `
class Solution {
    public String longestCommonPrefix(String[] strs) {
        String prefix = strs[0];
        for (int i = 1; i < strs.length; i++) {
            while (!strs[i].startsWith(prefix)) {
                prefix = prefix.substring(0, prefix.length() - 1);
                if (prefix.isEmpty()) {
                    return "";
                }
            }
        }
        return prefix;
    }
}`,
  },
  13: {
    javascript: `
function removeDuplicates(nums) {
  if (nums.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < nums.length; read += 1) {
    if (nums[read] !== nums[read - 1]) {
      nums[write] = nums[read];
      write += 1;
    }
  }
  return write;
}`,
    python: `
def removeDuplicates(nums):
    if not nums:
        return 0
    write = 1
    for read in range(1, len(nums)):
        if nums[read] != nums[read - 1]:
            nums[write] = nums[read]
            write += 1
    return write`,
    java: `
class Solution {
    public int removeDuplicates(int[] nums) {
        if (nums.length == 0) {
            return 0;
        }
        int write = 1;
        for (int read = 1; read < nums.length; read++) {
            if (nums[read] != nums[read - 1]) {
                nums[write] = nums[read];
                write++;
            }
        }
        return write;
    }
}`,
  },
  14: {
    javascript: `
function removeElement(nums, val) {
  let write = 0;
  for (let read = 0; read < nums.length; read += 1) {
    if (nums[read] !== val) {
      nums[write] = nums[read];
      write += 1;
    }
  }
  return write;
}`,
    python: `
def removeElement(nums, val):
    write = 0
    for read in range(len(nums)):
        if nums[read] != val:
            nums[write] = nums[read]
            write += 1
    return write`,
    java: `
class Solution {
    public int removeElement(int[] nums, int val) {
        int write = 0;
        for (int read = 0; read < nums.length; read++) {
            if (nums[read] != val) {
                nums[write] = nums[read];
                write++;
            }
        }
        return write;
    }
}`,
  },
  15: {
    javascript: `
function strStr(haystack, needle) {
  return haystack.indexOf(needle);
}`,
    python: `
def strStr(haystack, needle):
    return haystack.find(needle)`,
    java: `
class Solution {
    public int strStr(String haystack, String needle) {
        return haystack.indexOf(needle);
    }
}`,
  },
  16: {
    javascript: `
function searchInsert(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return left;
}`,
    python: `
def searchInsert(nums, target):
    left = 0
    right = len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return left`,
    java: `
class Solution {
    public int searchInsert(int[] nums, int target) {
        int left = 0;
        int right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) {
                return mid;
            }
            if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return left;
    }
}`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RUN JAVASCRIPT: merges reference solution + student code, executes in browser
// ─────────────────────────────────────────────────────────────────────────────
function runJavaScript(studentCode, refCode, testCases, fnName) {
  const normalize = (value) => String(value).replace(/\s/g, "");
  const helperSource = `
function ListNode(val, next = null) {
  this.val = val;
  this.next = next;
}

function TreeNode(val, left = null, right = null) {
  this.val = val;
  this.left = left;
  this.right = right;
}
`;
  const buildLinkedList = (values) => {
    const dummy = { next: null };
    let current = dummy;
    for (const value of values) {
      current.next = { val: value, next: null };
      current = current.next;
    }
    return dummy.next;
  };
  const buildCycledList = (values, pos) => {
    const head = buildLinkedList(values);
    if (!head || pos < 0) return head;

    let cycleNode = null;
    let current = head;
    let index = 0;
    while (current.next) {
      if (index === pos) cycleNode = current;
      current = current.next;
      index += 1;
    }
    if (index === pos) cycleNode = current;
    current.next = cycleNode;
    return head;
  };
  const linkedListToArray = (head) => {
    const values = [];
    const seen = new Set();
    let current = head;
    while (current && !seen.has(current) && values.length < 2000) {
      seen.add(current);
      values.push(current.val);
      current = current.next;
    }
    return values;
  };
  const buildTree = (values) => {
    if (!Array.isArray(values) || values.length === 0 || values[0] === null) return null;
    const root = { val: values[0], left: null, right: null };
    const queue = [root];
    let index = 1;

    while (queue.length && index < values.length) {
      const node = queue.shift();

      if (index < values.length && values[index] !== null) {
        node.left = { val: values[index], left: null, right: null };
        queue.push(node.left);
      }
      index += 1;

      if (index < values.length && values[index] !== null) {
        node.right = { val: values[index], left: null, right: null };
        queue.push(node.right);
      }
      index += 1;
    }

    return root;
  };
  const prepareArgs = (rawArgs) => {
    if (fnName === "deleteDuplicates") return [buildLinkedList(rawArgs[0])];
    if (fnName === "hasCycle") return [buildCycledList(rawArgs[0], rawArgs[1])];
    if (fnName === "mergeKLists") return [rawArgs[0].map(buildLinkedList)];
    if (fnName === "inorderTraversal" || fnName === "isBalanced") return [buildTree(rawArgs[0])];
    if (fnName === "isSameTree") return [buildTree(rawArgs[0]), buildTree(rawArgs[1])];
    if (fnName === "hasPathSum") return [buildTree(rawArgs[0]), rawArgs[1]];
    return rawArgs;
  };
  const serializeResult = (output, args, rawArgs) => {
    if (fnName === "reverseString") return JSON.stringify(args[0]);
    if (fnName === "removeDuplicates") {
      const k = Math.max(0, Number(output) || 0);
      return JSON.stringify({ k, nums: args[0].slice(0, k) });
    }
    if (fnName === "removeElement") {
      const k = Math.max(0, Number(output) || 0);
      const kept = [...args[0].slice(0, k)].sort((a, b) => a - b);
      return JSON.stringify({ k, nums: kept });
    }
    if (fnName === "merge") {
      return JSON.stringify(args[0].slice(0, rawArgs[1] + rawArgs[3]));
    }
    if (fnName === "deleteDuplicates") {
      return JSON.stringify(linkedListToArray(output));
    }
    if (fnName === "mergeKLists") {
      return JSON.stringify(linkedListToArray(output));
    }
    if (fnName === "findSubstring") {
      return JSON.stringify([...(output || [])].sort((a, b) => a - b));
    }
    if (fnName === "solveSudoku") {
      return JSON.stringify(args[0]);
    }
    if (fnName === "solveNQueens") {
      const boards = [...(output || [])].map((board) => [...board]);
      boards.sort((left, right) => left.join("|").localeCompare(right.join("|")));
      return JSON.stringify(boards);
    }
    return JSON.stringify(output);
  };
  const matchesExpected = (actual, expected) => {
    const normalizedActual = normalize(actual);
    const normalizedExpected = normalize(expected);
    if (normalizedActual === normalizedExpected) return true;

    const actualNumber = Number(normalizedActual);
    const expectedNumber = Number(normalizedExpected);
    return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && Math.abs(actualNumber - expectedNumber) < 1e-9;
  };

  return testCases.map((tc) => {
    try {
      // Reference solution loads first (hidden baseline),
      // then student code runs on top and overrides the function if defined correctly.
      const merged = `
        ${helperSource}
        ${refCode}
        // ── Student submission ──
        ${studentCode}
        return typeof ${fnName} === 'function' ? ${fnName} : null;
      `;
      const fn = new Function(merged)();
      if (!fn) throw new Error(`Function "${fnName}" not found. Make sure your function is named exactly: ${fnName}`);

      const rawArgs = JSON.parse(`[${tc.input}]`);
      const args = prepareArgs(rawArgs);
      const output = fn(...args);
      const actual = serializeResult(output, args, rawArgs);
      const pass = matchesExpected(actual, tc.expected);
      return { ...tc, actual, status: pass ? "pass" : "fail", error: null };
    } catch (err) {
      return { ...tc, actual: null, status: "error", error: err.message };
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMS DATABASE
// ─────────────────────────────────────────────────────────────────────────────
async function requestExecutionResult({ language, sourceCode, fnName, testCases }) {
  try {
    const response = await fetch(buildBackendApiUrl("/api/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        sourceCode,
        fnName,
        testCases,
      }),
    });

    const data = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(data.error || "Execution failed.");
    }

    return data;
  } catch (error) {
    throw new Error(
      `${error.message || "Execution failed."} Judge0 execution needs the local server running with "node hacker.js" and internet access.`
    );
  }
}

const PROBLEMS = [
  {
    id: 1,
    title: "Two Sum",
    fnName: "twoSum",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    acceptance: "49.1%",
    description: `Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to target</em>.<br/><br/>
You may assume that each input would have exactly one solution, and you may not use the same element twice.<br/><br/>
You can return the answer in any order.`,
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]", explanation: "" },
    ],
    constraints: ["2 ≤ nums.length ≤ 10⁴", "-10⁹ ≤ nums[i] ≤ 10⁹", "Only one valid answer exists."],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Write your solution here

}`,
      python: `def twoSum(nums, target):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here

    }
}`,
    },
    testCases: [
      { input: "[2,7,11,15], 9", expected: "[0,1]" },
      { input: "[3,2,4], 6",     expected: "[1,2]" },
      { input: "[3,3], 6",       expected: "[0,1]" },
    ],
  },
  {
    id: 2,
    title: "Reverse a String",
    fnName: "reverseString",
    difficulty: "Easy",
    tags: ["String", "Two Pointers"],
    acceptance: "75.3%",
    description: `Write a function that reverses a string. The input string is given as an array of characters <code>s</code>.<br/><br/>
You must do this by modifying the input array in-place with O(1) extra memory.`,
    examples: [
      { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]', explanation: "" },
    ],
    constraints: ["1 ≤ s.length ≤ 10⁵", "s[i] is a printable ASCII character."],
    starterCode: {
      javascript: `function reverseString(s) {
  // Write your solution here

}`,
      python: `def reverseString(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public void reverseString(char[] s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '["h","e","l","l","o"]',    expected: '["o","l","l","e","h"]' },
      { input: '["H","a","n","n","a","h"]', expected: '["h","a","n","n","a","H"]' },
    ],
  },
  {
    id: 3,
    title: "Valid Parentheses",
    fnName: "isValid",
    difficulty: "Easy",
    tags: ["String", "Stack"],
    acceptance: "40.7%",
    description: `Given a string <code>s</code> containing just the characters <code>'('</code>, <code>')'</code>, <code>'{'</code>, <code>'}'</code>, <code>'['</code> and <code>']'</code>, determine if the input string is valid.`,
    examples: [
      { input: 's = "()"', output: "true", explanation: "" },
      { input: 's = "()[]{}"', output: "true", explanation: "" },
      { input: 's = "(]"', output: "false", explanation: "" },
      { input: 's = "([])"', output: "true", explanation: "" },
    ],
    constraints: ["1 ≤ s.length ≤ 10⁴", "s consists of parentheses only '()[]{}'."],
    starterCode: {
      javascript: `function isValid(s) {
  // Write your solution here

}`,
      python: `def isValid(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"()"',     expected: "true"  },
      { input: '"()[]{}"', expected: "true"  },
      { input: '"(]"',     expected: "false" },
      { input: '"([])"',   expected: "true"  },
      { input: '"([)]"',   expected: "false" },
    ],
  },
  {
    id: 4,
    title: "Maximum Subarray",
    fnName: "maxSubArray",
    difficulty: "Hard",
    tags: ["Array", "Dynamic Programming"],
    acceptance: "50.0%",
    description: `Given an integer array <code>nums</code>, find the subarray with the largest sum, and return its sum.`,
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "The subarray [4,-1,2,1] has the largest sum 6." },
    ],
    constraints: ["1 ≤ nums.length ≤ 10⁵", "-10⁴ ≤ nums[i] ≤ 10⁴"],
    starterCode: {
      javascript: `function maxSubArray(nums) {
  // Write your solution here

}`,
      python: `def maxSubArray(nums):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", expected: "6"  },
      { input: "[1]",                       expected: "1"  },
      { input: "[5,4,-1,7,8]",              expected: "23" },
    ],
  },
  {
    id: 5,
    title: "Add Two Numbers",
    fnName: "addTwoNumbers",
    difficulty: "Medium",
    tags: ["Linked List", "Math"],
    acceptance: "Custom",
    description: `You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each node contains a single digit.<br/><br/>
For this playground, each linked list is represented as an array of digits in reverse order, such as <code>[2,4,3]</code> for the number 342.<br/><br/>
Add the two numbers and return the sum in the same reverse-order array format.`,
    examples: [
      { input: "l1 = [2,4,3], l2 = [5,6,4]", output: "[7,0,8]", explanation: "342 + 465 = 807, so the reversed digit array is [7,0,8]." },
      { input: "l1 = [0], l2 = [0]", output: "[0]", explanation: "" },
      { input: "l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]", output: "[8,9,9,9,0,0,0,1]", explanation: "" },
    ],
    constraints: ["1 <= l1.length, l2.length <= 100", "0 <= l1[i], l2[i] <= 9", "The lists do not contain leading zeroes except the number 0 itself."],
    starterCode: {
      javascript: `/**
 * @param {number[]} l1
 * @param {number[]} l2
 * @return {number[]}
 */
function addTwoNumbers(l1, l2) {
  // Write your solution here

}`,
      python: `def addTwoNumbers(l1, l2):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int[] addTwoNumbers(int[] l1, int[] l2) {
        // Write your solution here

    }
}`,
    },
    testCases: [
      { input: "[2,4,3], [5,6,4]", expected: "[7,0,8]" },
      { input: "[0], [0]", expected: "[0]" },
      { input: "[9,9,9,9,9,9,9], [9,9,9,9]", expected: "[8,9,9,9,0,0,0,1]" },
    ],
  },
  {
    id: 6,
    title: "Longest Substring Without Repeating Characters",
    fnName: "lengthOfLongestSubstring",
    difficulty: "Medium",
    tags: ["String", "Sliding Window"],
    acceptance: "Custom",
    description: `Given a string <code>s</code>, find the length of the longest substring without repeating characters.`,
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc", with the length of 3.' },
      { input: 's = "bbbbb"', output: "1", explanation: 'The answer is "b", with the length of 1.' },
      { input: 's = "pwwkew"', output: "3", explanation: 'The answer is "wke", with the length of 3. "pwke" is a subsequence, not a substring.' },
    ],
    constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols, and spaces."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
  // Write your solution here

}`,
      python: `def lengthOfLongestSubstring(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"abcabcbb"', expected: "3" },
      { input: '"bbbbb"', expected: "1" },
      { input: '"pwwkew"', expected: "3" },
    ],
  },
  {
    id: 7,
    title: "Median of Two Sorted Arrays",
    fnName: "findMedianSortedArrays",
    difficulty: "Medium",
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    acceptance: "Custom",
    description: `Given two sorted arrays <code>nums1</code> and <code>nums2</code> of size <code>m</code> and <code>n</code>, return the median of the two sorted arrays.<br/><br/>
The target time complexity is <code>O(log(m + n))</code>.`,
    examples: [
      { input: "nums1 = [1,3], nums2 = [2]", output: "2.00000", explanation: "The merged array is [1,2,3] and the median is 2." },
      { input: "nums1 = [1,2], nums2 = [3,4]", output: "2.50000", explanation: "The merged array is [1,2,3,4] and the median is (2 + 3) / 2 = 2.5." },
    ],
    constraints: ["nums1.length == m", "nums2.length == n", "0 <= m <= 1000", "0 <= n <= 1000", "1 <= m + n <= 2000", "-10^6 <= nums1[i], nums2[i] <= 10^6"],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums1
 * @param {number[]} nums2
 * @return {number}
 */
function findMedianSortedArrays(nums1, nums2) {
  // Write your solution here

}`,
      python: `def findMedianSortedArrays(nums1, nums2):
    # Write your solution here
    pass`,
      java: `class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,3], [2]", expected: "2" },
      { input: "[1,2], [3,4]", expected: "2.5" },
      { input: "[0,0], [0,0]", expected: "0" },
    ],
  },
  {
    id: 8,
    title: "Longest Palindromic Substring",
    fnName: "longestPalindrome",
    difficulty: "Medium",
    tags: ["String", "Expand Around Center"],
    acceptance: "Custom",
    description: `Given a string <code>s</code>, return the longest palindromic substring in <code>s</code>.`,
    examples: [
      { input: 's = "babad"', output: '"bab"', explanation: '"aba" is also a valid answer.' },
      { input: 's = "cbbd"', output: '"bb"', explanation: "" },
    ],
    constraints: ["1 <= s.length <= 1000", "s consists of digits and English letters."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {string}
 */
function longestPalindrome(s) {
  // Write your solution here

}`,
      python: `def longestPalindrome(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String longestPalindrome(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"cbbd"', expected: '"bb"' },
      { input: '"forgeeksskeegfor"', expected: '"geeksskeeg"' },
      { input: '"anana"', expected: '"anana"' },
    ],
  },
  {
    id: 9,
    title: "Zigzag Conversion",
    fnName: "convert",
    difficulty: "Medium",
    tags: ["String", "Simulation"],
    acceptance: "Custom",
    description: `The string <code>s</code> is written in a zigzag pattern on a given number of rows, then read line by line.<br/><br/>
Return the string formed after that zigzag conversion.`,
    examples: [
      { input: 's = "PAYPALISHIRING", numRows = 3', output: '"PAHNAPLSIIGYIR"', explanation: "" },
      { input: 's = "PAYPALISHIRING", numRows = 4', output: '"PINALSIGYAHRPI"', explanation: "" },
      { input: 's = "A", numRows = 1', output: '"A"', explanation: "" },
    ],
    constraints: ["1 <= s.length <= 1000", "s consists of English letters, ',' and '.'", "1 <= numRows <= 1000"],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {number} numRows
 * @return {string}
 */
function convert(s, numRows) {
  // Write your solution here

}`,
      python: `def convert(s, numRows):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String convert(String s, int numRows) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"PAYPALISHIRING", 3', expected: '"PAHNAPLSIIGYIR"' },
      { input: '"PAYPALISHIRING", 4', expected: '"PINALSIGYAHRPI"' },
      { input: '"A", 1', expected: '"A"' },
    ],
  },
  {
    id: 10,
    title: "Palindrome Number",
    fnName: "isPalindrome",
    difficulty: "Easy",
    tags: ["Math"],
    acceptance: "Custom",
    description: `Given an integer <code>x</code>, return <code>true</code> if <code>x</code> is a palindrome, and <code>false</code> otherwise.`,
    examples: [
      { input: "x = 121", output: "true", explanation: "121 reads the same from left to right and right to left." },
      { input: "x = -121", output: "false", explanation: "From right to left it becomes 121-, so it is not a palindrome." },
      { input: "x = 10", output: "false", explanation: "From right to left it becomes 01, so it is not a palindrome." },
    ],
    constraints: ["-2^31 <= x <= 2^31 - 1"],
    starterCode: {
      javascript: `/**
 * @param {number} x
 * @return {boolean}
 */
function isPalindrome(x) {
  // Write your solution here

}`,
      python: `def isPalindrome(x):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isPalindrome(int x) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "121", expected: "true" },
      { input: "-121", expected: "false" },
      { input: "10", expected: "false" },
    ],
  },
  {
    id: 11,
    title: "Roman to Integer",
    fnName: "romanToInt",
    difficulty: "Easy",
    tags: ["Hash Table", "Math", "String"],
    acceptance: "Custom",
    description: `Roman numerals are represented by seven different symbols: <code>I</code>, <code>V</code>, <code>X</code>, <code>L</code>, <code>C</code>, <code>D</code>, and <code>M</code>.<br/><br/>
Given a roman numeral, convert it to an integer.`,
    examples: [
      { input: 's = "III"', output: "3", explanation: "III = 3." },
      { input: 's = "LVIII"', output: "58", explanation: "L = 50, V = 5, III = 3." },
      { input: 's = "MCMXCIV"', output: "1994", explanation: "M = 1000, CM = 900, XC = 90 and IV = 4." },
    ],
    constraints: ["1 <= s.length <= 15", "s contains only the characters 'I', 'V', 'X', 'L', 'C', 'D', and 'M'."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function romanToInt(s) {
  // Write your solution here

}`,
      python: `def romanToInt(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int romanToInt(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"III"', expected: "3" },
      { input: '"LVIII"', expected: "58" },
      { input: '"MCMXCIV"', expected: "1994" },
    ],
  },
  {
    id: 12,
    title: "Longest Common Prefix",
    fnName: "longestCommonPrefix",
    difficulty: "Easy",
    tags: ["String"],
    acceptance: "Custom",
    description: `Write a function to find the longest common prefix string amongst an array of strings.<br/><br/>If there is no common prefix, return an empty string <code>""</code>.`,
    examples: [
      { input: 'strs = ["flower","flow","flight"]', output: '"fl"', explanation: "" },
      { input: 'strs = ["dog","racecar","car"]', output: '""', explanation: "There is no common prefix among the input strings." },
    ],
    constraints: ["1 <= strs.length <= 200", "0 <= strs[i].length <= 200", "strs[i] consists of only lowercase English letters if it is non-empty."],
    starterCode: {
      javascript: `/**
 * @param {string[]} strs
 * @return {string}
 */
function longestCommonPrefix(strs) {
  // Write your solution here

}`,
      python: `def longestCommonPrefix(strs):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String longestCommonPrefix(String[] strs) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '["flower","flow","flight"]', expected: '"fl"' },
      { input: '["dog","racecar","car"]', expected: '""' },
      { input: '["interview","internet","internal"]', expected: '"inter"' },
    ],
  },
  {
    id: 13,
    title: "Remove Duplicates from Sorted Array",
    fnName: "removeDuplicates",
    difficulty: "Easy",
    tags: ["Array", "Two Pointers"],
    acceptance: "Custom",
    description: `Given an integer array <code>nums</code> sorted in non-decreasing order, remove the duplicates in-place such that each unique element appears only once.<br/><br/>
Return the number of unique elements <code>k</code>. For this playground, the judge displays the checked result as <code>{"k":2,"nums":[1,2]}</code>, which means the first <code>k</code> elements must match that prefix.`,
    examples: [
      { input: "nums = [1,1,2]", output: "k = 2, nums prefix = [1,2]", explanation: "The first two elements of nums should be 1 and 2." },
      { input: "nums = [0,0,1,1,1,2,2,3,3,4]", output: "k = 5, nums prefix = [0,1,2,3,4]", explanation: "" },
    ],
    constraints: ["1 <= nums.length <= 3 * 10^4", "-100 <= nums[i] <= 100", "nums is sorted in non-decreasing order."],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function removeDuplicates(nums) {
  // Write your solution here

}`,
      python: `def removeDuplicates(nums):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int removeDuplicates(int[] nums) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,1,2]", expected: '{"k":2,"nums":[1,2]}' },
      { input: "[0,0,1,1,1,2,2,3,3,4]", expected: '{"k":5,"nums":[0,1,2,3,4]}' },
      { input: "[1,2,3]", expected: '{"k":3,"nums":[1,2,3]}' },
    ],
  },
  {
    id: 14,
    title: "Remove Element",
    fnName: "removeElement",
    difficulty: "Easy",
    tags: ["Array", "Two Pointers"],
    acceptance: "Custom",
    description: `Given an integer array <code>nums</code> and an integer <code>val</code>, remove all occurrences of <code>val</code> in-place and return the number of elements that are not equal to <code>val</code>.<br/><br/>
The order of the remaining elements may change. For this playground, the checked result is shown as <code>{"k":2,"nums":[2,2]}</code>, where the kept prefix is sorted before comparison.`,
    examples: [
      { input: "nums = [3,2,2,3], val = 3", output: "k = 2, nums prefix = [2,2]", explanation: "" },
      { input: "nums = [0,1,2,2,3,0,4,2], val = 2", output: "k = 5, nums prefix has [0,0,1,3,4] in any order", explanation: "" },
    ],
    constraints: ["0 <= nums.length <= 100", "0 <= nums[i] <= 50", "0 <= val <= 100"],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} val
 * @return {number}
 */
function removeElement(nums, val) {
  // Write your solution here

}`,
      python: `def removeElement(nums, val):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int removeElement(int[] nums, int val) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[3,2,2,3], 3", expected: '{"k":2,"nums":[2,2]}' },
      { input: "[0,1,2,2,3,0,4,2], 2", expected: '{"k":5,"nums":[0,0,1,3,4]}' },
      { input: "[2], 3", expected: '{"k":1,"nums":[2]}' },
    ],
  },
  {
    id: 15,
    title: "Find the Index of the First Occurrence in a String",
    fnName: "strStr",
    difficulty: "Easy",
    tags: ["String", "Two Pointers"],
    acceptance: "Custom",
    description: `Given two strings <code>needle</code> and <code>haystack</code>, return the index of the first occurrence of <code>needle</code> in <code>haystack</code>, or <code>-1</code> if <code>needle</code> is not part of <code>haystack</code>.`,
    examples: [
      { input: 'haystack = "sadbutsad", needle = "sad"', output: "0", explanation: '"sad" occurs at index 0 and 6, and the first occurrence is at index 0.' },
      { input: 'haystack = "leetcode", needle = "leeto"', output: "-1", explanation: '"leeto" did not occur in "leetcode".' },
    ],
    constraints: ["1 <= haystack.length, needle.length <= 10^4", "haystack and needle consist of only lowercase English characters."],
    starterCode: {
      javascript: `/**
 * @param {string} haystack
 * @param {string} needle
 * @return {number}
 */
function strStr(haystack, needle) {
  // Write your solution here

}`,
      python: `def strStr(haystack, needle):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int strStr(String haystack, String needle) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"sadbutsad", "sad"', expected: "0" },
      { input: '"leetcode", "leeto"', expected: "-1" },
      { input: '"aaaaa", "bba"', expected: "-1" },
    ],
  },
  {
    id: 16,
    title: "Search Insert Position",
    fnName: "searchInsert",
    difficulty: "Easy",
    tags: ["Array", "Binary Search"],
    acceptance: "Custom",
    description: `Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be inserted in order.<br/><br/>
You must write an algorithm with <code>O(log n)</code> runtime complexity.`,
    examples: [
      { input: "nums = [1,3,5,6], target = 5", output: "2", explanation: "" },
      { input: "nums = [1,3,5,6], target = 2", output: "1", explanation: "" },
      { input: "nums = [1,3,5,6], target = 7", output: "4", explanation: "" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4", "nums contains distinct values sorted in ascending order.", "-10^4 <= target <= 10^4"],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function searchInsert(nums, target) {
  // Write your solution here

}`,
      python: `def searchInsert(nums, target):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int searchInsert(int[] nums, int target) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,3,5,6], 5", expected: "2" },
      { input: "[1,3,5,6], 2", expected: "1" },
      { input: "[1,3,5,6], 7", expected: "4" },
    ],
  },
  {
    id: 17,
    title: "Plus One",
    fnName: "plusOne",
    difficulty: "Easy",
    tags: ["Array", "Math"],
    acceptance: "Custom",
    description: `You are given a large integer represented as an integer array <code>digits</code>, where each <code>digits[i]</code> is the <code>i</code>th digit of the integer.<br/><br/>
Increment the large integer by one and return the resulting array of digits.`,
    examples: [
      { input: "digits = [1,2,3]", output: "[1,2,4]", explanation: "123 + 1 = 124." },
      { input: "digits = [4,3,2,1]", output: "[4,3,2,2]", explanation: "4321 + 1 = 4322." },
      { input: "digits = [9]", output: "[1,0]", explanation: "9 + 1 = 10." },
    ],
    constraints: ["1 <= digits.length <= 100", "0 <= digits[i] <= 9", "digits does not contain any leading 0's."],
    starterCode: {
      javascript: `/**
 * @param {number[]} digits
 * @return {number[]}
 */
function plusOne(digits) {
  // Write your solution here

}`,
      python: `def plusOne(digits):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int[] plusOne(int[] digits) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,2,3]", expected: "[1,2,4]" },
      { input: "[4,3,2,1]", expected: "[4,3,2,2]" },
      { input: "[9]", expected: "[1,0]" },
    ],
  },
  {
    id: 18,
    title: "Sqrt(x)",
    fnName: "mySqrt",
    difficulty: "Easy",
    tags: ["Math", "Binary Search"],
    acceptance: "Custom",
    description: `Given a non-negative integer <code>x</code>, return the square root of <code>x</code> rounded down to the nearest integer.<br/><br/>
Do not use any built-in exponent function or operator.`,
    examples: [
      { input: "x = 4", output: "2", explanation: "The square root of 4 is 2." },
      { input: "x = 8", output: "2", explanation: "The square root of 8 is 2.828..., and we round down to 2." },
    ],
    constraints: ["0 <= x <= 2^31 - 1"],
    starterCode: {
      javascript: `/**
 * @param {number} x
 * @return {number}
 */
function mySqrt(x) {
  // Write your solution here

}`,
      python: `def mySqrt(x):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int mySqrt(int x) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "4", expected: "2" },
      { input: "8", expected: "2" },
      { input: "0", expected: "0" },
    ],
  },
  {
    id: 19,
    title: "Remove Duplicates from Sorted List",
    fnName: "deleteDuplicates",
    difficulty: "Easy",
    tags: ["Linked List"],
    acceptance: "Custom",
    description: `Given the <code>head</code> of a sorted linked list, delete all duplicates such that each element appears only once.<br/><br/>
The linked list shown in the test cases is built automatically from the array input, and your function should return the deduplicated linked-list head.`,
    examples: [
      { input: "head = [1,1,2]", output: "[1,2]", explanation: "" },
      { input: "head = [1,1,2,3,3]", output: "[1,2,3]", explanation: "" },
    ],
    constraints: ["The number of nodes in the list is in the range [0, 300].", "-100 <= Node.val <= 100", "The list is guaranteed to be sorted in ascending order."],
    starterCode: {
      javascript: `/**
 * @param {ListNode} head
 * @return {ListNode}
 */
function deleteDuplicates(head) {
  // Write your solution here

}`,
      python: `def deleteDuplicates(head):
    # Write your solution here
    pass`,
      java: `class Solution {
    public ListNode deleteDuplicates(ListNode head) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,1,2]", expected: "[1,2]" },
      { input: "[1,1,2,3,3]", expected: "[1,2,3]" },
      { input: "[]", expected: "[]" },
    ],
  },
  {
    id: 20,
    title: "Merge Sorted Array",
    fnName: "merge",
    difficulty: "Easy",
    tags: ["Array", "Two Pointers", "Sorting"],
    acceptance: "Custom",
    description: `You are given two integer arrays <code>nums1</code> and <code>nums2</code>, sorted in non-decreasing order, and two integers <code>m</code> and <code>n</code>.<br/><br/>
Merge <code>nums2</code> into <code>nums1</code> as one sorted array. The judge checks the final merged prefix stored inside <code>nums1</code>.`,
    examples: [
      { input: "nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3", output: "[1,2,2,3,5,6]", explanation: "" },
      { input: "nums1 = [1], m = 1, nums2 = [], n = 0", output: "[1]", explanation: "" },
      { input: "nums1 = [0], m = 0, nums2 = [1], n = 1", output: "[1]", explanation: "" },
    ],
    constraints: ["nums1.length == m + n", "nums2.length == n", "0 <= m, n <= 200", "1 <= m + n <= 200", "-10^9 <= nums1[i], nums2[j] <= 10^9"],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums1
 * @param {number} m
 * @param {number[]} nums2
 * @param {number} n
 * @return {void}
 */
function merge(nums1, m, nums2, n) {
  // Write your solution here

}`,
      python: `def merge(nums1, m, nums2, n):
    # Write your solution here
    pass`,
      java: `class Solution {
    public void merge(int[] nums1, int m, int[] nums2, int n) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,2,3,0,0,0], 3, [2,5,6], 3", expected: "[1,2,2,3,5,6]" },
      { input: "[1], 1, [], 0", expected: "[1]" },
      { input: "[0], 0, [1], 1", expected: "[1]" },
    ],
  },
  {
    id: 21,
    title: "Binary Tree Inorder Traversal",
    fnName: "inorderTraversal",
    difficulty: "Easy",
    tags: ["Stack", "Tree", "Depth-First Search", "Binary Tree"],
    acceptance: "Custom",
    description: `Given the <code>root</code> of a binary tree, return the inorder traversal of its nodes' values.<br/><br/>
The binary tree shown in the test cases is built automatically from the level-order array input.`,
    examples: [
      { input: "root = [1,null,2,3]", output: "[1,3,2]", explanation: "" },
      { input: "root = []", output: "[]", explanation: "" },
      { input: "root = [1,2,3]", output: "[2,1,3]", explanation: "" },
    ],
    constraints: ["The number of nodes in the tree is in the range [0, 100].", "-100 <= Node.val <= 100"],
    starterCode: {
      javascript: `/**
 * @param {TreeNode} root
 * @return {number[]}
 */
function inorderTraversal(root) {
  // Write your solution here

}`,
      python: `def inorderTraversal(root):
    # Write your solution here
    pass`,
      java: `class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,null,2,3]", expected: "[1,3,2]" },
      { input: "[]", expected: "[]" },
      { input: "[1,2,3]", expected: "[2,1,3]" },
    ],
  },
  {
    id: 22,
    title: "Same Tree",
    fnName: "isSameTree",
    difficulty: "Easy",
    tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"],
    acceptance: "Custom",
    description: `Given the roots of two binary trees <code>p</code> and <code>q</code>, write a function to check if they are the same or not.<br/><br/>
Both trees are built automatically from the level-order array inputs shown in the test cases.`,
    examples: [
      { input: "p = [1,2,3], q = [1,2,3]", output: "true", explanation: "" },
      { input: "p = [1,2], q = [1,null,2]", output: "false", explanation: "" },
      { input: "p = [1,2,1], q = [1,1,2]", output: "false", explanation: "" },
    ],
    constraints: ["The number of nodes in both trees is in the range [0, 100].", "-10^4 <= Node.val <= 10^4"],
    starterCode: {
      javascript: `/**
 * @param {TreeNode} p
 * @param {TreeNode} q
 * @return {boolean}
 */
function isSameTree(p, q) {
  // Write your solution here

}`,
      python: `def isSameTree(p, q):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,2,3], [1,2,3]", expected: "true" },
      { input: "[1,2], [1,null,2]", expected: "false" },
      { input: "[1,2,1], [1,1,2]", expected: "false" },
    ],
  },
  {
    id: 23,
    title: "Balanced Binary Tree",
    fnName: "isBalanced",
    difficulty: "Easy",
    tags: ["Tree", "Depth-First Search", "Binary Tree"],
    acceptance: "Custom",
    description: `Given a binary tree, determine if it is height-balanced.<br/><br/>
The binary tree is built automatically from the level-order array input shown in each test case.`,
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "true", explanation: "" },
      { input: "root = [1,2,2,3,3,null,null,4,4]", output: "false", explanation: "" },
      { input: "root = []", output: "true", explanation: "" },
    ],
    constraints: ["The number of nodes in the tree is in the range [0, 5000].", "-10^4 <= Node.val <= 10^4"],
    starterCode: {
      javascript: `/**
 * @param {TreeNode} root
 * @return {boolean}
 */
function isBalanced(root) {
  // Write your solution here

}`,
      python: `def isBalanced(root):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isBalanced(TreeNode root) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[3,9,20,null,null,15,7]", expected: "true" },
      { input: "[1,2,2,3,3,null,null,4,4]", expected: "false" },
      { input: "[]", expected: "true" },
    ],
  },
  {
    id: 24,
    title: "Path Sum",
    fnName: "hasPathSum",
    difficulty: "Easy",
    tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"],
    acceptance: "Custom",
    description: `Given the <code>root</code> of a binary tree and an integer <code>targetSum</code>, return <code>true</code> if the tree has a root-to-leaf path such that adding up all the values equals <code>targetSum</code>.<br/><br/>
The binary tree is built automatically from the level-order array input shown in each test case.`,
    examples: [
      { input: "root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22", output: "true", explanation: "" },
      { input: "root = [1,2,3], targetSum = 5", output: "false", explanation: "" },
      { input: "root = [], targetSum = 0", output: "false", explanation: "" },
    ],
    constraints: ["The number of nodes in the tree is in the range [0, 5000].", "-1000 <= Node.val <= 1000", "-1000 <= targetSum <= 1000"],
    starterCode: {
      javascript: `/**
 * @param {TreeNode} root
 * @param {number} targetSum
 * @return {boolean}
 */
function hasPathSum(root, targetSum) {
  // Write your solution here

}`,
      python: `def hasPathSum(root, targetSum):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean hasPathSum(TreeNode root, int targetSum) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[5,4,8,11,null,13,4,7,2,null,null,null,1], 22", expected: "true" },
      { input: "[1,2,3], 5", expected: "false" },
      { input: "[], 0", expected: "false" },
    ],
  },
  {
    id: 25,
    title: "Pascal's Triangle II",
    fnName: "getRow",
    difficulty: "Easy",
    tags: ["Array", "Dynamic Programming"],
    acceptance: "Custom",
    description: `Given an integer <code>rowIndex</code>, return the <code>rowIndex</code>th (0-indexed) row of Pascal's triangle.`,
    examples: [
      { input: "rowIndex = 3", output: "[1,3,3,1]", explanation: "" },
      { input: "rowIndex = 0", output: "[1]", explanation: "" },
      { input: "rowIndex = 1", output: "[1,1]", explanation: "" },
    ],
    constraints: ["0 <= rowIndex <= 33"],
    starterCode: {
      javascript: `/**
 * @param {number} rowIndex
 * @return {number[]}
 */
function getRow(rowIndex) {
  // Write your solution here

}`,
      python: `def getRow(rowIndex):
    # Write your solution here
    pass`,
      java: `class Solution {
    public List<Integer> getRow(int rowIndex) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "3", expected: "[1,3,3,1]" },
      { input: "0", expected: "[1]" },
      { input: "1", expected: "[1,1]" },
    ],
  },
  {
    id: 26,
    title: "Valid Palindrome",
    fnName: "isPalindromeString",
    difficulty: "Easy",
    tags: ["Two Pointers", "String"],
    acceptance: "Custom",
    description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.<br/><br/>
This playground uses the function name <code>isPalindromeString</code> to avoid clashing with Palindrome Number.`,
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true", explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: 's = "race a car"', output: "false", explanation: '"raceacar" is not a palindrome.' },
      { input: 's = " "', output: "true", explanation: "An empty cleaned string is a palindrome." },
    ],
    constraints: ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindromeString(s) {
  // Write your solution here

}`,
      python: `def isPalindromeString(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isPalindromeString(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"A man, a plan, a canal: Panama"', expected: "true" },
      { input: '"race a car"', expected: "false" },
      { input: '" "', expected: "true" },
    ],
  },
  {
    id: 27,
    title: "Single Number",
    fnName: "singleNumber",
    difficulty: "Easy",
    tags: ["Array", "Bit Manipulation"],
    acceptance: "Custom",
    description: `Given a non-empty array of integers <code>nums</code>, every element appears twice except for one. Find that single one.`,
    examples: [
      { input: "nums = [2,2,1]", output: "1", explanation: "" },
      { input: "nums = [4,1,2,1,2]", output: "4", explanation: "" },
      { input: "nums = [1]", output: "1", explanation: "" },
    ],
    constraints: ["1 <= nums.length <= 3 * 10^4", "-3 * 10^4 <= nums[i] <= 3 * 10^4", "Each element in the array appears twice except for one element which appears only once."],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function singleNumber(nums) {
  // Write your solution here

}`,
      python: `def singleNumber(nums):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int singleNumber(int[] nums) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[2,2,1]", expected: "1" },
      { input: "[4,1,2,1,2]", expected: "4" },
      { input: "[1]", expected: "1" },
    ],
  },
  {
    id: 28,
    title: "Linked List Cycle",
    fnName: "hasCycle",
    difficulty: "Easy",
    tags: ["Hash Table", "Linked List", "Two Pointers"],
    acceptance: "Custom",
    description: `Given <code>head</code>, the head of a linked list, determine if the linked list has a cycle in it.<br/><br/>
The linked list is built automatically from the array and <code>pos</code> input shown in the test cases. The <code>pos</code> value indicates which node the tail connects to, or <code>-1</code> if there is no cycle.`,
    examples: [
      { input: "head = [3,2,0,-4], pos = 1", output: "true", explanation: "" },
      { input: "head = [1,2], pos = 0", output: "true", explanation: "" },
      { input: "head = [1], pos = -1", output: "false", explanation: "" },
    ],
    constraints: ["The number of nodes in the list is in the range [0, 10^4].", "-10^5 <= Node.val <= 10^5", "pos is -1 or a valid index in the linked-list."],
    starterCode: {
      javascript: `/**
 * @param {ListNode} head
 * @return {boolean}
 */
function hasCycle(head) {
  // Write your solution here

}`,
      python: `def hasCycle(head):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean hasCycle(ListNode head) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[3,2,0,-4], 1", expected: "true" },
      { input: "[1,2], 0", expected: "true" },
      { input: "[1], -1", expected: "false" },
    ],
  },
  {
    id: 29,
    title: "Regular Expression Matching",
    fnName: "isMatch",
    difficulty: "Hard",
    tags: ["String", "Dynamic Programming", "Recursion"],
    acceptance: "Custom",
    description: `Given an input string <code>s</code> and a pattern <code>p</code>, implement regular expression matching with support for <code>.</code> and <code>*</code>.<br/><br/>
<code>.</code> matches any single character, and <code>*</code> matches zero or more of the preceding element. Return whether the pattern matches the entire string.`,
    examples: [
      { input: 's = "aa", p = "a"', output: "false", explanation: '"a" does not match the entire string "aa".' },
      { input: 's = "aa", p = "a*"', output: "true", explanation: '"a*" can represent "aa".' },
      { input: 's = "ab", p = ".*"', output: "true", explanation: '".*" matches any sequence.' },
    ],
    constraints: ["1 <= s.length <= 20", "1 <= p.length <= 20", "s contains only lowercase English letters.", "p contains only lowercase English letters, '.', and '*'.", "Each '*' always has a valid previous character."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {string} p
 * @return {boolean}
 */
function isMatch(s, p) {
  // Write your solution here

}`,
      python: `def isMatch(s, p):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isMatch(String s, String p) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"aa", "a"', expected: "false" },
      { input: '"aa", "a*"', expected: "true" },
      { input: '"ab", ".*"', expected: "true" },
    ],
  },
  {
    id: 30,
    title: "Merge k Sorted Lists",
    fnName: "mergeKLists",
    difficulty: "Hard",
    tags: ["Linked List", "Divide and Conquer", "Heap"],
    acceptance: "Custom",
    description: `You are given an array of <code>k</code> sorted linked lists. Merge all the linked lists into one sorted linked list and return it.<br/><br/>
In this playground, each linked list is represented by an array of values, and the runner automatically converts those arrays into linked lists before calling your function.`,
    examples: [
      { input: "lists = [[1,4,5],[1,3,4],[2,6]]", output: "[1,1,2,3,4,4,5,6]", explanation: "" },
      { input: "lists = []", output: "[]", explanation: "" },
      { input: "lists = [[]]", output: "[]", explanation: "" },
    ],
    constraints: ["0 <= lists.length <= 10^4", "0 <= lists[i].length <= 500", "-10^4 <= lists[i][j] <= 10^4", "Each list is sorted in ascending order.", "The total number of nodes across all lists is at most 10^4."],
    starterCode: {
      javascript: `/**
 * @param {ListNode[]} lists
 * @return {ListNode}
 */
function mergeKLists(lists) {
  // Write your solution here

}`,
      python: `def mergeKLists(lists):
    # Write your solution here
    pass`,
      java: `class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[[1,4,5],[1,3,4],[2,6]]", expected: "[1,1,2,3,4,4,5,6]" },
      { input: "[]", expected: "[]" },
      { input: "[[]]", expected: "[]" },
    ],
  },
  {
    id: 31,
    title: "Substring with Concatenation of All Words",
    fnName: "findSubstring",
    difficulty: "Hard",
    tags: ["Hash Table", "String", "Sliding Window"],
    acceptance: "Custom",
    description: `You are given a string <code>s</code> and an array of strings <code>words</code>. All strings in <code>words</code> have the same length.<br/><br/>
Return all starting indices of substrings in <code>s</code> that are a concatenation of each word in <code>words</code> exactly once and without any intervening characters.`,
    examples: [
      { input: 's = "barfoothefoobarman", words = ["foo","bar"]', output: "[0,9]", explanation: "" },
      { input: 's = "wordgoodgoodgoodbestword", words = ["word","good","best","word"]', output: "[]", explanation: "" },
      { input: 's = "barfoofoobarthefoobarman", words = ["bar","foo","the"]', output: "[6,9,12]", explanation: "" },
    ],
    constraints: ["1 <= s.length <= 10^4", "1 <= words.length <= 5000", "1 <= words[i].length <= 30", "All words[i] have the same length."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {string[]} words
 * @return {number[]}
 */
function findSubstring(s, words) {
  // Write your solution here

}`,
      python: `def findSubstring(s, words):
    # Write your solution here
    pass`,
      java: `class Solution {
    public List<Integer> findSubstring(String s, String[] words) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"barfoothefoobarman", ["foo","bar"]', expected: "[0,9]" },
      { input: '"wordgoodgoodgoodbestword", ["word","good","best","word"]', expected: "[]" },
      { input: '"barfoofoobarthefoobarman", ["bar","foo","the"]', expected: "[6,9,12]" },
    ],
  },
  {
    id: 32,
    title: "Longest Valid Parentheses",
    fnName: "longestValidParentheses",
    difficulty: "Hard",
    tags: ["String", "Dynamic Programming", "Stack"],
    acceptance: "Custom",
    description: `Given a string containing just the characters <code>(</code> and <code>)</code>, return the length of the longest valid (well-formed) parentheses substring.`,
    examples: [
      { input: 's = "(()"', output: "2", explanation: 'The longest valid parentheses substring is "()".' },
      { input: 's = ")()())"', output: "4", explanation: 'The longest valid parentheses substring is "()()".' },
      { input: 's = ""', output: "0", explanation: "" },
    ],
    constraints: ["0 <= s.length <= 3 * 10^4", "s[i] is '(' or ')'."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function longestValidParentheses(s) {
  // Write your solution here

}`,
      python: `def longestValidParentheses(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int longestValidParentheses(String s) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"(()"', expected: "2" },
      { input: '")()())"', expected: "4" },
      { input: '""', expected: "0" },
    ],
  },
  {
    id: 33,
    title: "Sudoku Solver",
    fnName: "solveSudoku",
    difficulty: "Hard",
    tags: ["Array", "Backtracking", "Matrix"],
    acceptance: "Custom",
    description: `Write a program to solve a Sudoku puzzle by filling the empty cells.<br/><br/>
In this playground, the board is represented as a <code>9 x 9</code> array of strings, where <code>"."</code> represents an empty cell. Modify the board in-place.`,
    examples: [
      { input: 'board = [["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]]', output: 'Solved board', explanation: "The judge checks the fully solved board after your function modifies it." },
    ],
    constraints: ["board.length == 9", "board[i].length == 9", 'board[i][j] is a digit from "1" to "9" or ".".', "It is guaranteed that the input board has only one solution."],
    starterCode: {
      javascript: `/**
 * @param {string[][]} board
 * @return {void}
 */
function solveSudoku(board) {
  // Write your solution here

}`,
      python: `def solveSudoku(board):
    # Write your solution here
    pass`,
      java: `class Solution {
    public void solveSudoku(String[][] board) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '[["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]]', expected: '[["5","3","4","6","7","8","9","1","2"],["6","7","2","1","9","5","3","4","8"],["1","9","8","3","4","2","5","6","7"],["8","5","9","7","6","1","4","2","3"],["4","2","6","8","5","3","7","9","1"],["7","1","3","9","2","4","8","5","6"],["9","6","1","5","3","7","2","8","4"],["2","8","7","4","1","9","6","3","5"],["3","4","5","2","8","6","1","7","9"]]' },
    ],
  },
  {
    id: 34,
    title: "First Missing Positive",
    fnName: "firstMissingPositive",
    difficulty: "Hard",
    tags: ["Array", "Hash Table"],
    acceptance: "Custom",
    description: `Given an unsorted integer array <code>nums</code>, return the smallest missing positive integer.<br/><br/>
Your algorithm should run in <code>O(n)</code> time and use <code>O(1)</code> auxiliary space.`,
    examples: [
      { input: "nums = [1,2,0]", output: "3", explanation: "" },
      { input: "nums = [3,4,-1,1]", output: "2", explanation: "" },
      { input: "nums = [7,8,9,11,12]", output: "1", explanation: "" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-2^31 <= nums[i] <= 2^31 - 1"],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function firstMissingPositive(nums) {
  // Write your solution here

}`,
      python: `def firstMissingPositive(nums):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int firstMissingPositive(int[] nums) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[1,2,0]", expected: "3" },
      { input: "[3,4,-1,1]", expected: "2" },
      { input: "[7,8,9,11,12]", expected: "1" },
    ],
  },
  {
    id: 35,
    title: "Wildcard Matching",
    fnName: "isWildcardMatch",
    difficulty: "Hard",
    tags: ["String", "Dynamic Programming", "Greedy"],
    acceptance: "Custom",
    description: `Given an input string <code>s</code> and a pattern <code>p</code>, implement wildcard pattern matching with support for <code>?</code> and <code>*</code>.<br/><br/>
<code>?</code> matches any single character, and <code>*</code> matches any sequence of characters, including the empty sequence. The match must cover the entire string.`,
    examples: [
      { input: 's = "aa", p = "a"', output: "false", explanation: "" },
      { input: 's = "aa", p = "*"', output: "true", explanation: "" },
      { input: 's = "cb", p = "?a"', output: "false", explanation: "" },
    ],
    constraints: ["0 <= s.length, p.length <= 2000", "s contains only lowercase English letters.", "p contains only lowercase English letters, '?' and '*'."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {string} p
 * @return {boolean}
 */
function isWildcardMatch(s, p) {
  // Write your solution here

}`,
      python: `def isWildcardMatch(s, p):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isWildcardMatch(String s, String p) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"aa", "a"', expected: "false" },
      { input: '"aa", "*"', expected: "true" },
      { input: '"cb", "?a"', expected: "false" },
    ],
  },
  {
    id: 36,
    title: "N-Queens",
    fnName: "solveNQueens",
    difficulty: "Hard",
    tags: ["Array", "Backtracking"],
    acceptance: "Custom",
    description: `The n-queens puzzle is the problem of placing <code>n</code> queens on an <code>n x n</code> chessboard such that no two queens attack each other.<br/><br/>
Return all distinct solutions. The judge normalizes the outer solution order for comparison, so any correct solution order is accepted.`,
    examples: [
      { input: "n = 4", output: '[["..Q.","Q...","...Q",".Q.."],[".Q..","...Q","Q...","..Q."]]', explanation: "" },
      { input: "n = 1", output: '[["Q"]]', explanation: "" },
    ],
    constraints: ["1 <= n <= 9"],
    starterCode: {
      javascript: `/**
 * @param {number} n
 * @return {string[][]}
 */
function solveNQueens(n) {
  // Write your solution here

}`,
      python: `def solveNQueens(n):
    # Write your solution here
    pass`,
      java: `class Solution {
    public List<List<String>> solveNQueens(int n) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "4", expected: '[["..Q.","Q...","...Q",".Q.."],[".Q..","...Q","Q...","..Q."]]' },
      { input: "1", expected: '[["Q"]]' },
    ],
  },
  {
    id: 37,
    title: "Permutation Sequence",
    fnName: "getPermutation",
    difficulty: "Hard",
    tags: ["Math", "Recursion"],
    acceptance: "Custom",
    description: `The set <code>[1,2,3,...,n]</code> contains a total of <code>n!</code> unique permutations. Return the <code>k</code>th permutation sequence.`,
    examples: [
      { input: "n = 3, k = 3", output: '"213"', explanation: "" },
      { input: "n = 4, k = 9", output: '"2314"', explanation: "" },
      { input: "n = 3, k = 1", output: '"123"', explanation: "" },
    ],
    constraints: ["1 <= n <= 9", "1 <= k <= n!"],
    starterCode: {
      javascript: `/**
 * @param {number} n
 * @param {number} k
 * @return {string}
 */
function getPermutation(n, k) {
  // Write your solution here

}`,
      python: `def getPermutation(n, k):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String getPermutation(int n, int k) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "3, 3", expected: '"213"' },
      { input: "4, 9", expected: '"2314"' },
      { input: "3, 1", expected: '"123"' },
    ],
  },
  {
    id: 38,
    title: "Minimum Window Substring",
    fnName: "minWindow",
    difficulty: "Hard",
    tags: ["Hash Table", "String", "Sliding Window"],
    acceptance: "Custom",
    description: `Given two strings <code>s</code> and <code>t</code>, return the minimum window substring of <code>s</code> such that every character in <code>t</code>, including duplicates, is included in the window.<br/><br/>
If there is no such substring, return an empty string.`,
    examples: [
      { input: 's = "ADOBECODEBANC", t = "ABC"', output: '"BANC"', explanation: "" },
      { input: 's = "a", t = "a"', output: '"a"', explanation: "" },
      { input: 's = "a", t = "aa"', output: '""', explanation: "" },
    ],
    constraints: ["1 <= s.length, t.length <= 10^5", "s and t consist of English letters."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {string} t
 * @return {string}
 */
function minWindow(s, t) {
  // Write your solution here

}`,
      python: `def minWindow(s, t):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String minWindow(String s, String t) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"ADOBECODEBANC", "ABC"', expected: '"BANC"' },
      { input: '"a", "a"', expected: '"a"' },
      { input: '"a", "aa"', expected: '""' },
    ],
  },
  {
    id: 39,
    title: "Largest Rectangle in Histogram",
    fnName: "largestRectangleArea",
    difficulty: "Hard",
    tags: ["Array", "Stack", "Monotonic Stack"],
    acceptance: "Custom",
    description: `Given an array of integers <code>heights</code> representing the histogram's bar height where the width of each bar is <code>1</code>, return the area of the largest rectangle in the histogram.`,
    examples: [
      { input: "heights = [2,1,5,6,2,3]", output: "10", explanation: "" },
      { input: "heights = [2,4]", output: "4", explanation: "" },
    ],
    constraints: ["1 <= heights.length <= 10^5", "0 <= heights[i] <= 10^4"],
    starterCode: {
      javascript: `/**
 * @param {number[]} heights
 * @return {number}
 */
function largestRectangleArea(heights) {
  // Write your solution here

}`,
      python: `def largestRectangleArea(heights):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int largestRectangleArea(int[] heights) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: "[2,1,5,6,2,3]", expected: "10" },
      { input: "[2,4]", expected: "4" },
      { input: "[2,1,2]", expected: "3" },
    ],
  },
  {
    id: 40,
    title: "Scramble String",
    fnName: "isScramble",
    difficulty: "Hard",
    tags: ["String", "Dynamic Programming", "Memoization"],
    acceptance: "Custom",
    description: `We can scramble a string by recursively partitioning it into two non-empty substrings and swapping them zero or more times. Given two strings <code>s1</code> and <code>s2</code>, return whether <code>s2</code> is a scrambled string of <code>s1</code>.`,
    examples: [
      { input: 's1 = "great", s2 = "rgeat"', output: "true", explanation: "" },
      { input: 's1 = "abcde", s2 = "caebd"', output: "false", explanation: "" },
      { input: 's1 = "a", s2 = "a"', output: "true", explanation: "" },
    ],
    constraints: ["s1.length == s2.length", "1 <= s1.length <= 30", "s1 and s2 consist of lowercase English letters."],
    starterCode: {
      javascript: `/**
 * @param {string} s1
 * @param {string} s2
 * @return {boolean}
 */
function isScramble(s1, s2) {
  // Write your solution here

}`,
      python: `def isScramble(s1, s2):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isScramble(String s1, String s2) {
        // Write your solution here
    }
}`,
    },
    testCases: [
      { input: '"great", "rgeat"', expected: "true" },
      { input: '"abcde", "caebd"', expected: "false" },
      { input: '"a", "a"', expected: "true" },
    ],
  },
];


function ErrorBanner({ errors, onClose }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 64, right: 20, zIndex: 999, width: 390,
      background: "#1a0808", border: "1px solid #ff375f55", borderRadius: 10,
      boxShadow: "0 8px 40px #ff375f18", animation: "slideIn 0.3s ease",
    }}>
      <style>{`
        @keyframes slideIn { from { transform:translateX(420px);opacity:0 } to { transform:translateX(0);opacity:1 } }
        .err-row { white-space:pre-wrap; word-break:break-all; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#ff375f18", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ff375f33", borderRadius: "10px 10px 0 0" }}>
        <span style={{ color: "#ff375f", fontWeight: 700, fontSize: 13 }}>⚠  Error — Check your code</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Errors */}
      <div style={{ padding: 14, maxHeight: 300, overflowY: "auto" }}>
        {errors.map((e, i) => (
          <div key={i} style={{ marginBottom: i < errors.length - 1 ? 12 : 0 }}>
            <div style={{ color: "#ff6b6b", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Case {e.caseNum}:</div>
            <div className="err-row" style={{ background: "#0f0404", border: "1px solid #3a1010", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#ffaaaa", fontFamily: "monospace", lineHeight: 1.6 }}>
              {e.message}
            </div>
          </div>
        ))}

        {/* Hint box */}
        <div style={{ marginTop: 14, padding: "10px 12px", background: "#0a0a18", borderRadius: 8, border: "1px solid #2a2a4e" }}>
          <div style={{ color: "#7c6af7", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>💡 Student Tip</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: "#777", fontSize: 11, lineHeight: 1.8 }}>
            <li>Make sure your <span style={{ color: "#c8c8e8" }}>function name</span> matches exactly (case-sensitive).</li>
            <li>Check for missing <span style={{ color: "#c8c8e8" }}>brackets, colons, or indentation</span>.</li>
            <li>Your function must <span style={{ color: "#c8c8e8" }}>return</span> a value, not just print it.</li>
            <li>Compare your output with the expected output carefully.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScreenShield({ active, message }) {
  if (!active) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 5000,
      background: "#000",
      pointerEvents: "auto",
    }} />
  );
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightCodeLine(line, language) {
  const keywords = {
    javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "new", "try", "catch", "throw", "await", "async", "true", "false", "null", "undefined"],
    python: ["def", "return", "if", "elif", "else", "for", "while", "in", "class", "import", "from", "try", "except", "raise", "True", "False", "None"],
    java: ["public", "private", "protected", "class", "static", "void", "int", "double", "boolean", "String", "return", "if", "else", "for", "while", "new", "true", "false", "null"],
  }[language] || [];
  const keywordPattern = keywords.length ? keywords.map(escapeRegExp).join("|") : "a^";
  const tokenPattern = new RegExp(`(//.*|#.*|"(?:\\\\.|[^"])*"|'(?:\\\\.|[^'])*'|\\b(?:${keywordPattern})\\b|\\b\\d+(?:\\.\\d+)?\\b)`, "g");
  const pieces = [];
  let lastIndex = 0;

  line.replace(tokenPattern, (match, _token, index) => {
    if (index > lastIndex) pieces.push({ text: line.slice(lastIndex, index), color: "#d7dcff" });
    const color = match.startsWith("//") || match.startsWith("#")
      ? "#6f7b95"
      : match.startsWith("\"") || match.startsWith("'")
        ? "#7dd3fc"
        : /^\d/.test(match)
          ? "#fbbf24"
          : "#c4b5fd";
    pieces.push({ text: match, color });
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < line.length) pieces.push({ text: line.slice(lastIndex), color: "#d7dcff" });
  return pieces.length ? pieces : [{ text: " ", color: "#d7dcff" }];
}

function CodeHighlightLayer({ code, language, scrollTop = 0 }) {
  return (
    <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ margin:0, padding:"16px 16px 16px 56px", transform:`translateY(-${scrollTop}px)`, whiteSpace:"pre-wrap", wordBreak:"break-word", color:"#d7dcff", fontFamily:"'JetBrains Mono',monospace", fontSize:13.5, lineHeight:"21px", boxSizing:"border-box" }}>
        {String(code || "").split("\n").map((line, lineIndex) => (
          <div key={lineIndex} style={{ minHeight:21 }}>
            {highlightCodeLine(line, language).map((piece, pieceIndex) => (
              <span key={pieceIndex} style={{ color:piece.color }}>{piece.text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


function CodingPlatform() {
  const defaultAdminProblems = [29, 34, 39]
    .map((problemId) => PROBLEMS.find((problem) => problem.id === problemId))
    .filter(Boolean);
  const defaultAdminTest = {
    id: "",
    title: "Current Test",
    level: "Hard",
    difficulty: "Hard",
    date: "23/03/2026",
    duration: 60,
    questions: [29, 34, 39],
    questionIds: [29, 34, 39],
    problemDbIds: [],
    problems: defaultAdminProblems,
    status: "DRAFT",
    startsAt: null,
    endsAt: null,
    createdAt: null,
  };
  const defaultPreviousTests = [
    { id: "t-2203", name: "Algorithm Sprint 1", date: "22/03/2026", difficulty: "Medium", winner: "Aarav", average: 82 },
    { id: "t-2103", name: "Campus Mock Round", date: "21/03/2026", difficulty: "Hard", winner: "Diya", average: 76 },
    { id: "t-1903", name: "Data Structures Drill", date: "19/03/2026", difficulty: "Easy", winner: "Nikhil", average: 91 },
  ];
  const defaultLeaderboard = [
    {
      username: "Aarav",
      rating: 1920,
      avatarGradient: ["#f6c453", "#ff8f5c"],
      overall: { rank: 1, score: 2478, problemsSolved: 153, timePenalty: "05h 12m", trend: 1 },
      contest: { rank: 1, score: 98, problemsSolved: 5, timePenalty: "08m 12s", trend: 1, timeTaken: "41m 12s" },
      global: { rank: 2, score: 2386, problemsSolved: 148, timePenalty: "05h 47m", trend: 1 },
    },
    {
      username: "Diya",
      rating: 1885,
      avatarGradient: ["#d9dde6", "#8f98a8"],
      overall: { rank: 2, score: 2412, problemsSolved: 149, timePenalty: "05h 34m", trend: 0 },
      contest: { rank: 2, score: 95, problemsSolved: 5, timePenalty: "11m 08s", trend: 0, timeTaken: "44m 08s" },
      global: { rank: 1, score: 2401, problemsSolved: 151, timePenalty: "05h 11m", trend: 1 },
    },
    {
      username: "Karthik",
      rating: 1840,
      avatarGradient: ["#c88a56", "#8f5a3a"],
      overall: { rank: 3, score: 2350, problemsSolved: 144, timePenalty: "06h 02m", trend: -1 },
      contest: { rank: 3, score: 91, problemsSolved: 4, timePenalty: "14m 20s", trend: 1, timeTaken: "47m 20s" },
      global: { rank: 4, score: 2292, problemsSolved: 139, timePenalty: "06h 19m", trend: -1 },
    },
    {
      username: "Meera",
      rating: 1798,
      avatarGradient: ["#7c6af7", "#4fd1c5"],
      overall: { rank: 4, score: 2264, problemsSolved: 138, timePenalty: "06h 40m", trend: 1 },
      contest: { rank: 4, score: 88, problemsSolved: 4, timePenalty: "16m 03s", trend: 0, timeTaken: "49m 03s" },
      global: { rank: 5, score: 2210, problemsSolved: 132, timePenalty: "06h 54m", trend: 1 },
    },
    {
      username: "Rohan",
      rating: 1746,
      avatarGradient: ["#56ccf2", "#2f80ed"],
      overall: { rank: 5, score: 2195, problemsSolved: 131, timePenalty: "07h 05m", trend: -1 },
      contest: { rank: 5, score: 84, problemsSolved: 4, timePenalty: "19m 44s", trend: -1, timeTaken: "53m 44s" },
      global: { rank: 6, score: 2148, problemsSolved: 125, timePenalty: "07h 18m", trend: -1 },
    },
    {
      username: "Anika",
      rating: 1712,
      avatarGradient: ["#ff7eb3", "#ff758c"],
      overall: { rank: 6, score: 2141, problemsSolved: 126, timePenalty: "07h 28m", trend: 1 },
      contest: { rank: 6, score: 82, problemsSolved: 4, timePenalty: "22m 18s", trend: 1, timeTaken: "56m 22s" },
      global: { rank: 7, score: 2084, problemsSolved: 120, timePenalty: "07h 41m", trend: 1 },
    },
    {
      username: "Nikhil",
      rating: 1680,
      avatarGradient: ["#11998e", "#38ef7d"],
      overall: { rank: 7, score: 2098, problemsSolved: 123, timePenalty: "07h 49m", trend: 0 },
      contest: { rank: 7, score: 78, problemsSolved: 3, timePenalty: "25m 07s", trend: -1, timeTaken: "58m 11s" },
      global: { rank: 8, score: 2046, problemsSolved: 118, timePenalty: "08h 03m", trend: 0 },
    },
    {
      username: "Sana",
      rating: 1651,
      avatarGradient: ["#f2994a", "#f2c94c"],
      overall: { rank: 8, score: 2057, problemsSolved: 119, timePenalty: "08h 10m", trend: 1 },
      contest: { rank: 8, score: 74, problemsSolved: 3, timePenalty: "27m 55s", trend: 1, timeTaken: "61m 39s" },
      global: { rank: 9, score: 1994, problemsSolved: 114, timePenalty: "08h 26m", trend: 1 },
    },
  ];
  const defaultActiveUsers = [
    { name: "Aarav", department: "CSE", status: "Solving" },
    { name: "Diya", department: "ISE", status: "Running tests" },
    { name: "Meera", department: "AIML", status: "Reviewing" },
    { name: "Rohan", department: "ECE", status: "Submitted" },
  ];
  const adminTabs = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: "Question Uploads" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "students", label: "Student List" },
    { id: "profile", label: "Profile" },
  ];
  const questionCategories = ["DSA", "SQL", "Other"];
  const createDefaultQuestionUploadForm = () => ({
    title: "",
    category: "DSA",
    difficulty: "Medium",
    fnName: "solve",
    tags: "",
    statement: "",
    constraints: "",
    examples: "",
    testCases: "",
    javascript: "function solve(input) {\n  return input;\n}",
    python: "def solve(input):\n    return input",
    java: "public class Solution {\n  public static String solve(String input) {\n    return input;\n  }\n}",
  });

  const [view, setView]                       = useState("home");
  const [userRole, setUserRole]               = useState(null);
  const [currentUser, setCurrentUser]         = useState(EMPTY_CURRENT_USER);
  const [authToken, setAuthToken]             = useState("");
  const [authModalOpen, setAuthModalOpen]     = useState(false);
  const [authMode, setAuthMode]               = useState("");
  const [authRole, setAuthRole]               = useState("");
  const [authEmail, setAuthEmail]             = useState("");
  const [authPassword, setAuthPassword]       = useState("");
  const [authName, setAuthName]               = useState("");
  const [authUsn, setAuthUsn]                 = useState("");
  const [authDepartment, setAuthDepartment]   = useState("");
  const [authError, setAuthError]             = useState("");
  const [authSubmitting, setAuthSubmitting]   = useState(false);
  const [authPoliciesAccepted, setAuthPoliciesAccepted] = useState(false);
  const [problemBank, setProblemBank]         = useState([]);
  const [problemBankLoading, setProblemBankLoading] = useState(false);
  const [adminAssignments, setAdminAssignments] = useState([]);
  const [adminAssignmentsLoading, setAdminAssignmentsLoading] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [studentNotifications, setStudentNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loginEvents, setLoginEvents]         = useState([]);
  const [portalMessage, setPortalMessage]     = useState("");
  const [portalError, setPortalError]         = useState("");
  const [adminSyncingProblems, setAdminSyncingProblems] = useState(false);
  const [adminCreatingTest, setAdminCreatingTest] = useState(false);
  const [adminStartingTest, setAdminStartingTest] = useState(false);
  const [adminStoppingTest, setAdminStoppingTest] = useState(false);
  const [adminCurrentTest, setAdminCurrentTest] = useState(defaultAdminTest);
  const [previousTests, setPreviousTests]     = useState(defaultPreviousTests);
  const [selectedPreviousTest, setSelectedPreviousTest] = useState(defaultPreviousTests[0]);
  const [leaderboard, setLeaderboard]         = useState([]);
  const [activeUsers, setActiveUsers]         = useState(defaultActiveUsers);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [participantsCount, setParticipantsCount] = useState(defaultActiveUsers.length);
  const [adminTab, setAdminTab]               = useState("overview");
  const [adminTimerSeconds, setAdminTimerSeconds] = useState(defaultAdminTest.duration * 60);
  const [adminWarning, setAdminWarning]       = useState("");
  const [solutionsVisible, setSolutionsVisible] = useState(false);
  const [adminTestReport, setAdminTestReport] = useState(null);
  const [questionUploadForm, setQuestionUploadForm] = useState(createDefaultQuestionUploadForm);
  const [questionUploading, setQuestionUploading] = useState(false);
  const [questionUploadError, setQuestionUploadError] = useState("");
  const [questionUploadSuccess, setQuestionUploadSuccess] = useState("");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState("All");
  const [adminCreateForm, setAdminCreateForm] = useState({
    title: "Fresh Challenge",
    level: "Hard",
    date: "24/03/2026",
    duration: "60",
    questions: defaultAdminProblems.map((problem) => problem.dbId || problem.id),
  });
  const [adminSubmissionProblemId, setAdminSubmissionProblemId] = useState(defaultAdminTest.questions[0]);
  const [adminSubmissionLang, setAdminSubmissionLang] = useState("javascript");
  const [adminSubmissionCode, setAdminSubmissionCode] = useState("");
  const [adminExecution, setAdminExecution]   = useState(null);
  const [adminExecuting, setAdminExecuting]   = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [problemNavigationSource, setProblemNavigationSource] = useState("catalog");
  const [lang, setLang]                       = useState("javascript");
  const [code, setCode]                       = useState("");
  const [activeTab, setActiveTab]             = useState("description");
  const [consoleTab, setConsoleTab]           = useState("testcase");
  const [runResult, setRunResult]             = useState(null);
  const [running, setRunning]                 = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [solved, setSolved]                   = useState(new Set());
  const [filterDiff, setFilterDiff]           = useState("All");
  const [searchQuery, setSearchQuery]         = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardScope, setLeaderboardScope] = useState("All");
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [hoveredLeaderboardRank, setHoveredLeaderboardRank] = useState(null);
  const [leaderboardReady, setLeaderboardReady] = useState(false);
  const [leaderboardUpdating, setLeaderboardUpdating] = useState(true);
  const [contestEntered, setContestEntered]     = useState(false);
  const [contestTimerSeconds, setContestTimerSeconds] = useState(defaultAdminTest.duration * 60);
  const [attemptedProblems, setAttemptedProblems] = useState(new Set());
  const [contestSecurityLocked, setContestSecurityLocked] = useState(false);
  const [contestInstructionsOpen, setContestInstructionsOpen] = useState(false);
  const [contestInstructionsAccepted, setContestInstructionsAccepted] = useState(false);
  const [contestCameraStatus, setContestCameraStatus] = useState("idle");
  const [contestCameraError, setContestCameraError] = useState("");
  const [contestCameraStream, setContestCameraStream] = useState(null);
  const [contestSessionEndsAt, setContestSessionEndsAt] = useState(null);
  const [contestSessionProgress, setContestSessionProgress] = useState({});
  const [contestResult, setContestResult] = useState(null);
  const [finalSubmitConfirmOpen, setFinalSubmitConfirmOpen] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [consoleOpen, setConsoleOpen]         = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [errorBanner, setErrorBanner]         = useState(null);
  const [screenShield, setScreenShield]       = useState(false);
  const [shieldMessage, setShieldMessage]     = useState("Screen capture is disabled in this demo.");
  const textareaRef = useRef(null);
  const adminTextareaRef = useRef(null);
  const contestCameraPreviewRef = useRef(null);
  const shieldTimerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1024);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth || 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const video = contestCameraPreviewRef.current;
    if (!video) return;
    video.srcObject = contestCameraStream || null;
    if (contestCameraStream) {
      video.play().catch(() => {});
    }
  }, [contestCameraStream, view, contestEntered]);
  const triggerShield = (message, duration = 1800) => {
    setShieldMessage(message);
    setScreenShield(true);

    if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
    if (duration > 0) {
      shieldTimerRef.current = setTimeout(() => setScreenShield(false), duration);
    }
  };

  const saveAuthSession = (token, user, role) => {
    try {
      window.localStorage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
        token,
        user,
        role,
      }));
    } catch {
      // Storage can be blocked in private browsing; login should still work for this tab.
    }
  };

  const clearAuthSession = () => {
    try {
      window.localStorage?.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  };

  const performApiRequest = async (path, options = {}) => {
    const hasBody = Boolean(options.body);
    const response = await fetch(buildBackendApiUrl(path), {
      ...options,
      headers: {
        ...createAuthHeaders(authToken, hasBody),
        ...(options.headers || {}),
      },
    });

    const data = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  };

  const loadProblemBank = async () => {
    setProblemBankLoading(true);

    try {
      const data = await performApiRequest("/api/problems?includeContent=1");
      const mappedProblems = Array.isArray(data.problems)
        ? data.problems.map(mapProblemRecord).filter(Boolean)
        : [];
      setProblemBank(mappedProblems);
      return mappedProblems;
    } finally {
      setProblemBankLoading(false);
    }
  };

  const syncProblemBankToDatabase = async (silent = false) => {
    setAdminSyncingProblems(true);

    try {
      await performApiRequest("/api/problems/import", {
        method: "POST",
        body: JSON.stringify({
          problems: PROBLEMS.map((problem) => ({
            number: problem.id,
            title: problem.title,
            slug: problem.slug,
            fnName: problem.fnName,
            difficulty: problem.difficulty,
            tags: problem.tags,
            acceptance: problem.acceptance,
            description: problem.description,
            examples: problem.examples,
            starterCode: problem.starterCode,
            testCases: problem.testCases,
            constraints: problem.constraints,
            samples: problem.samples || problem.examples,
          })),
        }),
      });

      const problems = await loadProblemBank();
      if (!silent) {
        setPortalMessage(`Problem bank synced to MongoDB. ${problems.length} problems are available for assignment.`);
      }
      setPortalError("");
      return problems;
    } catch (error) {
      setPortalError(error.message || "Unable to sync problems right now.");
      throw error;
    } finally {
      setAdminSyncingProblems(false);
    }
  };

  const loadAdminPortalData = async (preferredAssignmentId = adminCurrentTest?.id) => {
    setAdminAssignmentsLoading(true);
    setPortalError("");

    try {
      let problems = await loadProblemBank();
      if (!problems.length) {
        problems = await syncProblemBankToDatabase(true);
      }

      const [testsData, studentsData, loginEventData, leaderboardData] = await Promise.all([
        performApiRequest("/api/tests"),
        performApiRequest("/api/auth/students"),
        performApiRequest("/api/auth/login-events"),
        performApiRequest("/api/submissions/leaderboard"),
      ]);

      const assignments = Array.isArray(testsData.assignments)
        ? testsData.assignments.map(mapAssignmentRecord).filter(Boolean)
        : [];
      const liveAssignments = assignments.filter((assignment) => assignment.status === "LIVE");
      const currentAssignment = assignments.find((assignment) => sameValue(assignment.id, preferredAssignmentId))
        || liveAssignments[0]
        || assignments[0]
        || {
          ...defaultAdminTest,
          problems,
          questions: problems.slice(0, 3).map((problem) => problem.id),
          questionIds: problems.slice(0, 3).map((problem) => problem.id),
          problemDbIds: problems.slice(0, 3).map((problem) => problem.dbId),
        };

      const history = assignments
        .filter((assignment) => assignment.id !== currentAssignment.id)
        .map((assignment) => ({
          id: assignment.id,
          name: assignment.title,
          date: assignment.date,
          difficulty: assignment.level,
          winner: assignment.status === "ENDED" ? "Completed" : assignment.status,
          average: assignment.questionIds.length * 25,
        }));

      const students = Array.isArray(studentsData.students) ? studentsData.students : [];
      const mappedRegisteredStudents = students.map((student) => ({
        name: student.name || student.email,
        department: student.department || "Department pending",
        status: student.lastLoginAt ? "Logged In" : "Registered",
        email: student.email,
        usn: student.usn || "--",
        loginCount: student.loginCount || 0,
        lastLoginAt: student.lastLoginAt || null,
        createdAt: student.createdAt || null,
        badgeTier: student.badgeTier || null,
        badgeLabel: student.badgeLabel || null,
        solvedProblemCount: Number(student.solvedProblemCount || 0),
      }));
      const mappedStudents = mappedRegisteredStudents.filter((student) => Number(student.loginCount || 0) > 0);
      const nextLeaderboard = Array.isArray(leaderboardData.leaderboard)
        ? leaderboardData.leaderboard
        : [];

      setProblemBank(problems);
      setAdminCreateForm((prev) => {
        const validSelections = prev.questions.filter((problemId) => problems.some((problem) => problem.dbId === problemId));
        return {
          ...prev,
          questions: validSelections.length ? validSelections : problems.slice(0, 3).map((problem) => problem.dbId),
        };
      });
      setAdminAssignments(assignments);
      setActiveAssignments(liveAssignments);
      setAdminCurrentTest(currentAssignment);
      setPreviousTests(history.length ? history : defaultPreviousTests);
      setSelectedPreviousTest(history[0] || defaultPreviousTests[0]);
      setLeaderboard(nextLeaderboard);
      setRegisteredStudents(mappedRegisteredStudents);
      setActiveUsers(mappedStudents);
      setParticipantsCount(mappedStudents.length);
      setLoginEvents(Array.isArray(loginEventData.events) ? loginEventData.events : []);
      if (currentAssignment?.id && currentAssignment.status === "ENDED") {
        const reportData = await performApiRequest(`/api/tests/${currentAssignment.id}/report`);
        setAdminTestReport(reportData.report || null);
      } else {
        setAdminTestReport(null);
      }

      if (currentAssignment?.problems?.length) {
        setAdminSubmissionProblemId((prev) => {
          const stillExists = currentAssignment.problems.some((problem) => problem.id === prev);
          return stillExists ? prev : currentAssignment.problems[0].id;
        });
      }
    } catch (error) {
      setLeaderboard([]);
      setPortalError(error.message || "Unable to load admin portal data.");
    } finally {
      setAdminAssignmentsLoading(false);
    }
  };

  const loadStudentPortalData = async (availableProblems = problemBank.length ? problemBank : PROBLEMS) => {
    try {
      const [assignmentData, notificationData, leaderboardData, submissionData, profileData] = await Promise.all([
        performApiRequest("/api/tests/active"),
        performApiRequest("/api/notifications"),
        performApiRequest("/api/submissions/leaderboard"),
        performApiRequest(`/api/submissions/user/${currentUser.id}`),
        performApiRequest("/api/auth/me"),
      ]);

      const liveAssignments = Array.isArray(assignmentData.assignments)
        ? assignmentData.assignments.map(mapAssignmentRecord).filter(Boolean)
        : [];
      const defaultAssignment = mapAssignmentRecord(assignmentData.assignment);
      const availableLiveAssignments = liveAssignments.length
        ? liveAssignments
        : (defaultAssignment ? [defaultAssignment] : []);
      const assignment = liveAssignments.find((item) => sameValue(item.id, activeAssignment?.id))
        || defaultAssignment
        || availableLiveAssignments[0]
        || null;
      setActiveAssignment(assignment);
      setActiveAssignments(availableLiveAssignments);
      if (assignment?.problems?.length) {
        setAdminCurrentTest(assignment);
      }
      if (contestEntered && !assignment) {
        finishContest("Ended because the admin stopped the test.");
      } else if (contestEntered && assignment?.id && activeAssignment?.id && !sameValue(assignment.id, activeAssignment.id)) {
        setContestEntered(false);
        setContestSessionEndsAt(null);
      }

      const notifications = Array.isArray(notificationData.notifications)
        ? notificationData.notifications
        : [];
      const nextLeaderboard = Array.isArray(leaderboardData.leaderboard)
        ? leaderboardData.leaderboard
        : [];
      const submissions = Array.isArray(submissionData.submissions)
        ? submissionData.submissions
        : [];
      const progress = deriveSubmissionProgress(submissions, availableProblems);

      setLeaderboard(nextLeaderboard);
      setSolved(progress.solved);
      setAttemptedProblems(progress.attempted);
      setUserSubmissions(submissions);
      setStudentNotifications(notifications);
      setNotificationCount(Number(notificationData.unreadCount || 0));

      if (profileData.user) {
        const refreshedUser = normalizeAuthenticatedUser(profileData.user, currentUser);
        setCurrentUser(refreshedUser);
        saveAuthSession(authToken, refreshedUser, refreshedUser.role);
      }
      setPortalError("");
    } catch (error) {
      setLeaderboard([]);
      setUserSubmissions([]);
      setPortalError(error.message || "Unable to load your current test.");
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await performApiRequest(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      setStudentNotifications((prev) => prev.map((notification) => (
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )));
      setNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      setPortalError(error.message || "Unable to update notification.");
    }
  };

  useEffect(() => {
    try {
      const rawSession = window.localStorage?.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!rawSession) return;

      const session = JSON.parse(rawSession);
      const savedUser = session?.user;
      const savedToken = String(session?.token || "");
      const savedRole = savedUser?.role || session?.role || "";

      if (!savedToken || !savedUser?.id || !savedRole) {
        clearAuthSession();
        return;
      }

      setCurrentUser(normalizeAuthenticatedUser({ ...savedUser, role: savedRole }));
      setAuthToken(savedToken);
      setUserRole(savedRole);
      setAuthModalOpen(false);
      setAuthError("");
      setView(savedRole === "admin" ? "admin" : "list");
      if (savedRole === "admin") {
        setAdminTab("overview");
      }
    } catch {
      clearAuthSession();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key || "";
      const lowerKey = key.toLowerCase();
      const isSnipShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && lowerKey === "s";

      if (key === "PrintScreen" || isSnipShortcut) {
        e.preventDefault();
        triggerShield("Screen capture shortcut blocked. Sensitive content hidden temporarily.");

        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }

      if ((e.ctrlKey || e.metaKey) && lowerKey === "p") {
        e.preventDefault();
        triggerShield("Printing is disabled for this page.", 1500);
      }
    };

    const handleBlur = () => setScreenShield(true);
    const handleFocus = () => setScreenShield(false);
    const handleVisibilityChange = () => setScreenShield(document.hidden);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (view !== "admin") return undefined;

    const handleAdminVisibility = () => {
      if (document.hidden) {
        setAdminWarning("Warning: tab switching detected while the test dashboard is active.");
      }
    };

    document.addEventListener("visibilitychange", handleAdminVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleAdminVisibility);
    };
  }, [view]);

  useEffect(() => {
    if (!adminCurrentTest) {
      setAdminTimerSeconds(0);
      return undefined;
    }

    if (adminCurrentTest.status === "ENDED") {
      setAdminTimerSeconds(0);
      return undefined;
    }

    if (!adminCurrentTest.endsAt) {
      setAdminTimerSeconds((adminCurrentTest.duration || 60) * 60);
      return undefined;
    }

    const syncAdminTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(adminCurrentTest.endsAt).getTime() - Date.now()) / 1000));
      setAdminTimerSeconds(remaining);
    };

    syncAdminTimer();
    const countdown = setInterval(syncAdminTimer, 1000);
    return () => clearInterval(countdown);
  }, [adminCurrentTest]);

  useEffect(() => {
    if (view !== "admin" || !authToken || !adminCurrentTest?.id || adminCurrentTest.status !== "ENDED") {
      setAdminTestReport(null);
      return undefined;
    }

    let cancelled = false;
    const loadReport = async () => {
      try {
        const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/report`);
        if (!cancelled) {
          setAdminTestReport(data.report || null);
        }
      } catch {
        if (!cancelled) {
          setAdminTestReport(null);
        }
      }
    };

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [view, authToken, adminCurrentTest?.id, adminCurrentTest?.status]);

  useEffect(() => {
    if (view !== "admin") return;
    if (adminTimerSeconds !== 0) return;
    if (!adminSubmissionCode.trim() || adminExecuting || adminExecution?.autoSubmitted) return;

    const autoSubmit = async () => {
      await handleAdminRun(true);
    };

    autoSubmit();
  }, [adminTimerSeconds, view, adminSubmissionCode, adminExecuting, adminExecution]);

  useEffect(() => {
    if (view !== "leaderboard") {
      setLeaderboardReady(false);
      setHoveredLeaderboardRank(null);
      return undefined;
    }

    setLeaderboardUpdating(true);
    const revealTimer = setTimeout(() => setLeaderboardReady(true), 60);
    const updatePulse = setInterval(() => {
      setLeaderboardUpdating((prev) => !prev);
    }, 900);

    return () => {
      clearTimeout(revealTimer);
      clearInterval(updatePulse);
    };
  }, [view]);

  useEffect(() => {
    setLeaderboardPage(1);
  }, [leaderboardSearch, leaderboardScope]);

  useEffect(() => {
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestSessionEndsAt(null);
  }, [activeAssignment?.id, adminCurrentTest.id]);

  useEffect(() => {
    const fallbackDuration = activeAssignment?.duration || adminCurrentTest.duration || 60;

    if (!contestSessionEndsAt) {
      setContestTimerSeconds(fallbackDuration * 60);
      return undefined;
    }

    const syncContestTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(contestSessionEndsAt).getTime() - Date.now()) / 1000));
      setContestTimerSeconds(remaining);
    };

    syncContestTimer();
    const timer = setInterval(syncContestTimer, 1000);
    return () => clearInterval(timer);
  }, [activeAssignment, adminCurrentTest, contestSessionEndsAt]);

  useEffect(() => {
    if (!contestEntered) return;
    if (!contestSessionEndsAt) return;
    if (contestTimerSeconds > 0) return;

    finishContest("Time ended.");
  }, [contestEntered, contestSessionEndsAt, contestTimerSeconds]);

  useEffect(() => {
    if (!contestEntered) {
      setContestSecurityLocked(false);
      return undefined;
    }

    let ending = false;
    const endForSecurity = async (reason) => {
      if (ending) return;
      ending = true;
      if (authToken && currentUser.id && activeContestAssignment?.id) {
        try {
          await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/interrupt`, {
            method: "POST",
            body: JSON.stringify({ reason }),
          });
        } catch {}
      }
      finishContest(reason);
    };

    const ensureContestFocus = () => {
      const hidden = document.hidden;
      const fullscreenActive = Boolean(document.fullscreenElement);
      const shouldLock = hidden || !fullscreenActive;

      setContestSecurityLocked(shouldLock);

      if (shouldLock) {
        endForSecurity("Ended because fullscreen was closed or the window changed.");
      } else {
        setScreenShield(false);
      }
    };

    const handleBlur = () => {
      setContestSecurityLocked(true);
      endForSecurity("Ended because you switched away from the test window.");
    };

    const handleContestKeyDown = (e) => {
      const key = e.key || "";
      const lowerKey = key.toLowerCase();
      const isClipboardShortcut = (e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(lowerKey);

      if (isClipboardShortcut) {
        e.preventDefault();
        triggerShield("Copy, cut, and paste are disabled during the test.", 1400);
        return;
      }

      if (key === "Escape" || key === "F11" || key === "Meta" || key === "OS") {
        e.preventDefault();
        endForSecurity(`Ended because restricted key "${key}" was pressed.`);
      }
    };

    const blockClipboardAction = (e) => {
      e.preventDefault();
      triggerShield("Copy, cut, and paste are disabled during the test.", 1400);
    };

    document.addEventListener("visibilitychange", ensureContestFocus);
    document.addEventListener("fullscreenchange", ensureContestFocus);
    document.addEventListener("copy", blockClipboardAction, true);
    document.addEventListener("cut", blockClipboardAction, true);
    document.addEventListener("paste", blockClipboardAction, true);
    window.addEventListener("keydown", handleContestKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", ensureContestFocus);

    ensureContestFocus();

    return () => {
      document.removeEventListener("visibilitychange", ensureContestFocus);
      document.removeEventListener("fullscreenchange", ensureContestFocus);
      document.removeEventListener("copy", blockClipboardAction, true);
      document.removeEventListener("cut", blockClipboardAction, true);
      document.removeEventListener("paste", blockClipboardAction, true);
      window.removeEventListener("keydown", handleContestKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", ensureContestFocus);
    };
  }, [contestEntered]);

  useEffect(() => {
    if (!authToken || !currentUser.id) {
      return undefined;
    }

    let cancelled = false;
    const loadPortal = async () => {
      if (cancelled) return;

      if (currentUser.role === "admin") {
        await loadAdminPortalData();
        return;
      }

      const loadedProblems = await loadProblemBank().catch(() => []);
      await loadStudentPortalData(loadedProblems.length ? loadedProblems : PROBLEMS);
    };

    loadPortal();
    const interval = setInterval(loadPortal, currentUser.role === "admin" ? 20000 : 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken, currentUser.id, currentUser.role]);

  const openProblem = (p, navigationSource = "catalog") => {
    setSelectedProblem(p);
    setProblemNavigationSource(navigationSource);
    setCode(p.starterCode?.[lang] || "");
    setRunResult(null);
    setActiveTab("description");
    setConsoleTab("testcase");
    setConsoleOpen(false);
    setEditorScrollTop(0);
    setErrorBanner(null);
    setView("problem");
  };

  const openLeaderboard = (scope = leaderboardScope) => {
    setLeaderboardScope(scope);
    setLeaderboardPage(1);
    setView("leaderboard");
  };

  const openContest = () => {
    setView("contest");
  };

  const buildContestResult = (reason = "Submitted", sessionProgress = contestSessionProgress) => {
    const problems = contestProblemSet.length ? contestProblemSet : contestProblems;
    const rows = problems.map((problem) => {
      const status = sessionProgress[problem.id] || "not_attempted";
      const accepted = status === "accepted";
      const attempted = status === "rejected";
      return {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        score: accepted ? problem.contestScore : 0,
        maxScore: problem.contestScore,
        status: accepted ? "Accepted" : attempted ? "Rejected" : "Not Attempted",
      };
    });
    const maxScore = rows.reduce((total, row) => total + row.maxScore, 0);
    const score = rows.reduce((total, row) => total + row.score, 0);
    const accepted = rows.filter((row) => row.status === "Accepted").length;
    const rejected = rows.filter((row) => row.status === "Rejected").length;
    const notAttempted = rows.filter((row) => row.status === "Not Attempted").length;

    return {
      title: contestDisplayName,
      reason,
      score,
      maxScore,
      accepted,
      rejected,
      notAttempted,
      total: rows.length,
      rows,
      completedAt: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const finishContest = async (reason = "Submitted", sessionProgress = contestSessionProgress) => {
    const interrupted = /ended because|restricted key|switched away|fullscreen/i.test(reason);
    if (authToken && currentUser.id && activeContestAssignment?.id) {
      try {
        await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/finish`, {
          method: "POST",
          body: JSON.stringify({ reason, interrupted }),
        });
      } catch {}
    }
    setContestResult(buildContestResult(reason, sessionProgress));
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestInstructionsOpen(false);
    setContestCameraStatus("idle");
    setContestCameraError("");
    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
    setScreenShield(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setView("contestResult");
  };

  const goBackFromAdmin = () => {
    setView("home");
  };

  const goBackFromProblem = () => {
    if (problemNavigationSource === "contest" && contestEntered) {
      finishContest("Ended because you left the test screen.");
      return;
    }
    setView(problemNavigationSource === "contest" ? "contest" : "list");
  };

  const requestContestFullscreen = async () => {
    if (document.fullscreenElement) return true;

    const root = document.documentElement;
    if (!root?.requestFullscreen) return false;

    try {
      await root.requestFullscreen({ navigationUI: "hide" });
      return true;
    } catch {
      return false;
    }
  };

  const requestContestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setContestCameraStatus("unavailable");
      setContestCameraError("Camera access is not supported in this browser.");
      return false;
    }

    setContestCameraStatus("requesting");
    setContestCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (contestCameraStream) {
        contestCameraStream.getTracks().forEach((track) => track.stop());
      }

      setContestCameraStream(stream);
      setContestCameraStatus("granted");
      return true;
    } catch (error) {
      const reason = String(error?.name || "");
      const message = reason === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access to start the test."
        : reason === "NotFoundError"
          ? "No camera was found on this device."
          : "Unable to access the camera. Check browser permission and try again.";

      setContestCameraStatus("denied");
      setContestCameraError(message);
      return false;
    }
  };

  const handleEnterContest = (problemToOpen = contestProblems[0]) => {
    if (activeContestAssignment?.attempt && activeContestAssignment.attempt.status !== "IN_PROGRESS" && !contestEntered) {
      setPortalError("You have already used your one attempt for this test.");
      return;
    }

    if (contestStatus === "Ended" || contestStatus === "Awaiting Start") {
      setPortalError(contestStatus === "Awaiting Start" ? "No live test has been started for students yet." : "");
      return;
    }

    setPortalError("");
    setSelectedProblem(problemToOpen || contestProblems[0] || null);
    setContestInstructionsAccepted(false);
    setContestCameraStatus("idle");
    setContestCameraError("");
    setContestInstructionsOpen(true);
  };

  const startContestAfterInstructions = async () => {
    const problemToOpen = selectedProblem || contestProblems[0];
    if (!contestInstructionsAccepted || !problemToOpen) return;

    const cameraGranted = await requestContestCameraPermission();
    if (!cameraGranted) {
      triggerShield("Camera permission is required to start the contest.", 2200);
      return;
    }

    const fullscreenGranted = await requestContestFullscreen();
    if (!fullscreenGranted) {
      triggerShield("Fullscreen permission is required to start the contest.", 2200);
      return;
    }

    if (authToken && currentUser.id && activeContestAssignment?.id) {
      try {
        await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/start`, {
          method: "POST",
        });
      } catch (error) {
        setPortalError(error.message || "You have already used your one attempt for this test.");
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }
    }

    setContestEntered(true);
    setContestSecurityLocked(false);
    setContestSessionEndsAt(new Date(Date.now() + ((activeContestAssignment?.duration || adminCurrentTest.duration || 60) * 60 * 1000)).toISOString());
    setContestSessionProgress({});
    setContestResult(null);
    setContestInstructionsOpen(false);
    if (problemToOpen) openProblem(problemToOpen, "contest");
  };

  const closeContestInstructions = () => {
    setContestInstructionsOpen(false);
    setContestInstructionsAccepted(false);
    setContestCameraStatus("idle");
    setContestCameraError("");

    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
  };

  const openProfile = () => {
    setView("profile");
  };

  const handleLangChange = (l) => {
    setLang(l);
    if (selectedProblem) setCode(selectedProblem.starterCode?.[l] || "");
  };

  const openAuthFlow = () => {
    setAuthModalOpen(true);
    setAuthMode("");
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const closeAuthFlow = () => {
    setAuthModalOpen(false);
    setAuthMode("");
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const chooseAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const chooseAuthRole = (role) => {
    setAuthRole(role);
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const handleAuthSubmit = async () => {
    const name = authName.trim();
    const usn = authUsn.trim();
    const department = authDepartment.trim();
    const email = authEmail.trim();
    const password = authPassword.trim();
    const emailPattern = /^[A-Z0-9._%+-]+@cambridge\.edu\.in$/i;

    if (!authMode || !authRole) {
      setAuthError("Choose login or sign up and select a role first.");
      return;
    }

    if (!email || !password) {
      setAuthError("Enter both email ID and password.");
      return;
    }

    if (authMode === "signup") {
      if (!name || !department) {
        setAuthError("Enter name and department to sign up.");
        return;
      }

      if (authRole === "student" && !usn) {
        setAuthError("Enter USN for student sign up.");
        return;
      }

      if (!authPoliciesAccepted) {
        setAuthError("Accept the Terms and Conditions and Privacy Policy to create an account.");
        return;
      }
    }

    if (!emailPattern.test(email)) {
      setAuthError("Only @cambridge.edu.in email addresses are allowed.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload = authMode === "signup"
        ? { email, password, name, usn, department, role: authRole }
        : { email, password, role: authRole };

      const response = await fetch(buildBackendApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      const user = data.user || {
        id: "",
        role: authRole,
        email,
        name,
        usn,
        department,
        verified: false,
        lastLoginAt: null,
        loginCount: 0,
      };

      const resolvedRole = user.role || authRole;
      const authenticatedUser = normalizeAuthenticatedUser(user, {
        role: resolvedRole,
        email,
        name,
        usn,
        department,
      });

      setCurrentUser(authenticatedUser);
      setAuthToken(data.token || "");
      setUserRole(resolvedRole);
      saveAuthSession(data.token || "", authenticatedUser, resolvedRole);
      setPortalMessage("");
      setPortalError("");
      if (resolvedRole === "admin") {
        setAdminTab("overview");
      }
      setAuthModalOpen(false);
      setAuthError("");
      setView(resolvedRole === "admin" ? "admin" : "list");
    } catch (error) {
      const message = String(error?.message || "");
      setAuthError(
        message.includes("Failed to fetch")
          ? `Cannot reach backend API at ${BACKEND_API_TARGET}. Start the backend with "npm start --prefix backend" and try again.`
          : message || "Unable to complete authentication right now."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const signOut = () => {
    clearAuthSession();
    setUserRole(null);
    setCurrentUser(EMPTY_CURRENT_USER);
    setAuthToken("");
    setProblemBank([]);
    setAdminAssignments([]);
    setActiveAssignment(null);
    setStudentNotifications([]);
    setNotificationCount(0);
    setLoginEvents([]);
    setPortalMessage("");
    setPortalError("");
    setLeaderboard([]);
    setActiveUsers(defaultActiveUsers);
    setRegisteredStudents([]);
    setParticipantsCount(defaultActiveUsers.length);
    setAdminTab("overview");
    setAdminWarning("");
    setSolutionsVisible(false);
    setAdminExecution(null);
    setQuestionUploadForm(createDefaultQuestionUploadForm());
    setQuestionUploading(false);
    setQuestionCategoryFilter("All");
    setUserSubmissions([]);
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestInstructionsOpen(false);
    setContestInstructionsAccepted(false);
    setContestCameraStatus("idle");
    setContestCameraError("");
    setContestSessionEndsAt(null);
    setContestSessionProgress({});
    setContestResult(null);
    setFinalSubmitConfirmOpen(false);
    setAttemptedProblems(new Set());
    setSolved(new Set());
    setContestTimerSeconds(adminCurrentTest.duration * 60);
    setConsoleOpen(false);
    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
    setScreenShield(false);
    closeAuthFlow();
    setView("home");
  };

  useEffect(() => {
    const selected = adminCurrentTest.problems?.find((problem) => problem.id === adminSubmissionProblemId)
      || problemBank.find((problem) => problem.id === adminSubmissionProblemId)
      || PROBLEMS.find((problem) => problem.id === adminSubmissionProblemId);
    if (selected) {
      setAdminSubmissionCode(selected.starterCode?.[adminSubmissionLang] || "");
    }
  }, [adminCurrentTest, adminSubmissionProblemId, adminSubmissionLang, problemBank]);

  const handleAdminCreateInput = (field, value) => {
    setAdminCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuestionUploadInput = (field, value) => {
    if (questionUploadError) setQuestionUploadError("");
    setQuestionUploadForm((prev) => ({ ...prev, [field]: value }));
  };

  const parseUploadList = (value) =>
    String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const parseUploadPairs = (value, outputKey) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => ({
            input: String(entry?.input || ""),
            [outputKey]: String(entry?.[outputKey] || entry?.output || entry?.expected || ""),
            ...(entry?.explanation ? { explanation: String(entry.explanation) } : {}),
          }))
          .filter((entry) => entry.input || entry[outputKey]);
      }
    } catch {
      // Fall back to line parsing below.
    }

    return trimmed
      .split(/\r?\n/)
      .map((line) => {
        const parts = line.split("=>");
        const input = String(parts.shift() || "").trim();
        const output = parts.join("=>").trim();
        return {
          input,
          [outputKey]: output,
        };
      })
      .filter((entry) => entry.input || entry[outputKey]);
  };

  const getProblemCategory = (problem) => {
    const tags = Array.isArray(problem?.tags) ? problem.tags : [];
    return questionCategories.find((category) =>
      tags.some((tag) => String(tag).toLowerCase() === category.toLowerCase())
    ) || "Other";
  };

  const handleUploadQuestion = async () => {
    const title = questionUploadForm.title.trim();
    const statement = questionUploadForm.statement.trim();

    if (!title || !statement) {
      setQuestionUploadError("Enter a question title and full statement before uploading.");
      return;
    }

    if (questionUploadForm.category !== "SQL" && !questionUploadForm.fnName.trim()) {
      setQuestionUploadError("Enter the function name used by the test cases.");
      return;
    }

    const examples = parseUploadPairs(questionUploadForm.examples, "output");
    const parsedTestCases = parseUploadPairs(questionUploadForm.testCases, "expected");
    const testCases = parsedTestCases.length
      ? parsedTestCases
      : examples.map((example) => ({ input: example.input, expected: example.output }));
    const tags = [
      questionUploadForm.category,
      ...String(questionUploadForm.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ].filter((tag, index, allTags) =>
      allTags.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) === index
    );

    setQuestionUploading(true);
    setQuestionUploadError("");
    setQuestionUploadSuccess("");

    try {
      const data = await performApiRequest("/api/problems", {
        method: "POST",
        body: JSON.stringify({
          title,
          difficulty: questionUploadForm.difficulty,
          tags,
          fnName: questionUploadForm.fnName.trim() || "solve",
          statement,
          examples,
          testCases,
          constraints: parseUploadList(questionUploadForm.constraints),
          starterCode: {
            javascript: questionUploadForm.javascript,
            python: questionUploadForm.python,
            java: questionUploadForm.java,
          },
          samples: examples,
          acceptance: "Admin Upload",
        }),
      });

      const savedProblem = mapProblemRecord(data.problem);
      const nextProblems = await loadProblemBank();
      const uploadedProblem = savedProblem || nextProblems.find((problem) => problem.title === title);

      if (uploadedProblem?.dbId) {
        setAdminCreateForm((prev) => ({
          ...prev,
          questions: prev.questions.includes(uploadedProblem.dbId)
            ? prev.questions
            : [...prev.questions, uploadedProblem.dbId],
        }));
      }

      setQuestionUploadForm(createDefaultQuestionUploadForm());
      setQuestionUploadSuccess(`Your question "${uploadedProblem?.title || title}" was uploaded successfully.`);
    } catch (error) {
      setQuestionUploadError(error.message || "Unable to upload the question.");
    } finally {
      setQuestionUploading(false);
    }
  };

  const formatCountdown = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  const formatContestCountdown = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  async function handleAdminRun(autoSubmitted = false) {
    const selected = adminSelectedProblem;
    if (!selected) return;

    setAdminExecuting(true);
    setAdminExecution(null);

    const fallbackError = (message) =>
      selected.testCases.map((tc, index) => ({
        ...tc,
        actual: null,
        status: "error",
        error: `Case ${index + 1}: ${message}`,
      }));

    try {
      const data = await requestExecutionResult({
        language: adminSubmissionLang,
        sourceCode: adminSubmissionCode,
        fnName: selected.fnName,
        testCases: selected.testCases,
      });

      setAdminExecution({
        tests: data.tests || [],
        runtime: data.runtime || "N/A",
        status: data.status || "failed",
        autoSubmitted,
      });
    } catch (error) {
      setAdminExecution({
        tests: fallbackError(error.message),
        runtime: "N/A",
        status: "failed",
        autoSubmitted,
      });
    } finally {
      setAdminExecuting(false);
    }
  }

  const toggleCreateQuestion = (problemDbId) => {
    setAdminCreateForm((prev) => {
      const exists = prev.questions.includes(problemDbId);
      return {
        ...prev,
        questions: exists
          ? prev.questions.filter((value) => value !== problemDbId)
          : [...prev.questions, problemDbId],
      };
    });
  };

  const handleCreateTest = async () => {
    const duration = Math.max(1, Number(adminCreateForm.duration) || 60);
    if (!adminCreateForm.questions.length) {
      setPortalError("Select at least one database problem for the test.");
      return;
    }

    setAdminCreatingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest("/api/tests", {
        method: "POST",
        body: JSON.stringify({
          title: adminCreateForm.title.trim() || "Fresh Challenge",
          difficulty: adminCreateForm.level,
          durationMinutes: duration,
          problemIds: adminCreateForm.questions,
        }),
      });

      const createdAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(createdAssignment);
      setAdminTimerSeconds(duration * 60);
      setAdminSubmissionProblemId(createdAssignment?.problems?.[0]?.id || "");
      setSolutionsVisible(false);
      setPortalMessage(`Draft test "${createdAssignment.title}" saved. Start it when you're ready to notify students.`);
      await loadAdminPortalData(createdAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to create the test.");
    } finally {
      setAdminCreatingTest(false);
    }
  };

  const handleStartAssignedTest = async () => {
    if (!adminCurrentTest.id) {
      setPortalError("Create a draft test first, then start it.");
      return;
    }

    setAdminStartingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/start`, {
        method: "POST",
      });

      const startedAssignment = mapAssignmentRecord(data.assignment);
      setActiveAssignment(startedAssignment);
      setAdminCurrentTest(startedAssignment);
      setAdminSubmissionProblemId(startedAssignment?.problems?.[0]?.id || "");
      setPortalMessage(`Test started. Notifications were sent to ${data.notifiedStudents || 0} logged-in students.`);
      await loadAdminPortalData(startedAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to start the test.");
    } finally {
      setAdminStartingTest(false);
    }
  };

  const handleStopAssignedTest = async () => {
    if (!adminCurrentTest.id || adminCurrentTest.status !== "LIVE") {
      setPortalError("Select a live test before stopping it.");
      return;
    }

    setAdminStoppingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/stop`, {
        method: "POST",
      });

      const stoppedAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(stoppedAssignment);
      setAdminTimerSeconds(0);
      setPortalMessage(`Test stopped. Notifications were sent to ${data.notifiedStudents || 0} logged-in students.`);
      await loadAdminPortalData(stoppedAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to stop the test.");
    } finally {
      setAdminStoppingTest(false);
    }
  };

  // ── CORE RUN / SUBMIT ──────────────────────────────────────────────────────
  const simulateRun = async (isSubmit) => {
    if (isSubmit) setSubmitting(true); else setRunning(true);
    setConsoleOpen(true);
    setConsoleTab("result");
    setRunResult(null);
    setErrorBanner(null);

    await new Promise((r) => setTimeout(r, 700));

    const p        = selectedProblem;
    let   results  = [];
    let   runtime  = Math.floor(60 + Math.random() * 60) + " ms";
    let   memory   = (Math.random() * 5 + 40).toFixed(1) + " MB";
    let   beats    = Math.floor(50 + Math.random() * 45) + "%";
    let   status   = "failed";

    try {
      if (isSubmit) {
        const data = await performApiRequest("/api/submissions/submit", {
          method: "POST",
          body: JSON.stringify({
            problemId: String(p.dbId || p.id),
            language: lang,
            code,
          }),
        });

        results = data.tests || [];
        runtime = data.runtime || runtime;
        memory  = data.memory || memory;
        beats   = data.beats || beats;
        status  = data.status || status;
      } else {
        const data = await requestExecutionResult({
          language: lang,
          sourceCode: code,
          fnName: p.fnName,
          testCases: p.testCases,
        });

        results = data.tests || [];
        runtime = data.runtime || runtime;
        memory  = data.memory || memory;
        beats   = data.beats || beats;
        status  = data.status || status;
      }
    } catch (error) {
      const deploymentHint = !isSubmit && error.message.includes("returned HTML instead of JSON")
        ? " This usually means the frontend is not reaching the configured backend API correctly."
        : "";
      results = p.testCases.map((tc, i) => ({
        ...tc,
        actual: null,
        status: "error",
        error: `Case ${i+1}: ${error.message}${deploymentHint}${isSubmit ? " Submission was not saved." : ""}`
      }));
      status = "failed";
    }

    // Collect errors for the banner
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "error" || r.status === "unsupported") {
        errors.push({ caseNum: i + 1, message: r.error });
      } else if (r.status === "fail") {
        errors.push({
          caseNum: i + 1,
          message: r.error
            ? r.error
            : `Expected: ${r.expected}\nGot:      ${r.actual ?? "undefined"}\n\nYour output does not match. Re-check your logic.`,
        });
      }
    });
    if (errors.length > 0) setErrorBanner(errors);

    const allPassed = results.every(r => r.status === "pass");
    const nextSolvedSet = new Set(solved);
    const nextAttemptedSet = new Set(attemptedProblems);
    if (allPassed) {
      nextAttemptedSet.delete(p.id);
      setAttemptedProblems(new Set(nextAttemptedSet));
      if (isSubmit) {
        nextSolvedSet.add(p.id);
        setSolved(new Set(nextSolvedSet));
      }
    } else {
      nextAttemptedSet.add(p.id);
      setAttemptedProblems(new Set(nextAttemptedSet));
    }
    const nextContestSessionProgress = {
      ...contestSessionProgress,
      ...(isSubmit && isContestProblem ? { [p.id]: allPassed ? "accepted" : "rejected" } : {}),
    };
    if (isSubmit && isContestProblem) {
      setContestSessionProgress(nextContestSessionProgress);
    }

    setRunResult({
      type: isSubmit ? "submit" : "run",
      passed: allPassed,
      status: status === "unsupported" ? "unsupported" : allPassed ? "passed" : "failed",
      tests: results,
      runtime,
      memory,
      beats,
    });

    if (isSubmit && authToken && currentUser.id) {
      await loadStudentPortalData(problemCatalog);
    }

    if (isSubmit) setSubmitting(false); else setRunning(false);
    if (isSubmit && isFinalContestProblem) {
      finishContest("Final submission completed.", nextContestSessionProgress);
    }
  };
  const indentUnit = "  ";
  const handleEditorIndentation = (e, value, setter, ref, language = lang) => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === "Tab") {
      e.preventDefault();

      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selectedText = value.slice(start, end);
      const hasMultipleLines = selectedText.includes("\n") || start !== end && lineStart !== start;

      if (hasMultipleLines) {
        const blockEnd = end;
        const lineEnd = value.indexOf("\n", blockEnd);
        const selectionEnd = lineEnd === -1 ? value.length : lineEnd;
        const block = value.slice(lineStart, selectionEnd);
        const lines = block.split("\n");
        const updatedLines = e.shiftKey
          ? lines.map((line) => line.startsWith(indentUnit) ? line.slice(indentUnit.length) : line.startsWith(" ") ? line.slice(1) : line)
          : lines.map((line) => `${indentUnit}${line}`);
        const updatedBlock = updatedLines.join("\n");
        const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(selectionEnd)}`;
        const deltaPerFirstLine = e.shiftKey
          ? (lines[0].startsWith(indentUnit) ? -indentUnit.length : lines[0].startsWith(" ") ? -1 : 0)
          : indentUnit.length;
        const changedChars = updatedBlock.length - block.length;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = Math.max(lineStart, start + deltaPerFirstLine);
          ta.selectionEnd = Math.max(lineStart, end + changedChars);
        }, 0);
        return;
      }

      if (e.shiftKey) {
        const beforeCursor = value.slice(lineStart, start);
        if (beforeCursor.endsWith(indentUnit)) {
          const nextValue = `${value.slice(0, start - indentUnit.length)}${value.slice(end)}`;
          setter(nextValue);
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start - indentUnit.length;
          }, 0);
        }
        return;
      }

      const nextValue = `${value.slice(0, start)}${indentUnit}${value.slice(end)}`;
      setter(nextValue);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + indentUnit.length;
      }, 0);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, start);
      const currentIndent = (line.match(/^\s*/) || [""])[0];
      const trimmedLine = line.trimEnd();
      const shouldIncreaseIndent = /[\{\[\(]\s*$/.test(trimmedLine)
        || (language === "python" && /:\s*$/.test(trimmedLine));
      const nextChar = value.slice(end).charAt(0);
      const shouldCreateInnerLine = shouldIncreaseIndent && /[\}\]\)]/.test(nextChar);
      const nextIndent = `${currentIndent}${shouldIncreaseIndent ? indentUnit : ""}`;
      const nextValue = shouldCreateInnerLine
        ? `${value.slice(0, start)}\n${nextIndent}\n${currentIndent}${value.slice(end)}`
        : `${value.slice(0, start)}\n${nextIndent}${value.slice(end)}`;
      setter(nextValue);
      setTimeout(() => {
        const cursor = start + 1 + nextIndent.length;
        ta.selectionStart = ta.selectionEnd = cursor;
      }, 0);
      return;
    }

    if (/^[\}\]\)]$/.test(e.key) && start === end) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const beforeCursor = value.slice(lineStart, start);
      if (/^\s+$/.test(beforeCursor)) {
        const removableIndent = beforeCursor.endsWith(indentUnit) ? indentUnit.length : 1;
        e.preventDefault();
        const nextValue = `${value.slice(0, start - removableIndent)}${e.key}${value.slice(end)}`;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start - removableIndent + 1;
        }, 0);
      }
    }
  };

  const problemCatalog = problemBank.length ? problemBank : PROBLEMS;
  const filteredProblems = problemCatalog.filter(p =>
    (filterDiff === "All" || p.difficulty === filterDiff) &&
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeContestAssignment = activeAssignment || (currentUser.role === "admin" && adminCurrentTest.status === "LIVE" ? adminCurrentTest : null);
  const activeContestOptions = activeAssignments.length
    ? activeAssignments
    : (activeContestAssignment ? [activeContestAssignment] : []);
  const contestDisplayName = activeContestAssignment?.title
    || (adminCurrentTest.title === "Current Test" ? "Weekly Coding Contest #1" : adminCurrentTest.title);
  const contestStatus = !activeContestAssignment
    ? "Awaiting Start"
    : contestSessionEndsAt && contestTimerSeconds <= 0
      ? "Ended"
      : "Live";
  const contestStatusTone = contestStatus === "Live"
    ? { color:"#73f0b3", border:"#1f4e3a", background:"#0e1b15" }
    : contestStatus === "Ended"
      ? { color:"#ff9b9b", border:"#5a262d", background:"#1b0f13" }
      : { color:"#93c5fd", border:"#2d4f7b", background:"#0f1727" };
  const contestProblems = (activeContestAssignment?.problems?.length ? activeContestAssignment.problems : adminCurrentTest.problems || [])
    .map((problem, index) => {
      if (!problem) return null;

      const status = solved.has(problem.id)
        ? {
            icon: "✔",
            label: "Solved",
            color: "#73f0b3",
            background: "#0f1c15",
            border: "#1f4e3a",
          }
        : attemptedProblems.has(problem.id)
          ? {
              icon: "❌",
              label: "Attempted",
              color: "#ff9b9b",
              background: "#1a1014",
              border: "#5a262d",
            }
          : {
              icon: "⏳",
              label: "Not Tried",
              color: "#ffc86b",
              background: "#191309",
              border: "#5d4722",
            };

      return {
        ...problem,
        contestScore: Math.max(20, 40 - (index * 5)),
        contestStatusMeta: status,
      };
    })
    .filter(Boolean);
  const contestProblemSet = contestProblems.filter(Boolean);
  const hasUsedContestAttempt = Boolean(
    activeContestAssignment?.attempt
    && activeContestAssignment.attempt.status !== "IN_PROGRESS"
    && !contestEntered
  );
  const catalogProblemSet = problemCatalog.filter(Boolean);
  const problemNavigation = problemNavigationSource === "contest" && contestProblemSet.length
    ? contestProblemSet
    : catalogProblemSet;
  const selectedProblemIndex = selectedProblem
    ? problemNavigation.findIndex((problem) => (
        sameValue(problem.id, selectedProblem.id)
        || sameValue(problem.dbId, selectedProblem.dbId)
      ))
    : -1;
  const hasPreviousProblem = selectedProblemIndex > 0;
  const hasNextProblem = selectedProblemIndex > -1 && selectedProblemIndex < problemNavigation.length - 1;
  const showProblemNavigation = problemNavigation.length > 1 && selectedProblemIndex > -1;
  const isContestProblem = problemNavigationSource === "contest" && contestEntered;
  const isFinalContestProblem = isContestProblem && selectedProblemIndex === problemNavigation.length - 1;
  const openAdjacentProblem = (offset) => {
    if (selectedProblemIndex < 0) return;

    const nextProblem = problemNavigation[selectedProblemIndex + offset];
    if (nextProblem) {
      openProblem(nextProblem, problemNavigationSource);
    }
  };
  const handleSubmitClick = () => {
    if (isFinalContestProblem) {
      setFinalSubmitConfirmOpen(true);
      return;
    }
    simulateRun(true);
  };
  const confirmFinalSubmit = () => {
    setFinalSubmitConfirmOpen(false);
    simulateRun(true);
  };
  const leaderboardMode = leaderboardScope === "This Contest"
    ? "contest"
    : leaderboardScope === "Global"
      ? "global"
      : "overall";
  const leaderboardRows = leaderboard
    .map((entry) => ({
      ...entry,
      stats: entry[leaderboardMode],
    }))
    .filter((entry) =>
      entry.username.toLowerCase().includes(leaderboardSearch.trim().toLowerCase())
    )
    .sort((a, b) => a.stats.rank - b.stats.rank);
  const leaderboardPageSize = 5;
  const leaderboardPageCount = Math.max(1, Math.ceil(leaderboardRows.length / leaderboardPageSize));
  const safeLeaderboardPage = Math.min(leaderboardPage, leaderboardPageCount);
  const visibleLeaderboardRows = leaderboardRows.slice(
    (safeLeaderboardPage - 1) * leaderboardPageSize,
    safeLeaderboardPage * leaderboardPageSize,
  );
  const getAvatarLabel = (name) =>
    name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  const getTrendMeta = (trend) =>
    trend > 0
      ? { icon: "↑", color: "#73f0b3", label: `Up ${trend}` }
      : trend < 0
        ? { icon: "↓", color: "#ff9b9b", label: `Down ${Math.abs(trend)}` }
        : { icon: "→", color: "#8f93b4", label: "No change" };
  const getLeaderboardAccent = (rank) => {
    if (rank === 1) {
      return {
        edge: "#f3c969",
        glow: "0 18px 42px rgba(243, 201, 105, 0.18)",
        background: "linear-gradient(90deg, rgba(243,201,105,0.16), rgba(17,17,24,0.94) 18%)",
        badge: "🥇",
      };
    }
    if (rank === 2) {
      return {
        edge: "#cfd6df",
        glow: "0 18px 42px rgba(207, 214, 223, 0.16)",
        background: "linear-gradient(90deg, rgba(207,214,223,0.14), rgba(17,17,24,0.94) 18%)",
        badge: "🥈",
      };
    }
    if (rank === 3) {
      return {
        edge: "#c58a5c",
        glow: "0 18px 42px rgba(197, 138, 92, 0.18)",
        background: "linear-gradient(90deg, rgba(197,138,92,0.14), rgba(17,17,24,0.94) 18%)",
        badge: "🥉",
      };
    }
    return {
      edge: "#25283a",
      glow: "none",
      background: "transparent",
      badge: null,
    };
  };
  const ADMIN_THEME = {
    background: "#F9FAFB",
    card: "#FFFFFF",
    border: "#E5E7EB",
    hoverBackground: "#F3F4F6",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    primaryLight: "#DBEAFE",
    secondary: "#7C3AED",
    secondaryHover: "#6D28D9",
    text: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    info: "#2563EB",
    sidebarBackground: "#FFFFFF",
    sidebarActive: "#DBEAFE",
    buttonSecondary: "#F3F4F6",
    divider: "#E5E7EB",
    shadowSoft: "0 1px 3px rgba(0,0,0,0.05)",
    shadowHover: "0 10px 25px rgba(0,0,0,0.05)",
  };

  const getSubmissionLevelMeta = (level) => {
    if (level === "Hard") {
      return { color: ADMIN_THEME.error, border: "rgba(220, 38, 38, 0.2)", background: "rgba(220, 38, 38, 0.08)" };
    }
    if (level === "Medium") {
      return { color: ADMIN_THEME.warning, border: "rgba(217, 119, 6, 0.2)", background: "rgba(217, 119, 6, 0.08)" };
    }
    if (level === "Easy") {
      return { color: ADMIN_THEME.success, border: "rgba(22, 163, 74, 0.2)", background: "rgba(22, 163, 74, 0.08)" };
    }
    return { color: ADMIN_THEME.textMuted, border: ADMIN_THEME.border, background: ADMIN_THEME.hoverBackground };
  };

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const formatDisplayName = (value) =>
    value
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const profileName = currentUser.name.trim()
    || (currentUser.email ? formatDisplayName(currentUser.email.split("@")[0]) : "User");
  const matchedLeaderboardProfile = leaderboard.find(
    (entry) => entry.userId === currentUser.id || entry.username.toLowerCase() === profileName.toLowerCase()
  );
  const profileEntry = matchedLeaderboardProfile || null;
  const profileAvatarGradient = profileEntry?.avatarGradient || ["#60a5fa", "#8b5cf6"];
  const currentAchievement = getAchievementBadgeMeta(currentUser.badgeTier);
  const acceptedSubmissionCount = userSubmissions.filter((submission) => submission.status === "ACCEPTED").length;
  const submissionAccuracy = userSubmissions.length
    ? `${Math.round((acceptedSubmissionCount / userSubmissions.length) * 100)}%`
    : "--";
  const profileStats = [
    { label: "Problems Solved", value: solved.size, accent: "#60a5fa" },
    { label: "Accuracy %", value: submissionAccuracy, accent: "#22d3ee" },
    { label: "Contest Rating", value: profileEntry?.rating ?? "--", accent: "#8b5cf6" },
    { label: "Global Rank", value: profileEntry?.global?.rank ? `#${profileEntry.global.rank}` : "--", accent: "#a78bfa" },
  ];
  const profileDetails = [
    { label: "Email", value: currentUser.email || "--" },
    { label: "Department", value: currentUser.department || "--" },
    { label: "USN", value: currentUser.usn || "--" },
    { label: "Role", value: currentUser.role ? formatDisplayName(currentUser.role) : "--" },
    { label: "Joined", value: formatPortalDate(currentUser.createdAt) },
    { label: "Last Login", value: formatPortalDate(currentUser.lastLoginAt) },
    { label: "Login Count", value: String(currentUser.loginCount || 0) },
    { label: "Achievement Badge", value: currentUser.badgeLabel || "Not earned yet" },
    { label: "Verified", value: currentUser.verified ? "Yes" : "No" },
  ];
  const solvedEasy = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Easy").length;
  const solvedMedium = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Medium").length;
  const solvedHard = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Hard").length;
  const totalSolvedCount = solvedEasy + solvedMedium + solvedHard;
  const profileDifficultyBreakdown = [
    { label: "Easy", value: solvedEasy, total: totalSolvedCount || 1, color: "#22c55e" },
    { label: "Medium", value: solvedMedium, total: totalSolvedCount || 1, color: "#facc15" },
    { label: "Hard", value: solvedHard, total: totalSolvedCount || 1, color: "#ef4444" },
  ];
  const profileSubmissionHistory = userSubmissions.slice(0, 6).map((submission) => ({
    problemId: submission.problem?.number ?? submission.problem?.legacyId ?? submission.problemId,
    problemDbId: submission.problem?.id ?? submission.problemId,
    problemName: submission.problem?.title || "Unknown Problem",
    status: submission.status === "ACCEPTED"
      ? "Accepted"
      : submission.status === "WRONG_ANSWER"
        ? "Wrong Answer"
        : submission.status === "TIME_LIMIT_EXCEEDED" || submission.status === "TLE"
          ? "Time Limit"
          : formatDisplayName(String(submission.status || "").toLowerCase()),
    language: formatDisplayName(submission.language || "--"),
    time: formatPortalDate(submission.createdAt),
  }));
  const profileContestHistory = profileEntry ? [
    {
      name: activeAssignment?.title || contestDisplayName || "Current Contest",
      rank: profileEntry.contest?.rank ? `#${profileEntry.contest.rank}` : "--",
      score: profileEntry.contest?.score ?? "--",
      rating: profileEntry.rating ?? "--",
    },
  ] : [];
  const liftCard = (e) => {
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.boxShadow = "0 22px 50px rgba(37, 99, 235, 0.16)";
  };
  const settleCard = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 14px 34px rgba(15, 23, 42, 0.32)";
  };
  const isPhone = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const isCompact = viewportWidth < 900;
  const pageGutter = isPhone ? 14 : isTablet ? 20 : 24;
  const compactGrid = "minmax(0, 1fr)";
  const S = {
    app:  { fontFamily:"'Outfit','Space Grotesk',sans-serif", background:"#0a0a0f", color:"#e0e0e0", minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden" },
    adminApp: { fontFamily:"'Outfit','Space Grotesk',sans-serif", background:ADMIN_THEME.background, color:ADMIN_THEME.text, minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden" },
    nav:  { background:"#111118", borderBottom:"1px solid #1e1e2e", padding:`10px ${pageGutter}px`, display:"flex", alignItems:"center", minHeight:isPhone ? 60 : 72, gap:isPhone ? 10 : 24, position:"sticky", top:0, zIndex:100, flexWrap:"wrap" },
    adminNav: { background:ADMIN_THEME.sidebarBackground, borderBottom:`1px solid ${ADMIN_THEME.divider}`, boxShadow:ADMIN_THEME.shadowSoft, padding:`10px ${pageGutter}px`, display:"flex", alignItems:"center", minHeight:isPhone ? 60 : 72, gap:isPhone ? 10 : 24, position:"sticky", top:0, zIndex:100, flexWrap:"wrap" },
    adminNavTitle: { color:ADMIN_THEME.text, fontSize:15, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.03em" },
    logo: { fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:20, background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer", letterSpacing:"-0.5px" },
    navBtn: (a) => ({ background:"none", border:"none", color:a?"#fff":"#666", cursor:"pointer", padding:"6px 0", borderBottom:a?"2px solid #7c6af7":"2px solid transparent", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.03em", display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }),
    navBtnLabel: (a) => ({ color:a?"#fff":"#8a8ea8", fontSize:13.5, fontWeight:600, lineHeight:1.1 }),
    navBtnHint: (a) => ({ color:a?"#979cff":"#5f647f", fontSize:10.5, fontWeight:500, lineHeight:1.1, letterSpacing:"0.02em" }),
    badge: (d) => ({ padding:"3px 11px", borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", background:d==="Easy"?"#00b8a315":d==="Medium"?"#ffc01e15":"#ff375f15", color:d==="Easy"?"#00b8a3":d==="Medium"?"#ffc01e":"#ff375f" }),
    tag:  { background:"#151526", color:"#9aa0d2", padding:"4px 10px", borderRadius:999, fontSize:10.5, border:"1px solid #2a2a3e", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" },
    btn:  (v) => ({ padding:"8px 18px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12.5, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.04em", textTransform:"uppercase", transition:"all 0.15s",
      ...(v==="run"    ? { background:"#1a2a1a", color:"#4ade80", border:"1px solid #2a3a2a" }
        : v==="submit" ? { background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", color:"#fff" }
        :                { background:"#1e1e2e", color:"#aaa", border:"1px solid #2a2a3e" }) }),
    tableHead: { padding:"12px 16px", textAlign:"left", fontSize:11, color:"#636782", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'Space Grotesk',sans-serif" },
    tableTitle: { color:"#ecedff", fontWeight:600, fontSize:15.5, fontFamily:"'Outfit','Space Grotesk',sans-serif", letterSpacing:"-0.01em" },
    problemTitle: { fontFamily:"'Fraunces',serif", fontSize:isPhone ? 24 : 30, fontWeight:700, color:"#fff", margin:0, lineHeight:1.08, letterSpacing:"-0.03em" },
    problemBody: { fontFamily:"'Outfit','Space Grotesk',sans-serif", lineHeight:1.8, color:"#c9cbe2", fontSize:isPhone ? 14.5 : 15.5, marginBottom:24, letterSpacing:"0.01em" },
    sectionLabel: { fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, color:"#7a7f9e", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 },
    exampleCard: { background:"linear-gradient(180deg,#12121d,#0d0d15)", border:"1px solid #25253b", borderRadius:12, padding:"16px 18px", fontSize:13.5, boxShadow:"inset 0 1px 0 #ffffff08" },
    exampleFieldLabel: { color:"#6f7396", fontFamily:"'Space Grotesk',sans-serif", fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" },
    exampleFieldValue: { color:"#e6e8fb", fontFamily:"'JetBrains Mono',monospace", fontSize:13.5, lineHeight:1.8 },
    constraintItem: { color:"#8f93b4", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, lineHeight:1.85, letterSpacing:"0.01em" },
    heroShell: { maxWidth:1100, margin:"0 auto", width:"100%", boxSizing:"border-box", padding:isPhone ? "28px 14px 46px" : `56px ${pageGutter}px 72px` },
    homeGrid: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.15fr 0.85fr", gap:isPhone ? 14 : 24, alignItems:"stretch" },
    heroPanel: { background:"radial-gradient(circle at top left,#1f1d3d,#0f1018 58%)", border:"1px solid #2a2a3e", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "24px 18px" : "36px 34px", boxShadow:"0 20px 60px #00000045" },
    roleCard: { background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #26263d", borderRadius:20, padding:"22px 20px", display:"flex", flexDirection:"column", gap:12, boxShadow:"inset 0 1px 0 #ffffff08" },
    homeTitle: { fontFamily:"'Fraunces',serif", fontSize:isPhone ? 34 : isTablet ? 44 : 52, lineHeight:1.04, margin:"0 0 18px", color:"#fff", letterSpacing:"-0.04em" },
    formWrap: { maxWidth:560, width:"100%", boxSizing:"border-box", margin:isPhone ? "24px auto 0" : "42px auto 0", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #25253b", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "22px 16px 24px" : "28px 26px 30px", boxShadow:"0 18px 50px #00000045" },
    fieldLabel: { display:"block", marginBottom:8, color:"#8f93b4", fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" },
    input: { width:"100%", boxSizing:"border-box", background:"#0f1018", border:"1px solid #26263d", color:"#eef0ff", borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", fontFamily:"'Outfit','Space Grotesk',sans-serif" },
    adminFieldLabel: { display:"block", marginBottom:8, color:ADMIN_THEME.textSecondary, fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" },
    adminInput: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", fontFamily:"'Outfit','Space Grotesk',sans-serif", boxShadow:ADMIN_THEME.shadowSoft },
    adminTextarea: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", resize:"vertical", minHeight:120, fontFamily:"'Outfit','Space Grotesk',sans-serif", lineHeight:1.6, boxShadow:ADMIN_THEME.shadowSoft },
    adminButton: (variant) => ({
      padding:"10px 18px",
      borderRadius:8,
      border:`1px solid ${ADMIN_THEME.divider}`,
      cursor:"pointer",
      fontWeight:700,
      fontSize:12.5,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.04em",
      textTransform:"uppercase",
      transition:"all 0.15s ease",
      boxShadow:ADMIN_THEME.shadowSoft,
      ...(variant === "run"
        ? { background:ADMIN_THEME.secondary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.secondary}` }
        : variant === "submit"
          ? { background:ADMIN_THEME.primary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.primary}` }
          : { background:ADMIN_THEME.buttonSecondary, color:ADMIN_THEME.textSecondary, border:`1px solid ${ADMIN_THEME.divider}` }),
    }),
    adminTabBar: { display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", padding:"10px", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.divider}`, borderRadius:14, boxShadow:ADMIN_THEME.shadowSoft },
    adminTabButton: (active) => ({
      padding:"10px 14px",
      borderRadius:8,
      border:active ? `1px solid ${ADMIN_THEME.primary}` : `1px solid ${ADMIN_THEME.divider}`,
      background:active ? ADMIN_THEME.primary : ADMIN_THEME.buttonSecondary,
      color:active ? "#FFFFFF" : ADMIN_THEME.textSecondary,
      cursor:"pointer",
      fontWeight:700,
      fontSize:12,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.04em",
      textTransform:"uppercase",
      transition:"all 0.15s ease",
    }),
    backButtonRow: { display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" },
    backButton: {
      display:"inline-flex",
      alignItems:"center",
      gap:8,
      padding:"10px 14px",
      borderRadius:999,
      border:"1px solid #2a2a3e",
      background:"#151526",
      color:"#d9dcf7",
      cursor:"pointer",
      fontSize:12,
      fontWeight:700,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.08em",
      textTransform:"uppercase",
      boxShadow:"0 10px 24px rgba(0,0,0,0.16)",
    },
    adminBackButton: {
      display:"inline-flex",
      alignItems:"center",
      gap:8,
      padding:"10px 14px",
      borderRadius:999,
      border:`1px solid ${ADMIN_THEME.divider}`,
      background:ADMIN_THEME.card,
      color:ADMIN_THEME.textSecondary,
      cursor:"pointer",
      fontSize:12,
      fontWeight:700,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.08em",
      textTransform:"uppercase",
      boxShadow:ADMIN_THEME.shadowSoft,
    },
    adminAlert: (tone) => ({
      borderRadius:14,
      padding:"12px 14px",
      fontSize:13,
      border:`1px solid ${tone === "warning"
        ? "rgba(217, 119, 6, 0.18)"
        : tone === "error"
          ? "rgba(220, 38, 38, 0.18)"
          : tone === "success"
            ? "rgba(22, 163, 74, 0.18)"
            : "rgba(37, 99, 235, 0.18)"}`,
      background:tone === "warning"
        ? "rgba(217, 119, 6, 0.08)"
        : tone === "error"
          ? "rgba(220, 38, 38, 0.08)"
          : tone === "success"
            ? "rgba(22, 163, 74, 0.08)"
            : ADMIN_THEME.primaryLight,
      color:tone === "warning"
        ? ADMIN_THEME.warning
        : tone === "error"
          ? ADMIN_THEME.error
          : tone === "success"
            ? ADMIN_THEME.success
            : ADMIN_THEME.info,
    }),
    adminBlank: { flex:1, background:ADMIN_THEME.background },
    modalBackdrop: { position:"fixed", inset:0, background:"#05050bcc", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:isPhone ? "12px" : "24px", zIndex:1200 },
    modalCard: { width:"min(720px, 100%)", boxSizing:"border-box", maxHeight:isPhone ? "calc(100vh - 24px)" : "calc(100vh - 48px)", overflowY:"auto", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #25253b", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "22px 16px 24px" : "28px 26px 30px", boxShadow:"0 24px 70px #00000065" },
    startHero: { position:"relative", overflow:"hidden", background:"radial-gradient(circle at 15% 20%, #1c2350 0%, #10111b 42%, #09090f 100%)", border:"1px solid #24263a", borderRadius:isPhone ? 20 : 30, padding:isPhone ? "30px 18px" : "52px 48px", boxShadow:"0 26px 70px #0000004f" },
    startButton: { padding:"14px 24px", borderRadius:16, border:"none", cursor:"pointer", fontWeight:800, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", boxShadow:"0 16px 30px #7c6af733" },
    authChoiceGrid: { display:"grid", gridTemplateColumns:isPhone ? compactGrid : "repeat(2, minmax(0, 1fr))", gap:12 },
    authChoiceButton: (active, tone) => ({
      background: active ? (tone==="student" ? "#101f1b" : tone==="admin" ? "#1d1508" : "#18192a") : "#0f1018",
      border: active ? (tone==="student" ? "1px solid #2e8f76" : tone==="admin" ? "1px solid #7d5d16" : "1px solid #7c6af7") : "1px solid #202233",
      borderRadius:16,
      padding:"18px 16px",
      cursor:"pointer",
      textAlign:"left",
      color:"#eef0ff"
    }),
    startInfoGrid: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "repeat(3, minmax(0, 1fr))", gap:14, marginTop:28 },
    startInfoCard: { background:"#0f1018cc", border:"1px solid #222538", borderRadius:18, padding:"16px 16px 18px", boxShadow:"inset 0 1px 0 #ffffff08" },
    startPillRow: { display:"flex", gap:10, flexWrap:"wrap", marginTop:20 },
    startPill: { padding:"8px 12px", borderRadius:999, background:"#ffffff08", border:"1px solid #ffffff12", color:"#d9dcf7", fontSize:12, fontWeight:600, letterSpacing:"0.02em" },
    authStepper: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:20 },
    authStepChip: (active) => ({
      padding:"8px 12px",
      borderRadius:999,
      border: active ? "1px solid #7c6af7" : "1px solid #202233",
      background: active ? "#17192a" : "#0f1018",
      color: active ? "#eef0ff" : "#7f84a5",
      fontSize:11,
      fontWeight:700,
      letterSpacing:"0.1em",
      textTransform:"uppercase",
      fontFamily:"'Space Grotesk',sans-serif"
    }),
    adminShell: { maxWidth:1240, margin:"0 auto", width:"100%", boxSizing:"border-box", padding:isPhone ? "18px 14px 32px" : `28px ${pageGutter}px 40px`, display:"grid", gap:isPhone ? 16 : 22 },
    adminCardGrid: { display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 150 : 220}px, 1fr))`, gap:isPhone ? 12 : 16 },
    adminCard: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:18, padding:"18px 18px 20px", boxShadow:ADMIN_THEME.shadowSoft },
    adminSectionTitle: { fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, color:ADMIN_THEME.textSecondary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 },
    adminGridTwo: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.35fr 0.95fr", gap:18, alignItems:"start" },
    adminTableWrap: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:18, overflowX:"auto", boxShadow:ADMIN_THEME.shadowSoft },
    adminTableHead: { padding:"14px 16px", textAlign:"left", fontSize:11, color:ADMIN_THEME.textSecondary, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Space Grotesk',sans-serif", background:ADMIN_THEME.hoverBackground },
    adminTableCell: { padding:"14px 16px", borderTop:`1px solid ${ADMIN_THEME.divider}`, fontSize:14, color:ADMIN_THEME.text },
    adminSubCard: { background:ADMIN_THEME.hoverBackground, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:14, padding:"14px" },
  };

  const userBadge = currentUser.name
    ? currentUser.name.trim().charAt(0).toUpperCase()
    : currentUser.email
      ? currentUser.email.trim().charAt(0).toUpperCase()
    : userRole === "admin"
      ? "A"
      : "U";
  const profileAvatarLabel = getAvatarLabel(profileName || "U");
  const adminSelectedProblem = adminCurrentTest.problems?.find((problem) => problem.id === adminSubmissionProblemId)
    || problemCatalog.find((problem) => problem.id === adminSubmissionProblemId)
    || problemCatalog[0];
  const currentTestEnded = adminCurrentTest.status === "ENDED" || adminTimerSeconds === 0;
  const adminCurrentStatus = adminCurrentTest.status || "DRAFT";
  const adminCurrentStatusColor = adminCurrentStatus === "LIVE"
    ? ADMIN_THEME.success
    : adminCurrentStatus === "ENDED"
      ? ADMIN_THEME.error
      : ADMIN_THEME.info;
  const liveAdminAssignments = adminAssignments.filter((assignment) => assignment.status === "LIVE");
  const selectableAdminAssignments = adminAssignments.length ? adminAssignments : [adminCurrentTest].filter(Boolean);
  const loggedInRegisteredStudents = registeredStudents.filter((student) => Number(student.loginCount || 0) > 0);
  const neverLoggedInStudents = registeredStudents.filter((student) => Number(student.loginCount || 0) === 0);
  const departmentTotal = new Set(
    registeredStudents
      .map((student) => String(student.department || "").trim())
      .filter(Boolean)
  ).size;
  const adminLoginEvents = loginEvents.filter((event) => (
    event.role === "ADMIN" || event.email === currentUser.email
  ));
  const displayedProblemBank = problemBank.filter((problem) =>
    questionCategoryFilter === "All" || getProblemCategory(problem) === questionCategoryFilter
  );
  const latestUnreadNotification = studentNotifications.find((notification) => !notification.read) || studentNotifications[0] || null;
  const formatDurationFromMs = (ms = 0) => {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m`
      : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  const renderAdminLeaderboard = () => (
    <div style={{ display:"grid", gap:18 }}>
      <div style={S.adminCard}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
          <div>
            <div style={S.adminSectionTitle}>Leaderboard</div>
            <div style={{ fontSize:24, fontWeight:800, color:ADMIN_THEME.text, marginBottom:6 }}>Admin Ranking Board</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14 }}>Contest, overall, and global scores are loaded from stored submissions.</div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <input value={leaderboardSearch} onChange={(e)=>setLeaderboardSearch(e.target.value)} placeholder="Search username" style={{ ...S.adminInput, width:220 }} />
            <select value={leaderboardScope} onChange={(e)=>setLeaderboardScope(e.target.value)} style={{ ...S.adminInput, width:170 }}>
              {["All", "This Contest", "Global"].map((scope) => <option key={scope}>{scope}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={S.adminTableWrap}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Rank", "Username", "Badge", "Score", "Solved", "Time Penalty"].map((heading) => (
                <th key={heading} style={S.adminTableHead}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleLeaderboardRows.length ? visibleLeaderboardRows.map((entry) => {
              const stats = entry.stats || entry.contest || {};
              const submissionLevel = stats.submissionLevel || "No Submission";
              const levelMeta = getSubmissionLevelMeta(submissionLevel);
              return (
                <tr key={`${leaderboardMode}-${entry.userId || entry.username}`}>
                  <td style={S.adminTableCell}>{stats.rank || "--"}</td>
                  <td style={S.adminTableCell}>
                    <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{entry.username}</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{entry.email || entry.department || "Student"}</div>
                    <div style={{ marginTop:6 }}>
                      <span style={{ color:levelMeta.color, background:levelMeta.background, border:`1px solid ${levelMeta.border}`, borderRadius:999, padding:"3px 8px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                        {submissionLevel}
                      </span>
                    </div>
                  </td>
                  <td style={S.adminTableCell}>
                    {entry.badgeTier ? <AchievementBadge tier={entry.badgeTier} compact /> : <span style={{ color:ADMIN_THEME.textMuted }}>--</span>}
                  </td>
                  <td style={{ ...S.adminTableCell, color:ADMIN_THEME.success, fontWeight:700 }}>{stats.score || 0}</td>
                  <td style={S.adminTableCell}>{stats.problemsSolved || 0}</td>
                  <td style={S.adminTableCell}>{stats.timePenalty || "--"}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="6" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>
                  {leaderboardSearch.trim() ? "No leaderboard entries matched that username." : "No logged-in students have submitted yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaderboardPageCount > 1 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Page {safeLeaderboardPage} of {leaderboardPageCount}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setLeaderboardPage((prev) => Math.max(1, prev - 1))} disabled={safeLeaderboardPage === 1} style={{ ...S.adminButton("default"), opacity:safeLeaderboardPage === 1 ? 0.45 : 1 }}>Previous</button>
            <button onClick={() => setLeaderboardPage((prev) => Math.min(leaderboardPageCount, prev + 1))} disabled={safeLeaderboardPage === leaderboardPageCount} style={{ ...S.adminButton("default"), opacity:safeLeaderboardPage === leaderboardPageCount ? 0.45 : 1 }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderStudentList = () => (
    <div style={{ display:"grid", gap:18 }}>
      <div style={S.adminCardGrid}>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Registered Students</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.primary }}>{registeredStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Logged In</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.success }}>{loggedInRegisteredStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Not Logged Yet</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.warning }}>{neverLoggedInStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Departments</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.secondary }}>{departmentTotal}</div>
        </div>
      </div>

      <div style={S.adminTableWrap}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Student", "USN", "Department", "Badge", "Status", "Last Login", "Logins"].map((heading) => (
                <th key={heading} style={S.adminTableHead}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registeredStudents.length ? registeredStudents.map((student) => (
              <tr key={`${student.email}-${student.usn}`}>
                <td style={S.adminTableCell}>
                  <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{student.name}</div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{student.email}</div>
                </td>
                <td style={S.adminTableCell}>{student.usn || "--"}</td>
                <td style={S.adminTableCell}>{student.department || "--"}</td>
                <td style={S.adminTableCell}>
                  {student.badgeTier ? (
                    <div style={{ display:"grid", gap:5 }}>
                      <AchievementBadge tier={student.badgeTier} compact />
                      <span style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{student.solvedProblemCount} solved</span>
                    </div>
                  ) : (
                    <span style={{ color:ADMIN_THEME.textMuted }}>--</span>
                  )}
                </td>
                <td style={{ ...S.adminTableCell, color:student.status === "Logged In" ? ADMIN_THEME.success : ADMIN_THEME.warning, fontWeight:700 }}>{student.status}</td>
                <td style={S.adminTableCell}>{formatPortalDate(student.lastLoginAt)}</td>
                <td style={{ ...S.adminTableCell, color:ADMIN_THEME.primary, fontWeight:700 }}>{student.loginCount || 0}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No registered students yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAdminProfile = () => (
    <div style={{ display:"grid", gridTemplateColumns:isCompact ? compactGrid : "minmax(280px, 0.75fr) minmax(0, 1.25fr)", gap:18, alignItems:"start" }}>
      <div style={S.adminCard}>
        <div style={S.adminSectionTitle}>Admin Profile</div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
          <div style={{ width:54, height:54, borderRadius:"50%", background:ADMIN_THEME.primary, color:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20 }}>
            {userBadge}
          </div>
          <div>
            <div style={{ color:ADMIN_THEME.text, fontSize:22, fontWeight:800 }}>{profileName}</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>{currentUser.email || "Admin email unavailable"}</div>
          </div>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Role</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>Administrator</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Department</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{currentUser.department || "Department pending"}</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Last Login</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{formatPortalDate(currentUser.lastLoginAt)}</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Login Count</div>
            <div style={{ color:ADMIN_THEME.primary, fontWeight:800, fontSize:24 }}>{currentUser.loginCount || adminLoginEvents.length || 0}</div>
          </div>
        </div>
      </div>

      <div style={S.adminCard}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <div>
            <div style={S.adminSectionTitle}>Login Logs</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>Recent admin authentication activity</div>
          </div>
          <div style={{ color:ADMIN_THEME.primary, fontSize:13, fontWeight:700 }}>{adminLoginEvents.length} records</div>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          {adminLoginEvents.slice(0, 12).map((event) => (
            <div key={event.id} style={S.adminSubCard}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{event.email}</div>
                <div style={{ color:ADMIN_THEME.primary, fontSize:12, fontWeight:700 }}>{event.eventType}</div>
              </div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginBottom:6 }}>
                {event.role} | {formatPortalDate(event.createdAt)}
              </div>
              <div style={{ color:ADMIN_THEME.textMuted, fontSize:12, wordBreak:"break-word" }}>
                {event.ip || "IP unavailable"} | {event.userAgent || "Browser info unavailable"}
              </div>
            </div>
          ))}

          {!adminLoginEvents.length && (
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>No admin login logs yet.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderQuestionBankPanel = () => (
    <div style={S.adminCard}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
        <div>
          <div style={S.adminSectionTitle}>Question Bank</div>
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>{problemBank.length} database questions</div>
        </div>
        <select value={questionCategoryFilter} onChange={(e)=>setQuestionCategoryFilter(e.target.value)} style={{ ...S.adminInput, width:150 }}>
          {["All", ...questionCategories].map((category) => <option key={category}>{category}</option>)}
        </select>
      </div>
      <div style={{ display:"grid", gap:10, maxHeight:720, overflowY:"auto", paddingRight:4 }}>
        {displayedProblemBank.length ? displayedProblemBank.map((problem) => (
          <div key={problem.dbId || problem.id} style={S.adminSubCard}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
              <div>
                <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:6 }}>{problem.title}</div>
                <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                  {getProblemCategory(problem)} | {problem.difficulty} | {problem.tags.slice(0, 4).join(", ") || "General"}
                </div>
              </div>
              <button onClick={() => toggleCreateQuestion(problem.dbId)} style={S.adminButton("default")}>
                {adminCreateForm.questions.includes(problem.dbId) ? "Selected" : "Add"}
              </button>
            </div>
          </div>
        )) : (
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>
            No questions found for this filter.
          </div>
        )}
      </div>
    </div>
  );

  const renderQuestionUploads = () => (
    <div style={{ display:"grid", gridTemplateColumns:isCompact ? compactGrid : "minmax(0, 1fr) minmax(320px, 0.8fr)", gap:18, alignItems:"start" }}>
      <div style={S.adminCard}>
        <div style={S.adminSectionTitle}>Upload Question</div>
        <div style={{ display:"grid", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1.2fr 0.8fr 0.8fr", gap:12 }}>
            <div>
              <label style={S.adminFieldLabel}>Question Title</label>
              <input value={questionUploadForm.title} onChange={(e)=>handleQuestionUploadInput("title", e.target.value)} style={S.adminInput} placeholder="Two Sum Variant" />
            </div>
            <div>
              <label style={S.adminFieldLabel}>Type</label>
              <select value={questionUploadForm.category} onChange={(e)=>handleQuestionUploadInput("category", e.target.value)} style={S.adminInput}>
                {questionCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label style={S.adminFieldLabel}>Difficulty</label>
              <select value={questionUploadForm.difficulty} onChange={(e)=>handleQuestionUploadInput("difficulty", e.target.value)} style={S.adminInput}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
            <div>
              <label style={S.adminFieldLabel}>Function Name</label>
              <input value={questionUploadForm.fnName} onChange={(e)=>handleQuestionUploadInput("fnName", e.target.value)} style={S.adminInput} placeholder="solve" />
            </div>
            <div>
              <label style={S.adminFieldLabel}>Extra Tags</label>
              <input value={questionUploadForm.tags} onChange={(e)=>handleQuestionUploadInput("tags", e.target.value)} style={S.adminInput} placeholder="arrays, hashing" />
            </div>
          </div>

          <div>
            <label style={S.adminFieldLabel}>Question Statement</label>
            <textarea value={questionUploadForm.statement} onChange={(e)=>handleQuestionUploadInput("statement", e.target.value)} style={{ ...S.adminTextarea, minHeight:150 }} placeholder="Write the full question here." />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
            <div>
              <label style={S.adminFieldLabel}>Examples</label>
              <textarea value={questionUploadForm.examples} onChange={(e)=>handleQuestionUploadInput("examples", e.target.value)} style={S.adminTextarea} placeholder={"input => output\n[2,7,11,15], 9 => [0,1]"} />
            </div>
            <div>
              <label style={S.adminFieldLabel}>Hidden Test Cases</label>
              <textarea value={questionUploadForm.testCases} onChange={(e)=>handleQuestionUploadInput("testCases", e.target.value)} style={S.adminTextarea} placeholder={"input => expected\n[3,2,4], 6 => [1,2]"} />
            </div>
          </div>

          <div>
            <label style={S.adminFieldLabel}>Constraints</label>
            <textarea value={questionUploadForm.constraints} onChange={(e)=>handleQuestionUploadInput("constraints", e.target.value)} style={{ ...S.adminTextarea, minHeight:86 }} placeholder={"One constraint per line\n1 <= n <= 10^5"} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
            <div>
              <label style={S.adminFieldLabel}>JavaScript Starter</label>
              <textarea value={questionUploadForm.javascript} onChange={(e)=>handleQuestionUploadInput("javascript", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
            </div>
            <div>
              <label style={S.adminFieldLabel}>Python Starter</label>
              <textarea value={questionUploadForm.python} onChange={(e)=>handleQuestionUploadInput("python", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
            </div>
            <div>
              <label style={S.adminFieldLabel}>Java Starter</label>
              <textarea value={questionUploadForm.java} onChange={(e)=>handleQuestionUploadInput("java", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
            </div>
          </div>

          <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            <button
              onClick={handleUploadQuestion}
              disabled={questionUploading}
              style={{ ...S.adminButton("submit"), opacity:questionUploading ? 0.65 : 1, cursor:questionUploading ? "not-allowed" : "pointer" }}
            >
              {questionUploading ? "Uploading..." : "Upload Question"}
            </button>
            <button
              onClick={() => {
                setQuestionUploadForm(createDefaultQuestionUploadForm());
                setQuestionUploadError("");
              }}
              style={S.adminButton("default")}
            >
              Reset Form
            </button>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>
              Uploaded questions are stored in MongoDB and become available for tests and assignments.
            </div>
          </div>

          {questionUploadError && (
            <div style={S.adminAlert("error")}>
              {questionUploadError}
            </div>
          )}
        </div>
      </div>

      {renderQuestionBankPanel()}
    </div>
  );

  const renderQuestionUploadSuccessModal = () => questionUploadSuccess ? (
    <div style={S.modalBackdrop}>
      <style>{`
        @keyframes uploadSuccessPop {
          0% { opacity: 0; transform: scale(0.82) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes uploadSuccessRing {
          0% { stroke-dashoffset: 166; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes uploadSuccessTick {
          0% { stroke-dashoffset: 36; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
      <div
        style={{
          width:"min(420px, 100%)",
          background:"linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%)",
          border:"1px solid rgba(34, 197, 94, 0.22)",
          borderRadius:28,
          padding:"30px 28px 26px",
          boxShadow:"0 28px 80px rgba(15, 23, 42, 0.28)",
          textAlign:"center",
          animation:"uploadSuccessPop 0.3s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width:96,
            height:96,
            margin:"0 auto 18px",
            borderRadius:"50%",
            background:"radial-gradient(circle at 30% 30%, #dcfce7 0%, #bbf7d0 46%, #86efac 100%)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            boxShadow:"0 18px 40px rgba(34, 197, 94, 0.22)",
          }}
        >
          <svg width="62" height="62" viewBox="0 0 62 62" fill="none" aria-hidden="true">
            <circle
              cx="31"
              cy="31"
              r="26.5"
              stroke="#16A34A"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="166"
              strokeDashoffset="166"
              style={{ animation:"uploadSuccessRing 0.55s ease-out forwards" }}
            />
            <path
              d="M19 31.5L27 39.5L43 22.5"
              stroke="#15803D"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="36"
              strokeDashoffset="36"
              style={{ animation:"uploadSuccessTick 0.35s ease-out 0.4s forwards" }}
            />
          </svg>
        </div>
        <div style={{ color:"#14532d", fontSize:24, fontWeight:800, marginBottom:10 }}>
          Question Uploaded Successfully
        </div>
        <div style={{ color:"#3f3f46", fontSize:15, lineHeight:1.6, marginBottom:22 }}>
          {questionUploadSuccess}
        </div>
        <button
          onClick={() => setQuestionUploadSuccess("")}
          style={{
            minWidth:120,
            padding:"13px 24px",
            border:"none",
            borderRadius:999,
            background:"linear-gradient(135deg, #16a34a, #22c55e)",
            color:"#ffffff",
            fontSize:14,
            fontWeight:800,
            cursor:"pointer",
            boxShadow:"0 14px 30px rgba(34, 197, 94, 0.22)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  ) : null;

  if (view === "home") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <DevOrbitLogo />
          <div style={{ marginLeft:"auto", color:"#676b89", fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
            Cambridge Access Portal
          </div>
        </nav>

        <div style={S.heroShell}>
          <div style={S.startHero}>
            <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:"#4fd1c51c", filter:"blur(10px)", right:-40, top:-60 }} />
            <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:"#7c6af71f", filter:"blur(10px)", left:-30, bottom:-70 }} />
            <div style={{ position:"relative", display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.1fr 0.9fr", gap:isPhone ? 16 : 24, alignItems:"center" }}>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 12px", borderRadius:999, background:"#ffffff0a", border:"1px solid #ffffff14", color:"#8f93b4", fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:18 }}>
                  DevOrbit Learning Hub
                </div>
                <h1 style={{ ...S.homeTitle, maxWidth:720 }}>Build, compete, and track every test from one sleek portal.</h1>
                <p style={{ ...S.problemBody, maxWidth:620, marginBottom:24 }}>
                  A modern assignment space for students and admins with coding rounds, rankings, timers, and real-time monitoring.
                </p>
                <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                  <button onClick={openAuthFlow} style={S.startButton}>Start</button>
                  <span style={{ color:"#8f93b4", fontSize:14 }}>Login or sign up to enter as student or admin.</span>
                </div>
              </div>

              <div style={{ display:"grid", gap:14 }}>
                <div style={{ ...S.roleCard, background:"linear-gradient(180deg,#101723,#0d0d15)" }}>
                  <div style={{ color:"#4fd1c5", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>Student Experience</div>
                  <div style={{ color:"#f4f5ff", fontSize:24, fontWeight:700, lineHeight:1.2 }}>Start tests quickly, run code, and track your score live.</div>
                </div>
                <div style={{ ...S.roleCard, background:"linear-gradient(180deg,#17130b,#0d0d15)" }}>
                  <div style={{ color:"#ffc01e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>Admin Control</div>
                  <div style={{ color:"#f4f5ff", fontSize:24, fontWeight:700, lineHeight:1.2 }}>Create tests, watch participants, and manage the leaderboard from one place.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {authModalOpen && (
          <div style={S.modalBackdrop} onClick={closeAuthFlow}>
            <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ color:"#4fd1c5", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:12 }}>Access Flow</div>
              <h1 style={{ ...S.problemTitle, fontSize:38, marginBottom:12 }}>Enter the portal.</h1>
              <p style={{ ...S.problemBody, marginBottom:24 }}>
                Login uses only mail ID and password. Sign up collects the extra details needed for student or admin access.
              </p>

              <div style={{ display:"grid", gap:18 }}>
                <div>
                  <label style={S.fieldLabel}>Choose Action</label>
                  <div style={S.authChoiceGrid}>
                    <button onClick={() => chooseAuthMode("login")} style={S.authChoiceButton(authMode === "login", "default")}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>Login</div>
                      <div style={{ color:"#8f93b4", fontSize:12 }}>Use mail ID and password only</div>
                    </button>
                    <button onClick={() => chooseAuthMode("signup")} style={S.authChoiceButton(authMode === "signup", "default")}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>Sign Up</div>
                      <div style={{ color:"#8f93b4", fontSize:12 }}>Add your details and create access</div>
                    </button>
                  </div>
                </div>

                {authMode && (
                  <div>
                    <label style={S.fieldLabel}>Choose Role</label>
                    <div style={S.authChoiceGrid}>
                      <button onClick={() => chooseAuthRole("student")} style={S.authChoiceButton(authRole === "student", "student")}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>Student</div>
                        <div style={{ color:"#8f93b4", fontSize:12 }}>Coding tests and leaderboard access</div>
                      </button>
                      <button onClick={() => chooseAuthRole("admin")} style={S.authChoiceButton(authRole === "admin", "admin")}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>Admin</div>
                        <div style={{ color:"#8f93b4", fontSize:12 }}>Manage tests and participants</div>
                      </button>
                    </div>
                  </div>
                )}

                {authMode && authRole && (
                  <div style={{ display:"grid", gap:18 }}>
                    {authMode === "signup" && (
                      <>
                        <div>
                          <label style={S.fieldLabel}>Name</label>
                          <input
                            value={authName}
                            onChange={e=>{ setAuthName(e.target.value); if (authError) setAuthError(""); }}
                            style={S.input}
                            placeholder={authRole === "admin" ? "Enter admin name" : "Enter student name"}
                          />
                        </div>

                        {authRole === "student" && (
                          <div>
                            <label style={S.fieldLabel}>USN</label>
                            <input
                              value={authUsn}
                              onChange={e=>{ setAuthUsn(e.target.value); if (authError) setAuthError(""); }}
                              style={S.input}
                              placeholder="Enter USN"
                            />
                          </div>
                        )}

                        <div>
                          <label style={S.fieldLabel}>Department</label>
                          <select
                            value={authDepartment}
                            onChange={e=>{ setAuthDepartment(e.target.value); if (authError) setAuthError(""); }}
                            style={S.input}
                          >
                            <option value="">Select department</option>
                            <option value="Cyber">Cyber</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ISE">ISE</option>
                            <option value="AIML">AIML</option>
                          </select>
                        </div>

                        <div style={{ background:"#0f1220", border:"1px solid #232843", borderRadius:16, padding:"16px 18px", display:"grid", gap:14 }}>
                          <div style={{ display:"grid", gap:8 }}>
                            <div style={{ color:"#eef0ff", fontSize:14, fontWeight:700 }}>Terms and Conditions</div>
                            <div style={{ color:"#9da4c7", fontSize:13, lineHeight:1.6 }}>
                              By creating an account, you agree to use the portal only for authorized coding activity, keep your credentials private, provide correct student or admin details, and follow contest integrity rules without impersonation, cheating, or misuse of platform content.
                            </div>
                          </div>

                          <div style={{ display:"grid", gap:8 }}>
                            <div style={{ color:"#eef0ff", fontSize:14, fontWeight:700 }}>Privacy Policy</div>
                            <div style={{ color:"#9da4c7", fontSize:13, lineHeight:1.6 }}>
                              The portal stores the information you enter during sign up, including name, email, department, role, and student USN when applicable, to manage access, personalize your profile, and operate contests. Your details are used only for this platform experience and administrative review.
                            </div>
                          </div>

                          <label style={{ display:"flex", gap:10, alignItems:"flex-start", color:"#d8dcff", fontSize:13, lineHeight:1.5, cursor:"pointer" }}>
                            <input
                              type="checkbox"
                              checked={authPoliciesAccepted}
                              onChange={e=>{ setAuthPoliciesAccepted(e.target.checked); if (authError) setAuthError(""); }}
                              style={{ marginTop:2, accentColor:"#7c6af7", cursor:"pointer" }}
                            />
                            <span>
                              I agree to the Terms and Conditions and Privacy Policy. This is required to create a student or admin account.
                            </span>
                          </label>
                        </div>
                      </>
                    )}

                    <div>
                      <label style={S.fieldLabel}>Email ID</label>
                      <input value={authEmail} onChange={e=>{ setAuthEmail(e.target.value); if (authError) setAuthError(""); }} style={S.input} placeholder="name@cambridge.edu.in" />
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Password</label>
                      <input type="password" value={authPassword} onChange={e=>{ setAuthPassword(e.target.value); if (authError) setAuthError(""); }} style={S.input} placeholder="Enter password" />
                    </div>
                  </div>
                )}
              </div>

              {authError && (
                <div style={{ marginTop:18, background:"#180b0b", border:"1px solid #4b1717", color:"#ff9b9b", borderRadius:12, padding:"12px 14px", fontSize:13 }}>
                  {authError}
                </div>
              )}

              <div style={{ display:"flex", gap:12, marginTop:24 }}>
                <button
                  onClick={handleAuthSubmit}
                  disabled={authSubmitting || (authMode === "signup" && !authPoliciesAccepted)}
                  style={{
                    ...S.btn("submit"),
                    opacity: authSubmitting || (authMode === "signup" && !authPoliciesAccepted) ? 0.55 : 1,
                    cursor: authSubmitting || (authMode === "signup" && !authPoliciesAccepted) ? "not-allowed" : "pointer",
                  }}
                >
                  {authSubmitting ? "Please wait..." : authMode === "signup" ? "Create Access" : "Enter Portal"}
                </button>
                <button onClick={closeAuthFlow} style={{ ...S.btn("default"), color:"#c8c8e8" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (view === "admin") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.adminApp, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.adminNav}>
          <DevOrbitLogo lightSurface />
          <span style={S.adminNavTitle}>Admin Portal</span>
          <div style={{ marginLeft:"auto" }}>
            <button onClick={signOut} style={S.adminButton("default")}>Sign Out</button>
          </div>
        </nav>

        <div style={S.adminShell}>
          {renderQuestionUploadSuccessModal()}
          <div style={S.backButtonRow}>
            <button onClick={goBackFromAdmin} style={S.adminBackButton}>
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>
          </div>
          {adminWarning && (
            <div style={S.adminAlert("warning")}>
              {adminWarning}
            </div>
          )}

          {portalError && (
            <div style={S.adminAlert("error")}>
              {portalError}
            </div>
          )}

          {portalMessage && (
            <div style={S.adminAlert("success")}>
              {portalMessage}
            </div>
          )}

          {adminAssignmentsLoading && (
            <div style={S.adminAlert("info")}>
              Loading live portal data from MongoDB...
            </div>
          )}

          <div style={S.adminTabBar}>
            {adminTabs.map((tab) => (
              <button key={tab.id} onClick={() => setAdminTab(tab.id)} style={S.adminTabButton(adminTab === tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {adminTab === "overview" && (
            <>
          <div style={S.adminCardGrid}>
            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Current Test</div>
              <div style={{ fontSize:24, fontWeight:700, color:ADMIN_THEME.text, marginBottom:14 }}>{adminCurrentTest.title}</div>
              <div style={{ display:"grid", gap:8, color:ADMIN_THEME.textSecondary, fontSize:14 }}>
                <div>Level: <span style={{ color:ADMIN_THEME.secondary, fontWeight:700 }}>{adminCurrentTest.level}</span></div>
                <div>Date: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{adminCurrentTest.date}</span></div>
                <div>Duration: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{adminCurrentTest.duration} mins</span></div>
                <div>Status: <span style={{ color:adminCurrentStatusColor, fontWeight:700 }}>{adminCurrentStatus}</span></div>
                <div>Start: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{formatPortalDate(adminCurrentTest.startsAt)}</span></div>
                <div>Timer: <span style={{ color:currentTestEnded ? ADMIN_THEME.error : ADMIN_THEME.primary, fontWeight:700 }}>{formatCountdown(adminTimerSeconds)}</span></div>
              </div>
              <div style={{ marginTop:14 }}>
                <label style={S.adminFieldLabel}>Manage Test</label>
                <select
                  value={adminCurrentTest.id || ""}
                  onChange={(e) => {
                    const selectedAssignment = selectableAdminAssignments.find((assignment) => sameValue(assignment.id, e.target.value));
                    if (!selectedAssignment) return;
                    setAdminCurrentTest(selectedAssignment);
                    setAdminSubmissionProblemId(selectedAssignment?.problems?.[0]?.id || "");
                    setSolutionsVisible(false);
                  }}
                  style={S.adminInput}
                >
                  {selectableAdminAssignments.map((assignment) => (
                    <option key={assignment.id || "default-test"} value={assignment.id || ""}>
                      {assignment.title} - {assignment.status || "DRAFT"}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:16 }}>
                <button
                  onClick={handleStartAssignedTest}
                  disabled={adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE"}
                  style={{
                    ...S.adminButton("submit"),
                    opacity: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? 0.6 : 1,
                    cursor: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? "not-allowed" : "pointer",
                  }}
                >
                  {adminStartingTest ? "Starting..." : adminCurrentTest.status === "LIVE" ? "Test Live" : "Start Test"}
                </button>
                <button
                  onClick={handleStopAssignedTest}
                  disabled={adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE"}
                  style={{
                    ...S.adminButton("default"),
                    color: adminCurrentTest.status === "LIVE" ? ADMIN_THEME.error : ADMIN_THEME.textSecondary,
                    border: adminCurrentTest.status === "LIVE" ? `1px solid ${ADMIN_THEME.error}` : `1px solid ${ADMIN_THEME.border}`,
                    opacity: adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE" ? 0.6 : 1,
                    cursor: adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE" ? "not-allowed" : "pointer",
                  }}
                >
                  {adminStoppingTest ? "Stopping..." : "Stop Test"}
                </button>
                <button
                  onClick={() => syncProblemBankToDatabase(false)}
                  disabled={adminSyncingProblems}
                  style={{ ...S.adminButton("default"), opacity: adminSyncingProblems ? 0.6 : 1, cursor: adminSyncingProblems ? "not-allowed" : "pointer" }}
                >
                  {adminSyncingProblems ? "Syncing..." : "Sync Problems"}
                </button>
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Test Queue</div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginBottom:12 }}>
                Live now: <span style={{ color:ADMIN_THEME.success, fontWeight:700 }}>{liveAdminAssignments.length}</span>
              </div>
              <div style={{ display:"grid", gap:10 }}>
                {selectableAdminAssignments.slice(0, 5).map((test, index) => (
                  <button
                    key={test.id || `test-${index}`}
                    onClick={() => {
                      setAdminCurrentTest(test);
                      setAdminSubmissionProblemId(test?.problems?.[0]?.id || "");
                      setSolutionsVisible(false);
                    }}
                    style={{
                      background:adminCurrentTest?.id===test.id ? ADMIN_THEME.sidebarActive : ADMIN_THEME.hoverBackground,
                      border:adminCurrentTest?.id===test.id ? `1px solid ${ADMIN_THEME.primary}` : `1px solid ${ADMIN_THEME.border}`,
                      borderRadius:12,
                      color:ADMIN_THEME.text,
                      padding:"12px 14px",
                      textAlign:"left",
                      cursor:"pointer",
                      boxShadow:adminCurrentTest?.id===test.id ? ADMIN_THEME.shadowSoft : "none"
                    }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center" }}>
                      <span style={{ fontWeight:700 }}>{test.title || test.name}</span>
                      <span style={{ color:test.status === "LIVE" ? ADMIN_THEME.success : test.status === "ENDED" ? ADMIN_THEME.error : ADMIN_THEME.info, fontSize:11, fontWeight:800 }}>{test.status || "ENDED"}</span>
                    </div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{test.date} | {test.level || test.difficulty}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Participants</div>
              <div style={{ fontSize:32, fontWeight:800, color:ADMIN_THEME.primary, lineHeight:1, marginBottom:10 }}>{participantsCount}</div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14, marginBottom:12 }}>Students with login activity stored in MongoDB</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:999, background:"rgba(22, 163, 74, 0.08)", border:"1px solid rgba(22, 163, 74, 0.18)", color:ADMIN_THEME.success, fontSize:12, fontWeight:700 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:ADMIN_THEME.success, boxShadow:"0 0 0 4px rgba(22, 163, 74, 0.12)" }} />
                Login-tracked
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Solutions</div>
              <div style={{ fontSize:14, color:ADMIN_THEME.textSecondary, marginBottom:14 }}>Submitted solutions become viewable after the timer ends.</div>
              <button
                onClick={() => setSolutionsVisible((prev) => !prev)}
                disabled={!currentTestEnded}
                style={{
                  ...(currentTestEnded ? S.adminButton("run") : S.adminButton("default")),
                  opacity:currentTestEnded?1:0.7,
                  cursor:currentTestEnded?"pointer":"not-allowed"
                }}
              >
                View Solutions
              </button>
            </div>
          </div>

          {currentTestEnded && adminTestReport && (
            <div style={{ display:"grid", gap:18 }}>
              <div style={S.adminCard}>
                <div style={S.adminSectionTitle}>Post-Test Report</div>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 140 : 180}px, 1fr))`, gap:12 }}>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Attendance</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{adminTestReport.attendedCount}/{adminTestReport.totalStudents}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Best Student</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:18, fontWeight:800 }}>{adminTestReport.bestStudent?.name || "--"}</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{adminTestReport.bestStudent?.score || 0} points</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Average Score</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{adminTestReport.averageScore}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Average Time</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{formatDurationFromMs(adminTestReport.averageTimeSpentMs)}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Interrupted</div>
                    <div style={{ color:ADMIN_THEME.error, fontSize:24, fontWeight:800 }}>{adminTestReport.interruptedCount}</div>
                  </div>
                </div>
              </div>

              <div style={S.adminTableWrap}>
                <div style={{ padding:"18px 18px 8px" }}>
                  <div style={S.adminSectionTitle}>Student Attendance & Activity</div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14 }}>Each student’s attendance, score, time usage, submissions, and interruption details.</div>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
                  <thead>
                    <tr>
                      {["Student", "Attendance", "Score", "Solved", "Time Used", "Submissions", "Interruptions", "Result"].map((heading) => (
                        <th key={heading} style={S.adminTableHead}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminTestReport.students.map((student) => (
                      <tr key={student.userId}>
                        <td style={S.adminTableCell}>
                          <div style={{ fontWeight:700 }}>{student.name}</div>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{student.usn || student.email}</div>
                        </td>
                        <td style={S.adminTableCell}>{student.attendance}</td>
                        <td style={S.adminTableCell}>{student.score}</td>
                        <td style={S.adminTableCell}>{student.solved}</td>
                        <td style={S.adminTableCell}>{formatDurationFromMs(student.timeSpentMs)}</td>
                        <td style={S.adminTableCell}>{student.submissionCount}</td>
                        <td style={{ ...S.adminTableCell, color:student.interruptionCount ? ADMIN_THEME.error : ADMIN_THEME.success }}>
                          {student.interruptionCount}
                        </td>
                        <td style={S.adminTableCell}>
                          <div>{student.attemptStatus}</div>
                          {student.finishReason && (
                            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{student.finishReason}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 340}px, 1fr))`, gap:18, alignItems:"start" }}>
            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Code Submission</div>
              <div style={{ display:"grid", gap:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
                  <div>
                    <label style={S.adminFieldLabel}>Question</label>
                    <select
                      value={String(adminSubmissionProblemId ?? "")}
                      onChange={(e) => {
                        const selectedProblem = adminCurrentTest.problems?.find((problem) => String(problem.id) === e.target.value)
                          || problemCatalog.find((problem) => String(problem.id) === e.target.value);
                        setAdminSubmissionProblemId(selectedProblem ? selectedProblem.id : e.target.value);
                      }}
                      style={S.adminInput}
                    >
                      {adminCurrentTest.questions.map((id) => {
                        const problem = adminCurrentTest.problems?.find((item) => item.id === id)
                          || problemCatalog.find((item) => item.id === id);
                        return <option key={id} value={id}>{problem ? `${problem.id}. ${problem.title}` : id}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Language</label>
                    <select value={adminSubmissionLang} onChange={(e)=>setAdminSubmissionLang(e.target.value)} style={S.adminInput}>
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...S.adminSubCard, padding:"0", overflow:"hidden" }}>
                  <div style={{ padding:"10px 12px", borderBottom:`1px solid ${ADMIN_THEME.divider}`, color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                    Write solution for {adminSelectedProblem?.title || "the selected problem"}
                  </div>
                  <textarea
                    ref={adminTextareaRef}
                    value={adminSubmissionCode}
                    onChange={(e)=>setAdminSubmissionCode(e.target.value)}
                    onKeyDown={(e) => handleEditorIndentation(e, adminSubmissionCode, setAdminSubmissionCode, adminTextareaRef, adminSubmissionLang)}
                    spellCheck={false}
                    style={{ width:"100%", minHeight:240, background:ADMIN_THEME.background, color:ADMIN_THEME.text, border:"none", outline:"none", resize:"vertical", padding:"14px", fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.7, boxSizing:"border-box" }}
                  />
                </div>

                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  <button
                    onClick={() => handleAdminRun(false)}
                    disabled={adminExecuting}
                    style={{ ...S.adminButton("run"), opacity: adminExecuting ? 0.65 : 1, cursor: adminExecuting ? "not-allowed" : "pointer" }}
                  >
                    {adminExecuting ? "Running..." : "Run Code"}
                  </button>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, alignSelf:"center" }}>
                    Execution uses the current backend runner, now powered by Judge0.
                  </div>
                </div>

                {adminExecution && (
                  <div style={S.adminSubCard}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:12, flexWrap:"wrap" }}>
                      <div style={{ color:adminExecution.status==="passed" ? ADMIN_THEME.success : ADMIN_THEME.error, fontWeight:700 }}>
                        {adminExecution.autoSubmitted ? "Auto-submitted" : "Execution Result"}
                      </div>
                      <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Runtime: {adminExecution.runtime}</div>
                    </div>
                    <div style={{ display:"grid", gap:10 }}>
                      {adminExecution.tests.map((test, index) => (
                        <div key={index} style={{ background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, padding:"12px 14px" }}>
                          <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:6 }}>Case {index + 1}</div>
                          <div style={{ color:test.status==="pass" ? ADMIN_THEME.success : test.status==="fail" ? ADMIN_THEME.error : ADMIN_THEME.warning, fontSize:13, marginBottom:6 }}>
                            {test.status.toUpperCase()}
                          </div>
                          {test.error ? (
                            <div style={{ color:ADMIN_THEME.error, fontSize:12, whiteSpace:"pre-wrap" }}>{test.error}</div>
                          ) : (
                            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                              Expected: <span style={{ color:ADMIN_THEME.text }}>{test.expected}</span>
                              <br />
                              Got: <span style={{ color:ADMIN_THEME.text }}>{test.actual}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display:"grid", gap:18 }}>
              <div style={S.adminCard}>
                <div style={S.adminSectionTitle}>Create New Test</div>
                <div style={{ display:"grid", gap:14 }}>
                  <div>
                    <label style={S.adminFieldLabel}>Test Title</label>
                    <input value={adminCreateForm.title} onChange={(e)=>handleAdminCreateInput("title", e.target.value)} style={S.adminInput} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
                    <div>
                      <label style={S.adminFieldLabel}>Difficulty</label>
                      <select value={adminCreateForm.level} onChange={(e)=>handleAdminCreateInput("level", e.target.value)} style={S.adminInput}>
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.adminFieldLabel}>Duration (mins)</label>
                      <input value={adminCreateForm.duration} onChange={(e)=>handleAdminCreateInput("duration", e.target.value)} style={S.adminInput} />
                    </div>
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Database Problems</label>
                    <div style={{ maxHeight:220, overflowY:"auto", display:"grid", gap:10, paddingRight:4 }}>
                      {problemBankLoading ? (
                        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>Loading database problems...</div>
                      ) : problemBank.length ? (
                        problemBank.map((problem) => {
                          const checked = adminCreateForm.questions.includes(problem.dbId);
                          return (
                            <label key={problem.dbId} style={{ ...S.adminSubCard, display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCreateQuestion(problem.dbId)}
                                style={{ marginTop:2, accentColor:ADMIN_THEME.primary, cursor:"pointer" }}
                              />
                              <span style={{ display:"grid", gap:6 }}>
                                <span style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{problem.title}</span>
                                <span style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{getProblemCategory(problem)} | {problem.difficulty} | {problem.tags.slice(0, 3).join(", ") || "General"}</span>
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>No database problems yet. Use Sync Problems or upload a question.</div>
                      )}
                    </div>
                  </div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                    Selected: <span style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{adminCreateForm.questions.length}</span> database problems
                  </div>
                  <button
                    onClick={handleCreateTest}
                    disabled={adminCreatingTest}
                    style={{ ...S.adminButton("submit"), opacity: adminCreatingTest ? 0.65 : 1, cursor: adminCreatingTest ? "not-allowed" : "pointer" }}
                  >
                    {adminCreatingTest ? "Saving..." : "Save Draft Test"}
                  </button>
                </div>
              </div>

              {solutionsVisible && (
                <div style={S.adminCard}>
                  <div style={S.adminSectionTitle}>Submitted Solutions</div>
                  <div style={{ display:"grid", gap:10 }}>
                    {adminCurrentTest.questions.map((id) => {
                      const problem = adminCurrentTest.problems?.find((item) => item.id === id)
                        || problemCatalog.find((item) => item.id === id);
                      return (
                        <div key={id} style={S.adminSubCard}>
                          <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:4 }}>{problem?.title || `Problem ${id}`}</div>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Top submission visible after test completion. Connect secure storage/backend to load real submitted code.</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
            </>
          )}

          {adminTab === "questions" && renderQuestionUploads()}
          {adminTab === "leaderboard" && renderAdminLeaderboard()}
          {adminTab === "students" && renderStudentList()}
          {adminTab === "profile" && renderAdminProfile()}
        </div>
      </div>
    </div>
  );

  // ── PROBLEM LIST ───────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <nav style={S.nav}>
        <DevOrbitLogo />
        <button onClick={()=>setView("list")} style={S.navBtn(true)}>
          <span style={S.navBtnLabel(true)}>Problems</span>
          <span style={S.navBtnHint(true)}>Daily coding practice</span>
        </button>
        <button onClick={openContest} style={S.navBtn(false)}>
          <span style={S.navBtnLabel(false)}>Contest</span>
          <span style={S.navBtnHint(false)}>Timed challenge rounds</span>
        </button>
        <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
          <span style={S.navBtnLabel(false)}>Leaderboard</span>
          <span style={S.navBtnHint(false)}>See the top performers</span>
        </button>
        <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
          {notificationCount > 0 && (
            <span style={{ padding:"6px 10px", borderRadius:999, background:"#111b22", border:"1px solid #1d4f5d", color:"#7ce7ff", fontSize:12, fontWeight:700 }}>
              {notificationCount} new
            </span>
          )}
          <span style={{ color:"#7c6af7", fontSize:13 }}>🏆 {solved.size} solved</span>
          {currentAchievement && <AchievementBadge tier={currentUser.badgeTier} compact />}
          <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:isPhone ? "20px auto" : "32px auto", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box" }}>
        {latestUnreadNotification && (
          <div style={{ background:"#101926", border:"1px solid #243c5a", borderRadius:16, padding:"16px 18px", marginBottom:18, display:"flex", justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap" }}>
            <div>
              <div style={{ color:"#93c5fd", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                Student Notification
              </div>
              <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>{latestUnreadNotification.title}</div>
              <div style={{ color:"#9fb4ff", fontSize:13 }}>{latestUnreadNotification.message}</div>
            </div>
            {!latestUnreadNotification.read && (
              <button onClick={() => markNotificationAsRead(latestUnreadNotification.id)} style={{ ...S.btn("default"), color:"#dfe2ff" }}>
                Mark Read
              </button>
            )}
          </div>
        )}

        {portalError && (
          <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13, marginBottom:18 }}>
            {portalError}
          </div>
        )}

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 150 : 220}px, 1fr))`, gap:16, marginBottom:32 }}>
          {[{label:"Easy",color:"#00b8a3"},{label:"Medium",color:"#ffc01e"},{label:"Hard",color:"#ff375f"}].map(s=>(
            <div key={s.label} style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:32, borderRadius:4, background:s.color }} />
              <div>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{problemCatalog.filter(p=>p.difficulty===s.label).length}</div>
                <div style={{ fontSize:12, color:"#666" }}>{s.label} Problems</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
          <input placeholder="🔍  Search problems..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{ flex:1, minWidth:220, background:"#111118", border:"1px solid #1e1e2e", borderRadius:8, padding:"10px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none", letterSpacing:"0.01em" }} />
          {["All","Easy","Medium","Hard"].map(d=>(
            <button key={d} onClick={()=>setFilterDiff(d)} style={{ ...S.btn("default"), background:filterDiff===d?"#1a1a2e":"transparent", color:filterDiff===d?"#7c6af7":"#666", border:filterDiff===d?"1px solid #7c6af7":"1px solid #1e1e2e" }}>{d}</button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:isPhone ? 720 : "100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1e1e2e" }}>
                {["Status","#","Title","Tags","Difficulty","Acceptance"].map(h=>(
                  <th key={h} style={S.tableHead}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map(p=>(
                <tr key={p.id} onClick={()=>openProblem(p, "catalog")} style={{ borderBottom:"1px solid #0f0f1a", cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"14px 16px", width:60 }}>{solved.has(p.id)?<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#00b8a3" fillOpacity="0.15"/><path d="M5 8l2 2 4-4" stroke="#00b8a3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>:<span style={{ color:"#333", fontSize:12 }}>—</span>}</td>
                  <td style={{ padding:"14px 16px", color:"#444", fontSize:13 }}>{p.id}</td>
                  <td style={{ padding:"14px 16px" }}><span style={S.tableTitle}>{p.title}</span></td>
                  <td style={{ padding:"14px 16px" }}><div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{p.tags.slice(0,2).map(t=><span key={t} style={S.tag}>{t}</span>)}</div></td>
                  <td style={{ padding:"14px 16px" }}><span style={S.badge(p.difficulty)}>{p.difficulty}</span></td>
                  <td style={{ padding:"14px 16px", color:"#555", fontSize:13 }}>{p.acceptance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );

  if (view === "profile") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, background:"#0f172a", color:"#e2e8f0", fontFamily:"'Poppins','Inter','Outfit',sans-serif", opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <nav style={{ ...S.nav, background:"#0b1220", borderBottom:"1px solid #1e293b" }}>
          <DevOrbitLogo />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Practice arena</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Live round hub</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>Ranking board</span>
          </button>
          <button style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Profile</span>
            <span style={S.navBtnHint(true)}>Dashboard overview</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            {notificationCount > 0 && (
              <span style={{ padding:"6px 10px", borderRadius:999, background:"#111b22", border:"1px solid #1d4f5d", color:"#7ce7ff", fontSize:12, fontWeight:700 }}>
                {notificationCount} new
              </span>
            )}
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg, ${profileAvatarGradient[0]}, ${profileAvatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#081018", boxShadow:"0 0 18px rgba(96,165,250,0.28)" }}>{profileAvatarLabel}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1260, margin:"28px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92))", border:"1px solid #1e293b", borderRadius:28, padding:"28px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ width:92, height:92, borderRadius:"50%", background:`linear-gradient(135deg, ${profileAvatarGradient[0]}, ${profileAvatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:28, boxShadow:"0 0 28px rgba(96,165,250,0.25)" }}>
                  {profileAvatarLabel}
                </div>
                <div>
                  <div style={{ color:"#f8fafc", fontSize:32, fontWeight:700, lineHeight:1.1 }}>{profileName}</div>
                  <div style={{ color:"#93c5fd", fontSize:15, fontWeight:600, marginTop:6 }}>{currentUser.email || "--"}</div>
                  <div style={{ color:"#94a3b8", fontSize:14, maxWidth:620, marginTop:10, lineHeight:1.7 }}>
                    {[
                      currentUser.department || null,
                      currentUser.usn ? `USN: ${currentUser.usn}` : null,
                      currentUser.role ? formatDisplayName(currentUser.role) : null,
                    ].filter(Boolean).join(" | ") || "Personal details will appear here once your account data is available."}
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:14 }}>
                    <span style={{ padding:"8px 12px", borderRadius:999, background:"#111c34", border:"1px solid #1d4ed8", color:"#93c5fd", fontSize:12, fontWeight:700 }}>
                      {currentUser.verified ? "Verified Account" : "Unverified Account"}
                    </span>
                    <span style={{ padding:"8px 12px", borderRadius:999, background:"#18112e", border:"1px solid #7c3aed", color:"#c4b5fd", fontSize:12, fontWeight:700 }}>
                      {currentUser.role ? formatDisplayName(currentUser.role) : "User"}
                    </span>
                    {currentAchievement ? (
                      <AchievementBadge tier={currentUser.badgeTier} />
                    ) : (
                      <span style={{ padding:"8px 12px", borderRadius:999, background:"#111827", border:"1px solid #334155", color:"#cbd5e1", fontSize:12, fontWeight:700 }}>
                        Next badge at 51 solved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16 }}>
            {profileStats.map((stat) => (
              <div key={stat.label} onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:22, padding:"18px 18px 20px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{stat.label}</div>
                <div style={{ color:stat.accent, fontSize:30, fontWeight:700, lineHeight:1 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 320}px, 1fr))`, gap:20, alignItems:"start" }}>
            <div style={{ display:"grid", gap:20 }}>
              <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Personal Details</div>
                <div style={{ color:"#f8fafc", fontSize:24, fontWeight:700, marginBottom:18 }}>Account information</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14 }}>
                  {profileDetails.map((item) => (
                    <div key={item.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:16, padding:"14px 16px" }}>
                      <div style={{ color:"#94a3b8", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{item.label}</div>
                      <div style={{ color:"#f8fafc", fontSize:15, fontWeight:600, wordBreak:"break-word" }}>{item.value || "--"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20 }}>
                <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                  <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Problem Breakdown</div>
                  <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:18 }}>Difficulty progress</div>
                  <div style={{ display:"grid", gap:14 }}>
                    {profileDifficultyBreakdown.map((item) => (
                      <div key={item.label}>
                        <div style={{ display:"flex", justifyContent:"space-between", color:"#cbd5e1", fontSize:14, marginBottom:8 }}>
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div style={{ height:10, borderRadius:999, background:"#111827", overflow:"hidden" }}>
                          <div style={{ width:`${(item.value / item.total) * 100}%`, height:"100%", borderRadius:999, background:item.color, boxShadow:`0 0 18px ${item.color}55`, transition:"width 0.35s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                  <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Leaderboard Snapshot</div>
                  <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:18 }}>Live ranking data</div>
                  {profileEntry ? (
                    <div style={{ display:"grid", gap:12, color:"#cbd5e1", fontSize:14, lineHeight:1.7 }}>
                      <div>Contest rank: <span style={{ color:"#93c5fd", fontWeight:700 }}>#{profileEntry.contest.rank}</span></div>
                      <div>Contest score: <span style={{ color:"#67e8f9", fontWeight:700 }}>{profileEntry.contest.score}</span></div>
                      <div>Overall solved: <span style={{ color:"#22c55e", fontWeight:700 }}>{profileEntry.overall.problemsSolved}</span></div>
                      <div>Global rank: <span style={{ color:"#c4b5fd", fontWeight:700 }}>#{profileEntry.global.rank}</span></div>
                    </div>
                  ) : (
                    <div style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7 }}>
                      No leaderboard data is available for your account yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gap:20 }}>
              <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Account Summary</div>
                <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:14 }}>Personal overview</div>
                <div style={{ display:"grid", gap:10, color:"#cbd5e1", fontSize:14, lineHeight:1.7 }}>
                  <div>Name: <span style={{ color:"#f8fafc", fontWeight:700 }}>{profileName}</span></div>
                  <div>Email: <span style={{ color:"#93c5fd", fontWeight:700 }}>{currentUser.email || "--"}</span></div>
                  <div>Department: <span style={{ color:"#67e8f9", fontWeight:700 }}>{currentUser.department || "--"}</span></div>
                  <div>USN: <span style={{ color:"#c4b5fd", fontWeight:700 }}>{currentUser.usn || "--"}</span></div>
                  <div>Badge: <span style={{ color:currentAchievement?.color || "#cbd5e1", fontWeight:700 }}>{currentUser.badgeLabel || "Not earned yet"}</span></div>
                  <div>Verified: <span style={{ color:currentUser.verified ? "#22c55e" : "#fbbf24", fontWeight:700 }}>{currentUser.verified ? "Yes" : "No"}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 360}px, 1fr))`, gap:20 }}>
            <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
              <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Submission History</div>
              <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:16 }}>Recent runs</div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Problem Name", "Status", "Language", "Time"].map((heading) => (
                      <th key={heading} style={{ textAlign:"left", padding:"0 0 12px", color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profileSubmissionHistory.length ? profileSubmissionHistory.map((row) => (
                    <tr key={`${row.problemId}-${row.time}`} style={{ borderTop:"1px solid #172033" }}>
                      <td style={{ padding:"12px 0" }}>
                        <button onClick={() => openProblem(problemCatalog.find((problem) => sameValue(problem.dbId, row.problemDbId) || sameValue(problem.id, row.problemId)) || problemCatalog[0], "catalog")} style={{ background:"none", border:"none", padding:0, color:"#93c5fd", cursor:"pointer", fontWeight:600, textAlign:"left" }}>
                          {row.problemName}
                        </button>
                      </td>
                      <td style={{ padding:"12px 0", color:row.status === "Accepted" ? "#22c55e" : row.status === "Wrong Answer" ? "#f87171" : "#fbbf24", fontWeight:600 }}>{row.status}</td>
                      <td style={{ padding:"12px 0", color:"#cbd5e1" }}>{row.language}</td>
                      <td style={{ padding:"12px 0", color:"#94a3b8" }}>{row.time}</td>
                    </tr>
                  )) : (
                    <tr style={{ borderTop:"1px solid #172033" }}>
                      <td colSpan="4" style={{ padding:"14px 0", color:"#94a3b8" }}>No submission history available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
              <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Contest History</div>
              <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:16 }}>Recent rounds</div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Contest Name", "Rank", "Score", "Rating"].map((heading) => (
                      <th key={heading} style={{ textAlign:"left", padding:"0 0 12px", color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profileContestHistory.length ? profileContestHistory.map((row) => (
                    <tr key={row.name} style={{ borderTop:"1px solid #172033" }}>
                      <td style={{ padding:"12px 0", color:"#e2e8f0", fontWeight:600 }}>{row.name}</td>
                      <td style={{ padding:"12px 0", color:"#93c5fd" }}>{row.rank}</td>
                      <td style={{ padding:"12px 0", color:"#cbd5e1" }}>{row.score}</td>
                      <td style={{ padding:"12px 0", color:"#22c55e", fontWeight:700 }}>{row.rating}</td>
                    </tr>
                  )) : (
                    <tr style={{ borderTop:"1px solid #172033" }}>
                      <td colSpan="4" style={{ padding:"14px 0", color:"#94a3b8" }}>No contest history available for your account yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:4 }}>
            <button
              onClick={signOut}
              style={{
                background:"linear-gradient(135deg, #ef4444, #dc2626)",
                border:"1px solid #f87171",
                color:"#fff",
                padding:"12px 20px",
                borderRadius:14,
                fontSize:14,
                fontWeight:700,
                cursor:"pointer",
                boxShadow:"0 14px 28px rgba(220,38,38,0.24)",
                fontFamily:"inherit",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "contest") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        {contestInstructionsOpen && (
          <div style={S.modalBackdrop}>
            <div style={{ ...S.modalCard, width:"min(680px, 100%)" }}>
              <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Test Instructions</div>
              <h2 style={{ margin:"0 0 12px", color:"#f5f6ff", fontSize:30, lineHeight:1.1 }}>{contestDisplayName}</h2>
              <div style={{ color:"#a9aed0", fontSize:14, lineHeight:1.8, marginBottom:18 }}>
                The test will open in fullscreen. Leaving fullscreen, switching tabs/windows, pressing restricted keys such as Esc/F11/Windows, or returning back from the test screen will end the test and show your result.
              </div>
              <div style={{ display:"grid", gap:10, background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 16px", color:"#d9dcf7", fontSize:14, lineHeight:1.7, marginBottom:16 }}>
                <div>Problems: <strong>{contestProblems.length}</strong></div>
                <div>Duration: <strong>{activeContestAssignment?.duration || adminCurrentTest.duration} minutes</strong></div>
                <div>Camera: <strong>required before the test starts</strong></div>
                <div>Final question: use <strong>Final Submit</strong> and confirm before ending the test.</div>
                <div>Result: accepted, rejected, and not-attempted problems will be shown with your score.</div>
              </div>
              <div style={{
                background:contestCameraStatus === "granted" ? "#0d1813" : contestCameraError ? "#190d10" : "#10131d",
                border:contestCameraStatus === "granted" ? "1px solid #1f6f45" : contestCameraError ? "1px solid #6b1f2a" : "1px solid #24283a",
                color:contestCameraStatus === "granted" ? "#86efac" : contestCameraError ? "#fda4af" : "#a9aed0",
                borderRadius:14,
                padding:"12px 14px",
                fontSize:13,
                lineHeight:1.6,
                marginBottom:16,
              }}>
                {contestCameraStatus === "granted"
                  ? "Camera permission granted. The camera will stay active during the test."
                  : contestCameraStatus === "requesting"
                    ? "Requesting camera permission..."
                    : contestCameraError || "When you click Start Test, the browser will ask for camera permission."}
              </div>
              <label style={{ display:"flex", gap:10, alignItems:"flex-start", color:"#cdd2ef", fontSize:14, lineHeight:1.6, marginBottom:20, cursor:"pointer" }}>
                <input type="checkbox" checked={contestInstructionsAccepted} onChange={(e)=>setContestInstructionsAccepted(e.target.checked)} style={{ marginTop:4 }} />
                <span>I have read the instructions and understand that leaving the test window will end my test.</span>
              </label>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
                <button onClick={closeContestInstructions} style={S.btn("default")}>Cancel</button>
                <button
                  onClick={startContestAfterInstructions}
                  disabled={!contestInstructionsAccepted || contestCameraStatus === "requesting"}
                  style={{ ...S.btn("submit"), opacity:contestInstructionsAccepted && contestCameraStatus !== "requesting" ? 1 : 0.5, cursor:contestInstructionsAccepted && contestCameraStatus !== "requesting" ? "pointer" : "not-allowed" }}
                >
                  {contestCameraStatus === "requesting" ? "Requesting Camera..." : "Start Test"}
                </button>
              </div>
            </div>
          </div>
        )}
        <nav style={S.nav}>
          <DevOrbitLogo />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Contest</span>
            <span style={S.navBtnHint(true)}>Timed challenge rounds</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>See the top performers</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ color:"#7c6af7", fontSize:13 }}>🏆 {solved.size} solved</span>
            {currentAchievement && <AchievementBadge tier={currentUser.badgeTier} compact />}
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1180, margin:"32px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          {latestUnreadNotification && (
            <div style={{ background:"#101926", border:"1px solid #243c5a", borderRadius:16, padding:"16px 18px", display:"flex", justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap" }}>
              <div>
                <div style={{ color:"#93c5fd", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                  Student Notification
                </div>
                <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>{latestUnreadNotification.title}</div>
                <div style={{ color:"#9fb4ff", fontSize:13 }}>{latestUnreadNotification.message}</div>
              </div>
              {!latestUnreadNotification.read && (
                <button onClick={() => markNotificationAsRead(latestUnreadNotification.id)} style={{ ...S.btn("default"), color:"#dfe2ff" }}>
                  Mark Read
                </button>
              )}
            </div>
          )}

          {portalError && (
            <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13 }}>
              {portalError}
            </div>
          )}

          {activeContestOptions.length > 1 && (
            <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px", display:"grid", gap:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                <div>
                  <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:6 }}>Available Tests</div>
                  <div style={{ color:"#eef0ff", fontWeight:700 }}>Choose the live test you want to attempt.</div>
                </div>
                <span style={{ color:"#73f0b3", fontSize:13, fontWeight:700 }}>{activeContestOptions.length} live</span>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {activeContestOptions.map((assignment) => (
                  <button
                    key={assignment.id}
                    onClick={() => {
                      setActiveAssignment(assignment);
                      setAdminCurrentTest(assignment);
                      setContestEntered(false);
                      setContestSessionEndsAt(null);
                      setContestResult(null);
                    }}
                    style={{
                      ...S.btn(sameValue(activeContestAssignment?.id, assignment.id) ? "submit" : "default"),
                      minHeight:42,
                      color:sameValue(activeContestAssignment?.id, assignment.id) ? undefined : "#dfe2ff",
                    }}
                  >
                    {assignment.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background:"radial-gradient(circle at top left, rgba(124,106,247,0.22), rgba(10,10,15,0.98) 50%)", border:"1px solid #25253b", borderRadius:24, padding:"28px 28px 30px", boxShadow:"0 24px 70px rgba(0,0,0,0.32)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              <div style={{ maxWidth:720 }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Live Contest</div>
                <h1 style={{ margin:"0 0 12px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:42, lineHeight:1, letterSpacing:"-0.04em" }}>{contestDisplayName}</h1>
                <div style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7, marginBottom:18 }}>
                  Solve the active round, keep your penalty low, and move fast through the curated set of contest problems.
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ padding:"10px 14px", borderRadius:14, background:"#0f131c", border:"1px solid #24283a" }}>
                    <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{contestSessionEndsAt ? "Time Left" : "Duration"}</div>
                    <div style={{ color:"#eef0ff", fontSize:28, fontWeight:700, lineHeight:1 }}>{formatCountdown(contestTimerSeconds)}</div>
                  </div>
                  <div style={{ padding:"10px 14px", borderRadius:999, border:`1px solid ${contestStatusTone.border}`, background:contestStatusTone.background, color:contestStatusTone.color, fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
                    {contestStatus}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gap:12, minWidth:"min(100%, 280px)" }}>
                <button
                  onClick={() => handleEnterContest(contestProblems[0])}
                  disabled={contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt}
                  style={{
                    ...S.btn("submit"),
                    minHeight:52,
                    minWidth:220,
                    fontSize:13,
                    opacity:contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt ? 0.55 : 1,
                    cursor:contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt ? "not-allowed" : "pointer",
                    boxShadow:"0 16px 30px rgba(124,106,247,0.28)",
                  }}
                >
                  {contestStatus === "Awaiting Start"
                    ? "Awaiting Admin Start"
                    : contestStatus === "Ended"
                      ? "Contest Ended"
                      : hasUsedContestAttempt
                        ? "Attempt Already Used"
                        : contestEntered
                          ? "Resume Test"
                          : "Start Test"}
                </button>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px", color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>Contest Snapshot</div>
                  <div>Problems: <span style={{ color:"#f5f6ff" }}>{contestProblems.length}</span></div>
                  <div>Participants: <span style={{ color:"#f5f6ff" }}>{participantsCount}</span></div>
                  <div>Duration: <span style={{ color:"#f5f6ff" }}>{activeContestAssignment?.duration || adminCurrentTest.duration} mins</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 320}px, 1fr))`, gap:20, alignItems:"start" }}>
            <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, overflow:"hidden", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
              <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid #1c1d2a" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:8 }}>Problem List</div>
                <div style={{ color:"#f5f6ff", fontSize:24, fontWeight:700 }}>Contest Problems</div>
              </div>
              <div style={{ padding:"0 14px 14px" }}>
                <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 10px" }}>
                  <thead>
                    <tr>
                      {["Problem Name", "Difficulty", "Status", "Score"].map((heading) => (
                        <th key={heading} style={{ textAlign:"left", padding:"14px 16px 8px", fontSize:11, color:"#7a7f9e", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'Space Grotesk',sans-serif" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contestProblems.map((problem, index) => (
                      <tr
                        key={problem.id}
                        onClick={() => {
                          if (!contestEntered) {
                            handleEnterContest(problem);
                            return;
                          }
                          openProblem(problem, "contest");
                        }}
                        style={{ cursor:"pointer", transition:"transform 0.18s ease, filter 0.18s ease" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.01)";
                          e.currentTarget.style.filter = "brightness(1.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.filter = "none";
                        }}
                      >
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538", borderLeft:"1px solid #222538", borderRadius:"16px 0 0 16px" }}>
                          <div style={{ color:"#f5f6ff", fontWeight:700, marginBottom:4 }}>{problem.title}</div>
                          <div style={{ color:"#7f85a6", fontSize:12 }}>Problem #{problem.id}</div>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538" }}>
                          <span style={S.badge(problem.difficulty)}>{problem.difficulty}</span>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538" }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:999, background:problem.contestStatusMeta.background, border:`1px solid ${problem.contestStatusMeta.border}`, color:problem.contestStatusMeta.color, fontSize:12, fontWeight:700 }}>
                            <span>{problem.contestStatusMeta.icon}</span>
                            <span>{problem.contestStatusMeta.label}</span>
                          </span>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538", borderRight:"1px solid #222538", borderRadius:"0 16px 16px 0", color:"#73f0b3", fontWeight:700, fontSize:16 }}>
                          {problem.contestScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display:"grid", gap:18 }}>
              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Round Status</div>
                <div style={{ display:"grid", gap:10, color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div>Contest Name: <span style={{ color:"#eef0ff", fontWeight:700 }}>{contestDisplayName}</span></div>
                  <div>{contestSessionEndsAt ? "Time Left" : "Duration"}: <span style={{ color:"#4fd1c5", fontWeight:700 }}>{formatCountdown(contestTimerSeconds)}</span></div>
                  <div>Status: <span style={{ color:contestStatusTone.color, fontWeight:700 }}>{contestStatus}</span></div>
                  <div>Joined: <span style={{ color:"#eef0ff", fontWeight:700 }}>{contestEntered ? "Yes" : "Not yet"}</span></div>
                </div>
              </div>

              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>How Scoring Works</div>
                <div style={{ display:"grid", gap:10, color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div>Easy problems are quick confidence builders and keep your scoreboard moving.</div>
                  <div>Medium problems reward balanced speed and accuracy under pressure.</div>
                  <div>Hard problems swing the leaderboard fastest, but penalty matters.</div>
                </div>
              </div>

              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Progress</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:10 }}>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#73f0b3", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Solved").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Solved</div>
                  </div>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#ff9b9b", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Attempted").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Attempted</div>
                  </div>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#ffc86b", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Not Tried").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Pending</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "contestResult") {
    const result = contestResult || buildContestResult("Completed");
    const percentage = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;

    return (
      <div style={{ ...S.app, minHeight:"100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <DevOrbitLogo />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Back to contest hub</span>
          </button>
          <button onClick={()=>openLeaderboard("This Contest")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>Compare scores</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1100, margin:"34px auto 44px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          <div style={{ background:"radial-gradient(circle at top left, rgba(79,209,197,0.18), rgba(10,10,15,0.98) 50%)", border:"1px solid #25253b", borderRadius:24, padding:"28px", boxShadow:"0 24px 70px rgba(0,0,0,0.32)" }}>
            <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>Test Result</div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div>
                <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontSize:42, lineHeight:1 }}>{result.title}</h1>
                <div style={{ color:"#a9aed0", fontSize:14 }}>{result.reason} | {result.completedAt}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#73f0b3", fontSize:44, fontWeight:800, lineHeight:1 }}>{result.score}/{result.maxScore}</div>
                <div style={{ color:"#8f93b4", fontSize:13, marginTop:6 }}>{percentage}% score</div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:14 }}>
            {[
              { label:"Accepted", value:result.accepted, color:"#73f0b3", border:"#1f4e3a", background:"#0e1b15" },
              { label:"Rejected", value:result.rejected, color:"#ff9b9b", border:"#5a262d", background:"#1b0f13" },
              { label:"Not Attempted", value:result.notAttempted, color:"#ffc86b", border:"#5d4722", background:"#191309" },
              { label:"Total Problems", value:result.total, color:"#93c5fd", border:"#2d4f7b", background:"#0f1727" },
            ].map((item) => (
              <div key={item.label} style={{ background:item.background, border:`1px solid ${item.border}`, borderRadius:16, padding:"18px 16px" }}>
                <div style={{ color:item.color, fontSize:30, fontWeight:800, lineHeight:1 }}>{item.value}</div>
                <div style={{ color:"#a9aed0", fontSize:12, marginTop:8 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:18, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1e1e2e" }}>
                  {["Problem", "Difficulty", "Status", "Score"].map((heading) => (
                    <th key={heading} style={S.tableHead}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const statusColor = row.status === "Accepted" ? "#73f0b3" : row.status === "Rejected" ? "#ff9b9b" : "#ffc86b";
                  return (
                    <tr key={row.id} style={{ borderBottom:"1px solid #0f0f1a" }}>
                      <td style={{ padding:"14px 16px", color:"#eef0ff", fontWeight:700 }}>{row.title}</td>
                      <td style={{ padding:"14px 16px" }}><span style={S.badge(row.difficulty)}>{row.difficulty}</span></td>
                      <td style={{ padding:"14px 16px", color:statusColor, fontWeight:700 }}>{row.status}</td>
                      <td style={{ padding:"14px 16px", color:"#d9dcf7", fontWeight:700 }}>{row.score}/{row.maxScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (view === "leaderboard") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <DevOrbitLogo />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Timed challenge rounds</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Leaderboard</span>
            <span style={S.navBtnHint(true)}>See the top performers</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ padding:"8px 12px", borderRadius:999, border:"1px solid #273246", background:leaderboardUpdating ? "#111b22" : "#12121a", color:leaderboardUpdating ? "#7ce7ff" : "#8f93b4", fontSize:12, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", transition:"all 0.25s ease" }}>
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:leaderboardUpdating ? "#4fd1c5" : "#48506b", marginRight:8, boxShadow:leaderboardUpdating ? "0 0 12px #4fd1c566" : "none" }} />
              Updating...
            </div>
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1180, margin:"32px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box" }}>
          <div
            style={{
              background:"radial-gradient(circle at top left, rgba(124,106,247,0.22), rgba(10,10,15,0.98) 52%)",
              border:"1px solid #25253b",
              borderRadius:24,
              padding:"28px 26px 30px",
              boxShadow:"0 24px 70px rgba(0,0,0,0.32)",
              opacity:leaderboardReady ? 1 : 0,
              transform:leaderboardReady ? "translateY(0)" : "translateY(18px)",
              transition:"opacity 0.45s ease, transform 0.45s ease",
            }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", gap:18, alignItems:"flex-start", flexWrap:"wrap", marginBottom:22 }}>
              <div>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Live Rankings</div>
                <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:42, lineHeight:1, letterSpacing:"-0.04em" }}>Leaderboard Table</h1>
                <div style={{ color:"#a9aed0", maxWidth:640, fontSize:15, lineHeight:1.7 }}>
                  Track contest momentum, compare ratings, and see who is climbing in real time across the current round and the broader arena.
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "repeat(2, minmax(160px, 1fr))", gap:12, minWidth:"min(100%, 360px)" }}>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px" }}>
                  <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Current Scope</div>
                  <div style={{ color:"#eef0ff", fontSize:20, fontWeight:700 }}>{leaderboardScope}</div>
                </div>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px" }}>
                  <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Visible Users</div>
                  <div style={{ color:"#73f0b3", fontSize:20, fontWeight:700 }}>{leaderboardRows.length}</div>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:18 }}>
              <input
                placeholder="Search username..."
                value={leaderboardSearch}
                onChange={(e)=>setLeaderboardSearch(e.target.value)}
                style={{ flex:1, minWidth:240, background:"#0e1017", border:"1px solid #24283a", borderRadius:12, padding:"12px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none" }}
              />
              <select
                value={leaderboardScope}
                onChange={(e)=>setLeaderboardScope(e.target.value)}
                style={{ minWidth:170, background:"#0e1017", border:"1px solid #24283a", borderRadius:12, padding:"12px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none", cursor:"pointer" }}
              >
                {["All", "This Contest", "Global"].map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </div>

            <div style={{ background:"#0d1017", border:"1px solid #202437", borderRadius:22, padding:"14px", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)" }}>
              <div style={{ maxHeight:520, overflowY:"auto", paddingRight:4 }}>
                <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 10px" }}>
                  <thead>
                    <tr>
                      {["Rank", "User", "Score", "Problems Solved", "Time Penalty"].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            position:"sticky",
                            top:0,
                            zIndex:2,
                            textAlign:"left",
                            padding:"0 16px 12px",
                            fontSize:11,
                            color:"#7a7f9e",
                            fontWeight:700,
                            textTransform:"uppercase",
                            letterSpacing:"0.12em",
                            fontFamily:"'Space Grotesk',sans-serif",
                            background:"#0d1017",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeaderboardRows.length ? visibleLeaderboardRows.map((entry, index) => {
                      const accent = getLeaderboardAccent(entry.stats.rank);
                      const submissionLevel = entry.stats.submissionLevel || "No Submission";
                      const levelMeta = getSubmissionLevelMeta(submissionLevel);
                      const trend = getTrendMeta(entry.stats.trend);
                      const isHovered = hoveredLeaderboardRank === entry.username;
                      const absoluteIndex = ((safeLeaderboardPage - 1) * leaderboardPageSize) + index;
                      const rowBackground = accent.badge
                        ? accent.background
                        : absoluteIndex % 2 === 0
                          ? "#11131b"
                          : "#0c0e15";
                      const baseCellStyle = {
                        background: rowBackground,
                        borderTop:`1px solid ${accent.edge}`,
                        borderBottom:`1px solid ${accent.edge}`,
                        padding:"16px",
                        transition:"background 0.2s ease, border-color 0.2s ease",
                      };

                      return (
                        <tr
                          key={`${leaderboardMode}-${entry.userId || entry.username}`}
                          onMouseEnter={() => setHoveredLeaderboardRank(entry.username)}
                          onMouseLeave={() => setHoveredLeaderboardRank(null)}
                          style={{
                            transform: isHovered ? "scale(1.012)" : "scale(1)",
                            transition:"transform 0.2s ease, filter 0.2s ease",
                            filter: isHovered ? "brightness(1.04)" : "none",
                          }}
                        >
                          <td style={{ ...baseCellStyle, borderLeft:`1px solid ${accent.edge}`, borderRadius:"16px 0 0 16px", boxShadow:accent.glow }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, color:"#eef0ff", fontWeight:700 }}>
                              <span style={{ fontSize:18 }}>{accent.badge || "#"}</span>
                              <div>
                                <div style={{ color:"#eef0ff", fontSize:18, lineHeight:1 }}>{entry.stats.rank}</div>
                                <div style={{ color:trend.color, fontSize:12, marginTop:4 }}>{trend.icon} {trend.label}</div>
                              </div>
                            </div>
                          </td>
                          <td style={baseCellStyle}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg, ${entry.avatarGradient[0]}, ${entry.avatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:14, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                                {getAvatarLabel(entry.username)}
                              </div>
                              <div>
                                <div style={{ color:"#f5f6ff", fontSize:15, fontWeight:700 }}>{entry.username}</div>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginTop:4 }}>
                                  <span style={{ color:"#8f93b4", fontSize:12 }}>Rating {entry.rating}</span>
                                  {entry.badgeTier && <AchievementBadge tier={entry.badgeTier} compact />}
                                  <span style={{ color:levelMeta.color, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", border:`1px solid ${levelMeta.border}`, background:levelMeta.background, borderRadius:999, padding:"3px 8px" }}>
                                    {submissionLevel}
                                  </span>
                                  <span style={{ color:"#7c6af7", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", border:"1px solid #2f3150", borderRadius:999, padding:"3px 8px" }}>
                                    {leaderboardScope === "This Contest" ? "Round" : leaderboardScope === "Global" ? "Global" : "All Arena"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...baseCellStyle, color:"#73f0b3", fontWeight:700, fontSize:16 }}>{entry.stats.score}</td>
                          <td style={{ ...baseCellStyle, color:"#eef0ff", fontWeight:600 }}>{entry.stats.problemsSolved}</td>
                          <td style={{ ...baseCellStyle, borderRight:`1px solid ${accent.edge}`, borderRadius:"0 16px 16px 0", color:"#dfe2ff", fontWeight:600, boxShadow:accent.glow }}>
                            {entry.stats.timePenalty}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" style={{ padding:"38px 18px", textAlign:"center", color:"#8f93b4", background:"#0d1017" }}>
                          {leaderboardSearch.trim()
                            ? "No leaderboard entries matched that username."
                            : "No logged-in students have leaderboard data yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {leaderboardPageCount > 1 && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginTop:18, flexWrap:"wrap" }}>
                  <div style={{ color:"#7a7f9e", fontSize:12 }}>
                    Page {safeLeaderboardPage} of {leaderboardPageCount}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button
                      onClick={() => setLeaderboardPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeLeaderboardPage === 1}
                      style={{ ...S.btn("default"), opacity:safeLeaderboardPage === 1 ? 0.45 : 1 }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setLeaderboardPage((prev) => Math.min(leaderboardPageCount, prev + 1))}
                      disabled={safeLeaderboardPage === leaderboardPageCount}
                      style={{ ...S.btn("default"), opacity:safeLeaderboardPage === leaderboardPageCount ? 0.45 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  
  const p = selectedProblem;
  const consoleHeight = consoleOpen ? (isPhone ? 320 : 260) : 42;
  const problemWorkspaceStyle = isCompact
    ? { display:"grid", gridTemplateColumns:"minmax(0, 1fr)", overflow:"visible", minHeight:"calc(100vh - 116px)" }
    : { display:"flex", flex:1, overflow:"hidden", height:"calc(100vh - 128px)" };
  const problemPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", borderBottom:"1px solid #1e1e2e", overflow:"hidden", minHeight:isPhone ? 360 : 420 }
    : { width:"42%", display:"flex", flexDirection:"column", borderRight:"1px solid #1e1e2e", overflow:"hidden" };
  const editorPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", overflow:"hidden", minHeight:isPhone ? 620 : 680 }
    : { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" };

  return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {finalSubmitConfirmOpen && (
        <div style={S.modalBackdrop} onClick={() => !submitting && setFinalSubmitConfirmOpen(false)}>
          <div style={{ ...S.modalCard, width:"min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>
              Final Submission
            </div>
            <h2 style={{ margin:"0 0 12px", color:"#f5f6ff", fontSize:30, lineHeight:1.1 }}>Finish and submit your test?</h2>
            <div style={{ color:"#a9aed0", fontSize:14, lineHeight:1.8, marginBottom:18 }}>
              This will submit your answer for the last problem and end the test immediately. After that, your result screen will open.
            </div>
            <div style={{ display:"grid", gap:10, background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 16px", color:"#d9dcf7", fontSize:14, lineHeight:1.7, marginBottom:20 }}>
              <div>Problem: <strong>{p.title}</strong></div>
              <div>Time left: <strong>{formatCountdown(contestTimerSeconds)}</strong></div>
              <div>This action cannot be resumed from the contest screen.</div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
              <button onClick={() => setFinalSubmitConfirmOpen(false)} disabled={submitting} style={S.btn("default")}>Cancel</button>
              <button onClick={confirmFinalSubmit} disabled={submitting} style={{ ...S.btn("submit"), opacity:submitting ? 0.65 : 1 }}>
                {submitting ? "Submitting..." : "Submit and Finish"}
              </button>
            </div>
          </div>
        </div>
      )}

      
      <ErrorBanner errors={errorBanner} onClose={() => setErrorBanner(null)} />

      <nav style={S.nav}>
        <DevOrbitLogo />
        <span style={{ color:"#444", fontSize:14 }}>/</span>
        <span style={{ color:"#eef0ff", fontSize:14, fontFamily:"'Outfit','Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.01em" }}>{p.title}</span>
        {problemNavigationSource === "contest" && contestEntered && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginLeft:14, padding:"7px 10px", borderRadius:10, background:"#0f1727", border:"1px solid #2d4f7b", color:"#93c5fd", fontSize:12, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
            <span>Time Left</span>
            <span style={{ color:contestTimerSeconds <= 60 ? "#ff9b9b" : "#eef0ff", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{formatCountdown(contestTimerSeconds)}</span>
          </div>
        )}
        {showProblemNavigation && (
          <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
            {hasPreviousProblem && (
              <button onClick={() => openAdjacentProblem(-1)} style={S.btn("default")}>
                Previous
              </button>
            )}
            <button
              onClick={() => openAdjacentProblem(1)}
              disabled={!hasNextProblem}
              style={{ ...S.btn("default"), opacity:hasNextProblem ? 1 : 0.45 }}
            >
              Next
            </button>
          </div>
        )}
        {false && <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
          <button onClick={()=>simulateRun(false)} disabled={running||submitting} style={S.btn("run")}>
            {running?"⟳ Running...":"▶  Run"}
          </button>
          <button onClick={()=>simulateRun(true)} disabled={running||submitting} style={S.btn("submit")}>
            {submitting?"⟳ Submitting...":"↑  Submit"}
          </button>
        </div>}
      </nav>

      <div style={{ padding:`16px ${pageGutter}px 0`, maxWidth:"100%", boxSizing:"border-box" }}>
        <div style={S.backButtonRow}>
          <button onClick={goBackFromProblem} style={S.backButton}>
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </button>
        </div>
      </div>

      <div style={problemWorkspaceStyle}>

        
        <div style={problemPanelStyle}>
          <div style={{ display:"flex", borderBottom:"1px solid #1e1e2e", background:"#0d0d15", overflowX:"auto" }}>
            {["description","solution","submissions"].map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)} style={{ background:"none", border:"none", padding:"12px 18px", color:activeTab===t?"#fff":"#555", fontSize:12.5, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", borderBottom:activeTab===t?"2px solid #7c6af7":"2px solid transparent", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:activeTab===t?700:500 }}>{t}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:isPhone ? 16 : 24, scrollbarWidth:"thin", scrollbarColor:"#2a2a3e #0a0a0f" }}>
            {activeTab === "description" && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
                  <h1 style={S.problemTitle}>{p.id}. {p.title}</h1>
                  <span style={S.badge(p.difficulty)}>{p.difficulty}</span>
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                  {p.tags.map(t=><span key={t} style={S.tag}>{t}</span>)}
                </div>
                <div style={S.problemBody} dangerouslySetInnerHTML={{ __html:p.description }} />
                {p.examples.map((ex,i)=>(
                  <div key={i} style={{ marginBottom:20 }}>
                    <div style={S.sectionLabel}>Example {i+1}</div>
                    <div style={S.exampleCard}>
                      <div style={{ marginBottom:8 }}><span style={S.exampleFieldLabel}>Input</span><div style={S.exampleFieldValue}>{ex.input}</div></div>
                      <div style={{ marginBottom:ex.explanation?8:0 }}><span style={S.exampleFieldLabel}>Output</span><div style={{ ...S.exampleFieldValue, color:"#73f0b3" }}>{ex.output}</div></div>
                      {ex.explanation&&<div><span style={S.exampleFieldLabel}>Explanation</span><div style={{ ...S.problemBody, marginBottom:0, fontSize:14.5, color:"#adb2d4" }}>{ex.explanation}</div></div>}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:20 }}>
                  <div style={S.sectionLabel}>Constraints</div>
                  <ul style={{ margin:0, paddingLeft:18 }}>
                    {p.constraints.map((c,i)=><li key={i} style={S.constraintItem} dangerouslySetInnerHTML={{ __html:c }} />)}
                  </ul>
                </div>
              </>
            )}

            {activeTab === "solution" && (
              solved.has(p.id) ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#888", marginBottom:16 }}>Reference Solution — {lang}</div>
                  <pre style={{ background:"#0d0d15", border:"1px solid #1e1e2e", borderRadius:8, padding:16, fontSize:12, color:"#c8c8e8", overflowX:"auto", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                    {REFERENCE_SOLUTIONS[p.id]?.[lang] || "// No solution available for this language yet."}
                  </pre>
                </div>
              ) : (
                <div style={{ color:"#666", textAlign:"center", paddingTop:60 }}>
                  <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
                  <div style={{ fontSize:16, color:"#888" }}>Solution is locked</div>
                  <div style={{ fontSize:13, color:"#555", marginTop:8 }}>Solve the problem first to unlock.</div>
                </div>
              )
            )}

            {activeTab === "submissions" && (
              solved.has(p.id) ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#888", marginBottom:16 }}>Your Submissions</div>
                  <div style={{ background:"#0d150d", border:"1px solid #1a3a1a", borderRadius:8, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:"#4ade80", fontWeight:600, fontSize:13 }}>✓ Accepted</span>
                    <span style={{ color:"#555", fontSize:12 }}>Just now · {lang}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color:"#555", textAlign:"center", paddingTop:60, fontSize:14 }}>No submissions yet.</div>
              )
            )}
          </div>
        </div>

        
        <div style={editorPanelStyle}>
          {/* Toolbar */}
          <div style={{ background:"#0d0d15", borderBottom:"1px solid #1e1e2e", padding:`8px ${isPhone ? 12 : 16}px`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <select value={lang} onChange={e=>handleLangChange(e.target.value)}
              style={{ background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#c8c8e8", padding:"4px 10px", borderRadius:6, fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <span style={{ fontSize:11, color: lang==="javascript"?"#4ade8077":"#ffc01e77" }}>
              Judge0 Execution
            </span>
            <div style={{ marginLeft:isPhone ? 0 : "auto" }}>
              <button onClick={()=>setCode(p.starterCode[lang])} style={{ background:"none", border:"1px solid #2a2a3e", color:"#555", padding:"4px 12px", borderRadius:6, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Reset</button>
            </div>
          </div>

          {/* Editor */}
          <div style={{ flex:1, minHeight:isCompact ? (isPhone ? 360 : 420) : 0, position:"relative", overflow:"hidden", background:"linear-gradient(180deg,#0d1020,#090b14)" }}>
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:44, background:"#0a0a12", borderRight:"1px solid #1a1a2a", paddingTop:16, textAlign:"right", paddingRight:8, userSelect:"none", overflowY:"hidden", zIndex:1 }}>
              <div style={{ transform:`translateY(-${editorScrollTop}px)` }}>
                {code.split("\n").map((_,i)=><div key={i} style={{ color:"#56607a", fontSize:13, lineHeight:"21px" }}>{i+1}</div>)}
              </div>
            </div>
            <CodeHighlightLayer code={code} language={lang} scrollTop={editorScrollTop} />
            <textarea ref={textareaRef} value={code} onChange={e=>setCode(e.target.value)} onScroll={(e)=>setEditorScrollTop(e.currentTarget.scrollTop)} onKeyDown={(e) => handleEditorIndentation(e, code, setCode, textareaRef, lang)} spellCheck={false}
              style={{ position:"absolute", inset:0, paddingLeft:56, paddingTop:16, paddingRight:16, paddingBottom:16, background:"transparent", color:"transparent", caretColor:"#67e8f9", border:"none", outline:"none", resize:"none", fontFamily:"'JetBrains Mono',monospace", fontSize:13.5, lineHeight:"21px", width:"100%", height:"100%", boxSizing:"border-box", scrollbarWidth:"thin", scrollbarColor:"#2a2a3e #0a0a0f", whiteSpace:"pre-wrap", wordBreak:"break-word" }} />
          </div>

          <div style={{ background:"#0d0d15", borderTop:"1px solid #1e1e2e", padding:"10px 16px", display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
            <button onClick={()=>simulateRun(false)} disabled={running||submitting} style={S.btn("run")}>
              {running ? "Running..." : "Run"}
            </button>
            <button onClick={handleSubmitClick} disabled={running||submitting} style={S.btn("submit")}>
              {submitting ? "Submitting..." : isFinalContestProblem ? "Final Submit" : "Submit"}
            </button>
          </div>

          {/* Console */}
          <div style={{ height:consoleHeight, borderTop:"1px solid #1e1e2e", background:"#0a0a0f", transition:"height 0.2s", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", padding:"0 16px", height:42, borderBottom:consoleOpen?"1px solid #1e1e2e":"none", flexShrink:0 }}>
              <button onClick={()=>setConsoleOpen(!consoleOpen)} style={{ background:"none", border:"none", color:"#888", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ transform:consoleOpen?"rotate(0deg)":"rotate(-90deg)", display:"inline-block", transition:"transform 0.2s" }}>▾</span>
                Console
              </button>
              {consoleOpen && (
                <div style={{ display:"flex", marginLeft:16 }}>
                  {["testcase","result"].map(t=>(
                    <button key={t} onClick={()=>setConsoleTab(t)} style={{ background:"none", border:"none", padding:"4px 14px", color:consoleTab===t?"#fff":"#555", fontSize:12, cursor:"pointer", fontFamily:"inherit", borderBottom:consoleTab===t?"2px solid #7c6af7":"2px solid transparent" }}>
                      {t==="testcase"?"Test Cases":"Result"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {consoleOpen && (
              <div style={{ flex:1, overflowY:"auto", padding:16, scrollbarWidth:"thin", scrollbarColor:"#2a2a3e #0a0a0f" }}>
                {consoleTab === "testcase" && (
                  <div>
                    {p.testCases.map((tc,i)=>(
                      <div key={i} style={{ marginBottom:12 }}>
                        <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>Case {i+1}:</div>
                        <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:6, padding:"10px 12px", fontSize:13 }}>
                          <div style={{ color:"#555", marginBottom:6 }}>Input</div>
                          <div style={{ color:"#c8c8e8", marginBottom:10 }}>{tc.input}</div>
                          <div style={{ color:"#555", marginBottom:6 }}>Expected Output</div>
                          <div style={{ color:"#4ade80" }}>{tc.expected}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {consoleTab === "result" && runResult && (
                  <div>
                    {/* Status row */}
                    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14, flexWrap:"wrap" }}>
                      <span style={{ fontSize:15, fontWeight:700, color:runResult.status==="unsupported"?"#ffc01e":runResult.passed?"#4ade80":"#ff375f" }}>
                        {runResult.status==="unsupported"?"Execution Not Available":runResult.passed?"Accepted":"Wrong Answer"}
                      </span>
                      {runResult.passed && <>
                        <span style={{ color:"#555", fontSize:12 }}>Runtime: <span style={{ color:"#c8c8e8" }}>{runResult.runtime}</span></span>
                        <span style={{ color:"#555", fontSize:12 }}>Memory: <span style={{ color:"#c8c8e8" }}>{runResult.memory}</span></span>
                        <span style={{ color:"#555", fontSize:12 }}>Beats: <span style={{ color:"#7c6af7" }}>{runResult.beats}</span></span>
                      </>}
                    </div>

                    {/* Case pills */}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                      {runResult.tests.map((t,i)=>(
                        <div key={i} style={{ background:t.status==="pass"?"#0d150d":t.status==="unsupported"?"#151208":t.status==="error"?"#150a08":"#150d0d", border:`1px solid ${t.status==="pass"?"#1a3a1a":t.status==="unsupported"?"#5a4716":"#3a1a1a"}`, borderRadius:6, padding:"6px 12px", fontSize:12 }}>
                          <span style={{ color:t.status==="pass"?"#4ade80":t.status==="unsupported"?"#ffc01e":"#ff375f" }}>{t.status==="pass"?"PASS":t.status==="unsupported"?"INFO":t.status==="error"?"ERR":"FAIL"}</span>
                          <span style={{ color:"#555", marginLeft:6 }}>Case {i+1}</span>
                        </div>
                      ))}
                    </div>

                    {/* First failing case detail */}
                    {runResult.tests.filter(t=>t.status!=="pass").slice(0,1).map((t,i)=>(
                      <div key={i} style={{ background:t.status==="unsupported"?"#151208":"#110a0a", border:`1px solid ${t.status==="unsupported"?"#5a4716":"#3a1a1a"}`, borderRadius:8, padding:12, fontSize:12 }}>
                        {t.error
                          ? <div style={{ color:t.status==="unsupported"?"#ffd37a":"#ff9999", whiteSpace:"pre-wrap" }}>{t.error}</div>
                          : <>
                              <div style={{ color:"#555", marginBottom:4 }}>Expected: <span style={{ color:"#4ade80" }}>{t.expected}</span></div>
                              <div style={{ color:"#555" }}>Got:      <span style={{ color:"#ff6b6b" }}>{t.actual ?? "undefined"}</span></div>
                            </>
                        }
                      </div>
                    ))}
                  </div>
                )}
                {consoleTab === "result" && !runResult && (
                  <div style={{ color:"#444", fontSize:13 }}>Run your code to see results here.</div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {problemNavigationSource === "contest" && contestEntered && contestCameraStream && (
        <div
          style={{
            position:"fixed",
            right:isPhone ? 12 : 18,
            bottom:isPhone ? 12 : 18,
            width:isPhone ? 150 : 190,
            background:"#090b14",
            border:"1px solid #2a3550",
            borderRadius:16,
            overflow:"hidden",
            boxShadow:"0 18px 40px rgba(0,0,0,0.42)",
            zIndex:40,
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"#0f1727", borderBottom:"1px solid #22304a", color:"#cbd5e1", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 0 4px rgba(34,197,94,0.14)" }} />
            Camera On
          </div>
          <video
            ref={contestCameraPreviewRef}
            autoPlay
            muted
            playsInline
            style={{
              display:"block",
              width:"100%",
              height:isPhone ? 110 : 140,
              objectFit:"cover",
              transform:"scaleX(-1)",
              background:"#020617",
            }}
          />
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<CodingPlatform />);


