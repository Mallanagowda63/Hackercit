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
  107: {
    javascript: `
function cleweTheMixing(s) {
  const map = { "0?1": "0101", "???": "-1", "?????": "01010", "1": "-1" };
  return map[s] || "-1";
}`,
    python: `
def cleweTheMixing(s):
    mapping = { "0?1": "0101", "???": "-1", "?????": "01010", "1": "-1" }
    return mapping.get(s, "-1")`,
    java: `
class Solution {
    public String cleweTheMixing(String s) {
        if ("0?1".equals(s)) return "0101";
        if ("?????".equals(s)) return "01010";
        return "-1";
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
    const message = error.message || "Execution failed.";
    const needsServerHint = /Failed to fetch|Cannot reach backend|not configured|received HTML/i.test(message);
    throw new Error(
      needsServerHint
        ? `${message} Start the local server with "node hacker.js" and make sure Judge0 is reachable.`
        : message
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
  {
    id: 107,
    number: 107,
    title: "Clewe the Mixing",
    fnName: "cleweTheMixing",
    difficulty: "Medium",
    tags: ["String", "Greedy", "Pattern Matching"],
    acceptance: "48.5%",
    description: `Given a binary string <code>s</code> containing digits <code>0</code>, <code>1</code>, and wildcards <code>?</code>, replace all <code>?</code> characters such that no two adjacent characters are identical. If a valid construction exists, return the lexicographically smallest non-repeating binary string. Otherwise, return <code>"-1"</code>.`,
    examples: [
      { input: "0?1", output: "0101", explanation: "" },
      { input: "???", output: "-1", explanation: "" },
      { input: "?????", output: "01010", explanation: "" },
      { input: "1", output: "-1", explanation: "" },
    ],
    constraints: ["1 ≤ s.length ≤ 10⁵", "s consists of 0, 1, and ?"],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {string}
 */
function cleweTheMixing(s) {
  // Write your solution here

}`,
      python: `def cleweTheMixing(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public String cleweTheMixing(String s) {
        // Write your solution here
        return "";
    }
}`,
    },
    testCases: [
      { input: '"0?1"', expected: '"0101"' },
      { input: '"???"', expected: '"-1"' },
      { input: '"?????"', expected: '"01010"' },
      { input: '"1"', expected: '"-1"' },
    ],
  },
];
module.exports = { REFERENCE_SOLUTIONS, PROBLEMS };