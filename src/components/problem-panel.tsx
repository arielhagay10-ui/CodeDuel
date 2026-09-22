import { Markdown } from "@/components/markdown";
import { difficultyLabel, formatExample } from "@/lib/match-view";
import type { RoundProblem } from "@/types/api";
export function ProblemPanel({problem}:{problem:RoundProblem}) {
  return <article className="rounded-xl border border-black/10 bg-white p-6">
    <p className="text-sm text-[#c73d25]">{difficultyLabel(problem.difficulty)} · Python</p>
    <h1 className="my-5 text-3xl font-semibold">{problem.title}</h1><Markdown source={problem.statementMarkdown}/>
    <h2 className="mt-6 font-bold">Public examples</h2>
    {problem.publicTests.map(t=>{const ex=formatExample(problem,t);return <pre key={t.ordinal} className="mt-3 overflow-auto rounded bg-black/5 p-4 text-sm">{ex.call+"\n# "+ex.output}</pre>;})}
  </article>;
}
