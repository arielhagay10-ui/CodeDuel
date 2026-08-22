import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small markdown renderer for problem statements.
 *
 * It covers exactly what the seed problems use — paragraphs, `##` headings,
 * fenced code, inline backticks, and bullet lists — because `package.json` is
 * shared with the backend track and a dependency there is a conversation, not
 * a commit.
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

const isFence = (line: string) => line.startsWith("```");
const isHeading = (line: string) => /^#{1,6}\s/.test(line);
const isBullet = (line: string) => /^\s*[-*]\s+/.test(line);

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor];

    if (isFence(line)) {
      const body: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !isFence(lines[cursor])) body.push(lines[cursor++]);
      cursor += 1; // closing fence, or the end of the string
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (isHeading(line)) {
      blocks.push({ kind: "heading", text: line.replace(/^#{1,6}\s+/, "") });
      cursor += 1;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (cursor < lines.length && isBullet(lines[cursor])) {
        items.push(lines[cursor++].replace(/^\s*[-*]\s+/, ""));
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    if (!line.trim()) {
      cursor += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !isFence(lines[cursor]) &&
      !isHeading(lines[cursor]) &&
      !isBullet(lines[cursor])
    ) {
      paragraph.push(lines[cursor++]);
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) =>
    part.length > 1 && part.startsWith("`") && part.endsWith("`") ? (
      <code key={index} className="rounded bg-[#f4f4f1] px-1.5 py-0.5 font-mono text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="max-w-xl">
      {parse(source).map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h2 key={index} className="mt-8 text-sm font-bold uppercase tracking-[0.14em] text-black/45 first:mt-0">
              {inline(block.text)}
            </h2>
          );
        }
        if (block.kind === "code") {
          return (
            <pre key={index} className="mt-3 overflow-x-auto rounded-xl bg-[#f4f4f1] p-4 font-mono text-sm leading-6 first:mt-0">
              {block.text}
            </pre>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="mt-3 space-y-2 text-sm leading-6 text-black/65 first:mt-0">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>• {inline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="mt-4 leading-7 text-black/70 first:mt-0">
            {inline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
