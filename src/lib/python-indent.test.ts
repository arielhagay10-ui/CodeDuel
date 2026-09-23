import assert from "node:assert/strict";
import { test } from "node:test";
import { insertPythonNewline, removePythonIndent } from "./python-indent.ts";

test("Backspace on blank lines removes one indentation level without deleting a newline", () => {
  assert.deepEqual(removePythonIndent("if ready:\n        ", 18, 18), { value: "if ready:\n    ", caret: 14 });
  assert.deepEqual(removePythonIndent("      ", 6, 6), { value: "    ", caret: 4 });
  assert.deepEqual(removePythonIndent("\t\t", 2, 2), { value: "\t", caret: 1 });
  assert.deepEqual(removePythonIndent("    \nnext", 4, 4), { value: "\nnext", caret: 0 });
});

test("Backspace leaves ordinary text, selections and line boundaries to the browser", () => {
  assert.equal(removePythonIndent("    code", 4, 4), null);
  assert.equal(removePythonIndent("    ", 2, 4), null);
  assert.equal(removePythonIndent("first\n    ", 6, 6), null);
  assert.equal(removePythonIndent("", 0, 0), null);
});

test("Enter indents nested Python blocks and preserves the level after statements", () => {
  for (const line of ["    for item in items:", "    if ready: # comment", "    def solve(x):", "    else:", "    with open(path) as file:"]) {
    assert.equal(insertPythonNewline(line, line.length, line.length).value, line + "\n        ");
  }
  const line = "        total += item";
  assert.equal(insertPythonNewline(line, line.length, line.length).value, line + "\n        ");
});
test("colons inside strings and comments do not add indentation", () => {
  for (const line of ['    print("if:")', '    # for item:', '    value = "text:"']) {
    assert.equal(insertPythonNewline(line, line.length, line.length).value, line + "\n    ");
  }
});
test("Enter replaces a selection and places the caret before the remaining text", () => {
  const result = insertPythonNewline("    hello world", 9, 10);
  assert.equal(result.value, "    hello\n    world");
  assert.equal(result.caret, 14);
});
test("tabs and opening brackets retain appropriate indentation", () => {
  assert.equal(insertPythonNewline("\tprint(x)", 9, 9).value, "\tprint(x)\n\t");
  assert.equal(insertPythonNewline("values = [", 10, 10).value, "values = [\n    ");
});
