"use client";

import { useEffect, useRef } from "react";

const INDENT = "    ";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
};

/**
 * The dark Python editor shared by practice, placements, and ranked rounds.
 *
 * A textarea, deliberately: the CSP in `next.config.ts` allows no external
 * script host, so Monaco or CodeMirror would have to be bundled locally, and
 * neither buys anything this milestone needs.
 */
export function CodeEditor({ value, onChange, disabled = false, label }: CodeEditorProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);

  // React rewrites the value on re-render, which drops the caret to the end.
  // Put it back where the Tab insert left it.
  useEffect(() => {
    if (caret.current === null || !field.current) return;
    field.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  return (
    <textarea
      ref={field}
      disabled={disabled}
      aria-label={label}
      value={value}
      spellCheck="false"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        // Shift+Tab still moves focus, so the field is never a keyboard trap.
        if (event.key !== "Tab" || event.shiftKey) return;
        event.preventDefault();
        const { selectionStart, selectionEnd } = event.currentTarget;
        caret.current = selectionStart + INDENT.length;
        onChange(`${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`);
      }}
      className="min-h-72 flex-1 resize-none rounded-xl border border-white/10 bg-[#111] p-5 font-mono text-sm leading-7 text-[#e9e9e4] outline-none focus:border-[#ed5b39] disabled:opacity-70"
    />
  );
}
