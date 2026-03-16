const JAVA_SPECS = {
  twoSum: {
    returnType: "int[]",
    argTypes: ["int[]", "int"],
    argsToJava: ([nums, target]) => [`new int[]{${nums.join(",")}}`, `${target}`],
    serializeResult: "serializeIntArray(result)",
    call: "solution.twoSum(%ARGS%)",
  },
  reverseString: {
    returnType: "void",
    argTypes: ["char[]"],
    argsToJava: ([chars]) => [`new char[]{${chars.map((char) => `'${char}'`).join(",")}}`],
    serializeResult: "serializeCharArray(arg0)",
    call: "solution.reverseString(arg0)",
  },
  isValid: {
    returnType: "boolean",
    argTypes: ["String"],
    argsToJava: ([value]) => [JSON.stringify(value)],
    serializeResult: "String.valueOf(result)",
    call: "solution.isValid(%ARGS%)",
  },
  maxSubArray: {
    returnType: "int",
    argTypes: ["int[]"],
    argsToJava: ([nums]) => [`new int[]{${nums.join(",")}}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.maxSubArray(%ARGS%)",
  },
  addTwoNumbers: {
    returnType: "int[]",
    argTypes: ["int[]", "int[]"],
    argsToJava: ([l1, l2]) => [`new int[]{${l1.join(",")}}`, `new int[]{${l2.join(",")}}`],
    serializeResult: "serializeIntArray(result)",
    call: "solution.addTwoNumbers(%ARGS%)",
  },
  lengthOfLongestSubstring: {
    returnType: "int",
    argTypes: ["String"],
    argsToJava: ([value]) => [JSON.stringify(value)],
    serializeResult: "String.valueOf(result)",
    call: "solution.lengthOfLongestSubstring(%ARGS%)",
  },
  findMedianSortedArrays: {
    returnType: "double",
    argTypes: ["int[]", "int[]"],
    argsToJava: ([nums1, nums2]) => [`new int[]{${nums1.join(",")}}`, `new int[]{${nums2.join(",")}}`],
    serializeResult: "serializeDouble(result)",
    call: "solution.findMedianSortedArrays(%ARGS%)",
  },
  longestPalindrome: {
    returnType: "String",
    argTypes: ["String"],
    argsToJava: ([value]) => [JSON.stringify(value)],
    serializeResult: "serializeString(result)",
    call: "solution.longestPalindrome(%ARGS%)",
  },
  convert: {
    returnType: "String",
    argTypes: ["String", "int"],
    argsToJava: ([value, numRows]) => [JSON.stringify(value), `${numRows}`],
    serializeResult: "serializeString(result)",
    call: "solution.convert(%ARGS%)",
  },
  isPalindrome: {
    returnType: "boolean",
    argTypes: ["int"],
    argsToJava: ([value]) => [`${value}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.isPalindrome(%ARGS%)",
  },
  romanToInt: {
    returnType: "int",
    argTypes: ["String"],
    argsToJava: ([value]) => [JSON.stringify(value)],
    serializeResult: "String.valueOf(result)",
    call: "solution.romanToInt(%ARGS%)",
  },
  longestCommonPrefix: {
    returnType: "String",
    argTypes: ["String[]"],
    argsToJava: ([values]) => [`new String[]{${values.map((value) => JSON.stringify(value)).join(",")}}`],
    serializeResult: "serializeString(result)",
    call: "solution.longestCommonPrefix(%ARGS%)",
  },
  removeDuplicates: {
    returnType: "int",
    argTypes: ["int[]"],
    argsToJava: ([nums]) => [`new int[]{${nums.join(",")}}`],
    serializeResult: "serializePrefixIntArrayResult(result, arg0)",
    call: "solution.removeDuplicates(%ARGS%)",
  },
  removeElement: {
    returnType: "int",
    argTypes: ["int[]", "int"],
    argsToJava: ([nums, value]) => [`new int[]{${nums.join(",")}}`, `${value}`],
    serializeResult: "serializeSortedPrefixIntArrayResult(result, arg0)",
    call: "solution.removeElement(%ARGS%)",
  },
  strStr: {
    returnType: "int",
    argTypes: ["String", "String"],
    argsToJava: ([haystack, needle]) => [JSON.stringify(haystack), JSON.stringify(needle)],
    serializeResult: "String.valueOf(result)",
    call: "solution.strStr(%ARGS%)",
  },
  searchInsert: {
    returnType: "int",
    argTypes: ["int[]", "int"],
    argsToJava: ([nums, target]) => [`new int[]{${nums.join(",")}}`, `${target}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.searchInsert(%ARGS%)",
  },
  plusOne: {
    returnType: "int[]",
    argTypes: ["int[]"],
    argsToJava: ([digits]) => [`new int[]{${digits.join(",")}}`],
    serializeResult: "serializeIntArray(result)",
    call: "solution.plusOne(%ARGS%)",
  },
  mySqrt: {
    returnType: "int",
    argTypes: ["int"],
    argsToJava: ([value]) => [`${value}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.mySqrt(%ARGS%)",
  },
  deleteDuplicates: {
    returnType: "ListNode",
    argTypes: ["ListNode"],
    argsToJava: ([values]) => [`buildListNode(new int[]{${values.join(",")}})`],
    serializeResult: "serializeLinkedList(result)",
    call: "solution.deleteDuplicates(%ARGS%)",
  },
  merge: {
    returnType: "void",
    argTypes: ["int[]", "int", "int[]", "int"],
    argsToJava: ([nums1, m, nums2, n]) => [`new int[]{${nums1.join(",")}}`, `${m}`, `new int[]{${nums2.join(",")}}`, `${n}`],
    serializeResult: "serializeMergedArray(arg0, arg1 + arg3)",
    call: "solution.merge(%ARGS%)",
  },
  inorderTraversal: {
    returnType: "List<Integer>",
    argTypes: ["TreeNode"],
    argsToJava: ([values]) => [`buildTree(new Integer[]{${toJavaNullableArray(values)}})`],
    serializeResult: "serializeIntList(result)",
    call: "solution.inorderTraversal(%ARGS%)",
  },
  isSameTree: {
    returnType: "boolean",
    argTypes: ["TreeNode", "TreeNode"],
    argsToJava: ([left, right]) => [`buildTree(new Integer[]{${toJavaNullableArray(left)}})`, `buildTree(new Integer[]{${toJavaNullableArray(right)}})`],
    serializeResult: "String.valueOf(result)",
    call: "solution.isSameTree(%ARGS%)",
  },
  isBalanced: {
    returnType: "boolean",
    argTypes: ["TreeNode"],
    argsToJava: ([values]) => [`buildTree(new Integer[]{${toJavaNullableArray(values)}})`],
    serializeResult: "String.valueOf(result)",
    call: "solution.isBalanced(%ARGS%)",
  },
  hasPathSum: {
    returnType: "boolean",
    argTypes: ["TreeNode", "int"],
    argsToJava: ([values, targetSum]) => [`buildTree(new Integer[]{${toJavaNullableArray(values)}})`, `${targetSum}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.hasPathSum(%ARGS%)",
  },
  getRow: {
    returnType: "List<Integer>",
    argTypes: ["int"],
    argsToJava: ([rowIndex]) => [`${rowIndex}`],
    serializeResult: "serializeIntList(result)",
    call: "solution.getRow(%ARGS%)",
  },
  isPalindromeString: {
    returnType: "boolean",
    argTypes: ["String"],
    argsToJava: ([value]) => [JSON.stringify(value)],
    serializeResult: "String.valueOf(result)",
    call: "solution.isPalindromeString(%ARGS%)",
  },
  singleNumber: {
    returnType: "int",
    argTypes: ["int[]"],
    argsToJava: ([nums]) => [`new int[]{${nums.join(",")}}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.singleNumber(%ARGS%)",
  },
  hasCycle: {
    returnType: "boolean",
    argTypes: ["ListNode"],
    argsToJava: ([values, pos]) => [`buildCycledList(new int[]{${values.join(",")}}, ${pos})`],
    serializeResult: "String.valueOf(result)",
    call: "solution.hasCycle(%ARGS%)",
  },
  isMatch: {
    returnType: "boolean",
    argTypes: ["String", "String"],
    argsToJava: ([s, p]) => [JSON.stringify(s), JSON.stringify(p)],
    serializeResult: "String.valueOf(result)",
    call: "solution.isMatch(%ARGS%)",
  },
  mergeKLists: {
    returnType: "ListNode",
    argTypes: ["ListNode[]"],
    argsToJava: ([lists]) => [`buildListNodeArray(${toJavaIntMatrix(lists)})`],
    serializeResult: "serializeLinkedList(result)",
    call: "solution.mergeKLists(%ARGS%)",
  },
  findSubstring: {
    returnType: "List<Integer>",
    argTypes: ["String", "String[]"],
    argsToJava: ([s, words]) => [JSON.stringify(s), toJavaStringArray(words)],
    serializeResult: "serializeSortedIntList(result)",
    call: "solution.findSubstring(%ARGS%)",
  },
  longestValidParentheses: {
    returnType: "int",
    argTypes: ["String"],
    argsToJava: ([s]) => [JSON.stringify(s)],
    serializeResult: "String.valueOf(result)",
    call: "solution.longestValidParentheses(%ARGS%)",
  },
  solveSudoku: {
    returnType: "void",
    argTypes: ["String[][]"],
    argsToJava: ([board]) => [toJavaStringMatrix(board)],
    serializeResult: "serializeStringMatrix(arg0)",
    call: "solution.solveSudoku(%ARGS%)",
  },
  firstMissingPositive: {
    returnType: "int",
    argTypes: ["int[]"],
    argsToJava: ([nums]) => [`new int[]{${nums.join(",")}}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.firstMissingPositive(%ARGS%)",
  },
  isWildcardMatch: {
    returnType: "boolean",
    argTypes: ["String", "String"],
    argsToJava: ([s, p]) => [JSON.stringify(s), JSON.stringify(p)],
    serializeResult: "String.valueOf(result)",
    call: "solution.isWildcardMatch(%ARGS%)",
  },
  solveNQueens: {
    returnType: "List<List<String>>",
    argTypes: ["int"],
    argsToJava: ([n]) => [`${n}`],
    serializeResult: "serializeNestedStringList(result)",
    call: "solution.solveNQueens(%ARGS%)",
  },
  getPermutation: {
    returnType: "String",
    argTypes: ["int", "int"],
    argsToJava: ([n, k]) => [`${n}`, `${k}`],
    serializeResult: "serializeString(result)",
    call: "solution.getPermutation(%ARGS%)",
  },
  minWindow: {
    returnType: "String",
    argTypes: ["String", "String"],
    argsToJava: ([s, t]) => [JSON.stringify(s), JSON.stringify(t)],
    serializeResult: "serializeString(result)",
    call: "solution.minWindow(%ARGS%)",
  },
  largestRectangleArea: {
    returnType: "int",
    argTypes: ["int[]"],
    argsToJava: ([heights]) => [`new int[]{${heights.join(",")}}`],
    serializeResult: "String.valueOf(result)",
    call: "solution.largestRectangleArea(%ARGS%)",
  },
  isScramble: {
    returnType: "boolean",
    argTypes: ["String", "String"],
    argsToJava: ([s1, s2]) => [JSON.stringify(s1), JSON.stringify(s2)],
    serializeResult: "String.valueOf(result)",
    call: "solution.isScramble(%ARGS%)",
  },
};

function escapeForTemplate(value) {
  return JSON.stringify(value);
}

function toJavaNullableArray(values) {
  return values.map((value) => (value === null ? "null" : `${value}`)).join(",");
}

function toJavaIntMatrix(matrix) {
  if (!matrix.length) return "new int[][]{}";
  return `new int[][]{${matrix.map((row) => `new int[]{${row.join(",")}}`).join(",")}}`;
}

function toJavaStringArray(values) {
  return `new String[]{${values.map((value) => JSON.stringify(value)).join(",")}}`;
}

function toJavaStringMatrix(matrix) {
  if (!matrix.length) return "new String[][]{}";
  return `new String[][]{${matrix.map((row) => toJavaStringArray(row)).join(",")}}`;
}

function toCaseArray(testCases) {
  return testCases.map((test) => ({
    input: test.input,
    expected: test.expected,
  }));
}

function buildJavaScriptRunner({ sourceCode, fnName, testCases }) {
  const content = `
const cases = ${JSON.stringify(toCaseArray(testCases))};

const loadSubmittedFunction = new Function(\`
function ListNode(val, next = null) {
  this.val = val;
  this.next = next;
}

function TreeNode(val, left = null, right = null) {
  this.val = val;
  this.left = left;
  this.right = right;
}

${sourceCode}
return typeof ${fnName} === "function" ? ${fnName} : null;
\`);

function buildLinkedList(values) {
  let dummy = { next: null };
  let current = dummy;
  for (const value of values) {
    current.next = { val: value, next: null };
    current = current.next;
  }
  return dummy.next;
}

function buildCycledList(values, pos) {
  const head = buildLinkedList(values);
  if (head == null || pos < 0) return head;

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
}

function linkedListToArray(head) {
  const values = [];
  const seen = new Set();
  let current = head;
  while (current && !seen.has(current) && values.length < 2000) {
    seen.add(current);
    values.push(current.val);
    current = current.next;
  }
  return values;
}

function buildTree(values) {
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
}

function prepareArgs(fnName, rawArgs) {
  if (fnName === "deleteDuplicates") return [buildLinkedList(rawArgs[0])];
  if (fnName === "hasCycle") return [buildCycledList(rawArgs[0], rawArgs[1])];
  if (fnName === "mergeKLists") return [rawArgs[0].map(buildLinkedList)];
  if (fnName === "inorderTraversal" || fnName === "isBalanced") return [buildTree(rawArgs[0])];
  if (fnName === "isSameTree") return [buildTree(rawArgs[0]), buildTree(rawArgs[1])];
  if (fnName === "hasPathSum") return [buildTree(rawArgs[0]), rawArgs[1]];
  return rawArgs;
}

function serializeResult(fnName, result, args, rawArgs) {
  if (fnName === "reverseString") return JSON.stringify(args[0]);
  if (fnName === "removeDuplicates") {
    const k = Math.max(0, Number(result) || 0);
    return JSON.stringify({ k, nums: args[0].slice(0, k) });
  }
  if (fnName === "removeElement") {
    const k = Math.max(0, Number(result) || 0);
    const kept = [...args[0].slice(0, k)].sort((a, b) => a - b);
    return JSON.stringify({ k, nums: kept });
  }
  if (fnName === "merge") {
    return JSON.stringify(args[0].slice(0, rawArgs[1] + rawArgs[3]));
  }
  if (fnName === "deleteDuplicates") {
    return JSON.stringify(linkedListToArray(result));
  }
  if (fnName === "mergeKLists") {
    return JSON.stringify(linkedListToArray(result));
  }
  if (fnName === "findSubstring") {
    return JSON.stringify([...(result || [])].sort((a, b) => a - b));
  }
  if (fnName === "solveSudoku") {
    return JSON.stringify(args[0]);
  }
  if (fnName === "solveNQueens") {
    const boards = [...(result || [])].map((board) => [...board]);
    boards.sort((left, right) => left.join("|").localeCompare(right.join("|")));
    return JSON.stringify(boards);
  }
  return JSON.stringify(result);
}

function normalize(value) {
  return String(value).replace(/\\s/g, "");
}

function matchesExpected(actual, expected) {
  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);
  if (normalizedActual === normalizedExpected) return true;

  const actualNumber = Number(normalizedActual);
  const expectedNumber = Number(normalizedExpected);
  return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && Math.abs(actualNumber - expectedNumber) < 1e-9;
}

const tests = cases.map((tc) => {
  try {
    const fn = loadSubmittedFunction();
    if (typeof fn !== "function") {
      throw new Error(\`Function "${fnName}" not found.\`);
    }

    const rawArgs = JSON.parse(\`[\${tc.input}]\`);
    const args = prepareArgs(${escapeForTemplate(fnName)}, rawArgs);
    const result = fn(...args);
    const actual = serializeResult(${escapeForTemplate(fnName)}, result, args, rawArgs);
    const pass = matchesExpected(actual, tc.expected);
    return { ...tc, actual, status: pass ? "pass" : "fail", error: null };
  } catch (error) {
    return { ...tc, actual: null, status: "error", error: error.message };
  }
});

require("node:fs").writeFileSync("results.json", JSON.stringify({ tests }, null, 2));
`;

  return {
    image: "node:20-alpine",
    command: ["node", "runner.js"],
    files: [{ name: "runner.js", content }],
  };
}

function buildPythonRunner({ sourceCode, fnName, testCases }) {
  const content = `
import json

cases = ${JSON.stringify(toCaseArray(testCases), null, 2)}

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build_linked_list(values):
    dummy = ListNode()
    current = dummy
    for value in values:
        current.next = ListNode(value)
        current = current.next
    return dummy.next

def build_cycled_list(values, pos):
    head = build_linked_list(values)
    if head is None or pos < 0:
        return head

    cycle_node = None
    current = head
    index = 0
    while current.next is not None:
        if index == pos:
            cycle_node = current
        current = current.next
        index += 1

    if index == pos:
        cycle_node = current
    current.next = cycle_node
    return head

def linked_list_to_array(head):
    values = []
    seen = set()
    current = head
    while current is not None and id(current) not in seen and len(values) < 2000:
        seen.add(id(current))
        values.append(current.val)
        current = current.next
    return values

def build_tree(values):
    if not values or values[0] is None:
        return None

    root = TreeNode(values[0])
    queue = [root]
    index = 1

    while queue and index < len(values):
        node = queue.pop(0)

        if index < len(values) and values[index] is not None:
            node.left = TreeNode(values[index])
            queue.append(node.left)
        index += 1

        if index < len(values) and values[index] is not None:
            node.right = TreeNode(values[index])
            queue.append(node.right)
        index += 1

    return root

def prepare_args(fn_name, raw_args):
    if fn_name == "deleteDuplicates":
        return [build_linked_list(raw_args[0])]
    if fn_name == "hasCycle":
        return [build_cycled_list(raw_args[0], raw_args[1])]
    if fn_name == "mergeKLists":
        return [[build_linked_list(values) for values in raw_args[0]]]
    if fn_name in ("inorderTraversal", "isBalanced"):
        return [build_tree(raw_args[0])]
    if fn_name == "isSameTree":
        return [build_tree(raw_args[0]), build_tree(raw_args[1])]
    if fn_name == "hasPathSum":
        return [build_tree(raw_args[0]), raw_args[1]]
    return raw_args

${sourceCode}

def serialize_result(fn_name, result, args, raw_args):
    if fn_name == "reverseString":
        return json.dumps(args[0], separators=(",", ":"))
    if fn_name == "removeDuplicates":
        k = max(0, int(result))
        return json.dumps({"k": k, "nums": args[0][:k]}, separators=(",", ":"))
    if fn_name == "removeElement":
        k = max(0, int(result))
        return json.dumps({"k": k, "nums": sorted(args[0][:k])}, separators=(",", ":"))
    if fn_name == "merge":
        return json.dumps(args[0][: raw_args[1] + raw_args[3]], separators=(",", ":"))
    if fn_name == "deleteDuplicates":
        return json.dumps(linked_list_to_array(result), separators=(",", ":"))
    if fn_name == "mergeKLists":
        return json.dumps(linked_list_to_array(result), separators=(",", ":"))
    if fn_name == "findSubstring":
        return json.dumps(sorted(result), separators=(",", ":"))
    if fn_name == "solveSudoku":
        return json.dumps(args[0], separators=(",", ":"))
    if fn_name == "solveNQueens":
        canonical = sorted([tuple(board) for board in result])
        return json.dumps([list(board) for board in canonical], separators=(",", ":"))
    return json.dumps(result, separators=(",", ":"))

def normalize(value):
    return "".join(str(value).split())

def matches_expected(actual, expected):
    if normalize(actual) == normalize(expected):
        return True
    try:
        return abs(float(actual) - float(expected)) < 1e-9
    except (TypeError, ValueError):
        return False

tests = []

for tc in cases:
    try:
        fn = globals().get(${escapeForTemplate(fnName)})
        if not callable(fn):
            raise Exception(f'Function "${fnName}" not found.')

        raw_args = json.loads(f'[{tc["input"]}]')
        args = prepare_args(${escapeForTemplate(fnName)}, raw_args)
        result = fn(*args)
        actual = serialize_result(${escapeForTemplate(fnName)}, result, args, raw_args)
        status = "pass" if matches_expected(actual, tc["expected"]) else "fail"
        tests.append({**tc, "actual": actual, "status": status, "error": None})
    except Exception as error:
        tests.append({**tc, "actual": None, "status": "error", "error": str(error)})

with open("results.json", "w", encoding="utf-8") as file:
    json.dump({"tests": tests}, file, indent=2)
`;

  return {
    image: "python:3.11-alpine",
    command: ["python", "runner.py"],
    files: [{ name: "runner.py", content }],
  };
}

function buildJavaCaseLines(fnName, testCases) {
  const spec = JAVA_SPECS[fnName];
  if (!spec) {
    throw new Error(`Java runner is not configured for function "${fnName}".`);
  }

  return testCases
    .map((test, index) => {
      const args = JSON.parse(`[${test.input}]`);
      const javaArgs = spec.argsToJava(args);
      const argDeclarations = javaArgs
        .map((value, argIndex) => `      ${inferJavaDeclaration(fnName, argIndex)} arg${argIndex} = ${value};`)
        .join("\n");
      const callExpression = spec.call.replace("%ARGS%", javaArgs.map((_, argIndex) => `arg${argIndex}`).join(", "));
      const invokeLine =
        spec.returnType === "void"
          ? `      ${callExpression};\n      String actual = ${spec.serializeResult};`
          : `      ${spec.returnType} result = ${callExpression};\n      String actual = ${spec.serializeResult};`;

      return `
    try {
${argDeclarations}
${invokeLine}
      tests.add(caseResult(${index + 1}, ${escapeForTemplate(test.expected)}, actual));
    } catch (Exception error) {
      tests.add(caseError(${index + 1}, ${escapeForTemplate(test.expected)}, error.toString()));
    }`;
    })
    .join("\n");
}

function inferJavaDeclaration(fnName, argIndex) {
  const spec = JAVA_SPECS[fnName];
  return spec?.argTypes?.[argIndex] || "Object";
}

function buildJavaRunner({ sourceCode, fnName, testCases }) {
  if (!JAVA_SPECS[fnName]) {
    throw new Error(`Java runner is not configured for function "${fnName}".`);
  }

  const content = `
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

class ListNode {
  int val;
  ListNode next;
  ListNode() {}
  ListNode(int val) { this.val = val; }
  ListNode(int val, ListNode next) {
    this.val = val;
    this.next = next;
  }
}

class TreeNode {
  int val;
  TreeNode left;
  TreeNode right;
  TreeNode() {}
  TreeNode(int val) { this.val = val; }
  TreeNode(int val, TreeNode left, TreeNode right) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

${sourceCode}

public class Main {
  static String normalize(String value) {
    return value.replaceAll("\\\\s", "");
  }

  static String escape(String value) {
    return value.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
  }

  static String serializeIntArray(int[] values) {
    return Arrays.toString(values).replace(" ", "");
  }

  static String serializeIntList(List<Integer> values) {
    return values.toString().replace(" ", "");
  }

  static String serializeSortedIntList(List<Integer> values) {
    List<Integer> copy = new ArrayList<>(values);
    copy.sort(Integer::compareTo);
    return serializeIntList(copy);
  }

  static String serializeCharArray(char[] values) {
    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) builder.append(",");
      builder.append("\\"").append(values[i]).append("\\"");
    }
    builder.append("]");
    return builder.toString();
  }

  static String serializeLinkedList(ListNode head) {
    List<Integer> values = new ArrayList<>();
    ListNode current = head;
    int guard = 0;
    while (current != null && guard < 2000) {
      values.add(current.val);
      current = current.next;
      guard++;
    }
    return values.toString().replace(" ", "");
  }

  static String serializePrefixIntArrayResult(int k, int[] values) {
    int safeLength = Math.max(0, Math.min(k, values.length));
    return "{\\"k\\":" + safeLength + ",\\"nums\\":" + serializeIntArray(Arrays.copyOf(values, safeLength)) + "}";
  }

  static String serializeSortedPrefixIntArrayResult(int k, int[] values) {
    int safeLength = Math.max(0, Math.min(k, values.length));
    int[] copy = Arrays.copyOf(values, safeLength);
    Arrays.sort(copy);
    return "{\\"k\\":" + safeLength + ",\\"nums\\":" + serializeIntArray(copy) + "}";
  }

  static String serializeString(String value) {
    if (value == null) return "null";
    return "\\"" + escape(value) + "\\"";
  }

  static String serializeStringArray(String[] values) {
    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) builder.append(",");
      if (values[i] == null) {
        builder.append("null");
      } else {
        builder.append("\\"").append(escape(values[i])).append("\\"");
      }
    }
    builder.append("]");
    return builder.toString();
  }

  static String serializeStringList(List<String> values) {
    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) builder.append(",");
      String value = values.get(i);
      if (value == null) {
        builder.append("null");
      } else {
        builder.append("\\"").append(escape(value)).append("\\"");
      }
    }
    builder.append("]");
    return builder.toString();
  }

  static String serializeStringMatrix(String[][] values) {
    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) builder.append(",");
      builder.append(serializeStringArray(values[i]));
    }
    builder.append("]");
    return builder.toString();
  }

  static String serializeNestedStringList(List<List<String>> values) {
    List<List<String>> copy = new ArrayList<>(values);
    copy.sort((left, right) -> String.join("|", left).compareTo(String.join("|", right)));

    StringBuilder builder = new StringBuilder("[");
    for (int i = 0; i < copy.size(); i++) {
      if (i > 0) builder.append(",");
      builder.append(serializeStringList(copy.get(i)));
    }
    builder.append("]");
    return builder.toString();
  }

  static String serializeDouble(double value) {
    return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
  }

  static String serializeMergedArray(int[] values, int length) {
    int safeLength = Math.max(0, Math.min(length, values.length));
    return serializeIntArray(Arrays.copyOf(values, safeLength));
  }

  static ListNode buildListNode(int[] values) {
    ListNode dummy = new ListNode(0);
    ListNode current = dummy;
    for (int value : values) {
      current.next = new ListNode(value);
      current = current.next;
    }
    return dummy.next;
  }

  static ListNode[] buildListNodeArray(int[][] valuesList) {
    ListNode[] lists = new ListNode[valuesList.length];
    for (int i = 0; i < valuesList.length; i++) {
      lists[i] = buildListNode(valuesList[i]);
    }
    return lists;
  }

  static ListNode buildCycledList(int[] values, int pos) {
    ListNode head = buildListNode(values);
    if (head == null || pos < 0) return head;

    ListNode cycleNode = null;
    ListNode current = head;
    int index = 0;
    while (current.next != null) {
      if (index == pos) cycleNode = current;
      current = current.next;
      index++;
    }
    if (index == pos) cycleNode = current;
    current.next = cycleNode;
    return head;
  }

  static TreeNode buildTree(Integer[] values) {
    if (values.length == 0 || values[0] == null) return null;

    TreeNode root = new TreeNode(values[0]);
    Queue<TreeNode> queue = new LinkedList<>();
    queue.add(root);
    int index = 1;

    while (!queue.isEmpty() && index < values.length) {
      TreeNode node = queue.poll();

      if (index < values.length && values[index] != null) {
        node.left = new TreeNode(values[index]);
        queue.add(node.left);
      }
      index++;

      if (index < values.length && values[index] != null) {
        node.right = new TreeNode(values[index]);
        queue.add(node.right);
      }
      index++;
    }

    return root;
  }

  static boolean matchesExpected(String expected, String actual) {
    String normalizedExpected = normalize(expected);
    String normalizedActual = normalize(actual);
    if (normalizedActual.equals(normalizedExpected)) return true;

    try {
      return new BigDecimal(normalizedActual).compareTo(new BigDecimal(normalizedExpected)) == 0;
    } catch (NumberFormatException error) {
      return false;
    }
  }

  static String caseResult(int caseNum, String expected, String actual) {
    String status = matchesExpected(expected, actual) ? "pass" : "fail";
    return "{\\"caseNum\\":" + caseNum + ",\\"expected\\":\\"" + escape(expected) + "\\",\\"actual\\":\\"" + escape(actual) + "\\",\\"status\\":\\"" + status + "\\",\\"error\\":null}";
  }

  static String caseError(int caseNum, String expected, String error) {
    return "{\\"caseNum\\":" + caseNum + ",\\"expected\\":\\"" + escape(expected) + "\\",\\"actual\\":null,\\"status\\":\\"error\\",\\"error\\":\\"" + escape(error) + "\\"}";
  }

  public static void main(String[] args) throws Exception {
    Solution solution = new Solution();
    List<String> tests = new ArrayList<>();
${buildJavaCaseLines(fnName, testCases)}
    Files.writeString(Path.of("results.json"), "{\\"tests\\":[" + String.join(",", tests) + "]}");
  }
}
`;

  return {
    image: "eclipse-temurin:17-jdk",
    command: ["sh", "-lc", "javac Main.java && java Main"],
    files: [{ name: "Main.java", content }],
  };
}

export function buildRunnerFiles(payload) {
  if (payload.language === "javascript") return buildJavaScriptRunner(payload);
  if (payload.language === "python") return buildPythonRunner(payload);
  if (payload.language === "java") return buildJavaRunner(payload);
  throw new Error("Unsupported language.");
}
