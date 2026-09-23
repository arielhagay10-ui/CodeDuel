export const PYTHON_INDENT = "    ";

/** Backspace on a blank indented line moves to the previous indentation stop. */
export function removePythonIndent(source: string, start: number, end: number) {
  if (start !== end || start === 0) return null;
  const lineStart = source.slice(0, start).lastIndexOf("\n") + 1;
  const nextNewline = source.indexOf("\n", start);
  const lineEnd = nextNewline === -1 ? source.length : nextNewline;
  if (start === lineStart || !/^[\t ]*$/.test(source.slice(lineStart, lineEnd))) return null;
  const prefix = source.slice(lineStart, start);
  const spaces = prefix.match(/ +$/)?.[0].length ?? 0;
  const count = spaces ? (spaces % PYTHON_INDENT.length || PYTHON_INDENT.length) : 1;
  return { value: source.slice(0, start - count) + source.slice(start), caret: start - count };
}

/** Continue this line's indentation; open Python blocks get one extra level. */
export function insertPythonNewline(source: string, start: number, end: number) {
  const prefix = source.slice(source.lastIndexOf("\n", start - 1) + 1, start);
  const indent = prefix.match(/^[\t ]*/)?.[0] ?? "";
  // Ignore comments and quoted text so `print("if:")` cannot open a block.
  let code = "", quote = "", escaped = false;
  for (const char of prefix) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (char === "#") break;
    else if (char === '"' || char === "'") { quote = char; code += "x"; }
    else code += char;
  }
  const block = /^(?:async\s+)?(?:for|while|if|elif|else|def|class|try|except|finally|with|match|case)\b.*:\s*$/.test(code.trim());
  const continuation = /[([{]\s*$/.test(code);
  const inserted = `\n${indent}${!quote && (block || continuation) ? PYTHON_INDENT : ""}`;
  return { value: source.slice(0, start) + inserted + source.slice(end), caret: start + inserted.length };
}
