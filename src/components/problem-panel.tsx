import { Markdown } from "@/components/markdown";
import { difficultyLabel, formatExample } from "@/lib/match-view";
import type { RoundProblem } from "@/types/api";
export function ProblemPanel({problem}:{problem:RoundProblem}) {
  return <article className="rounded-xl border border-black/10 bg-white p-6">
    <p className="text-sm text-[#c73d25]">{difficultyLabel(problem.difficulty)} · Python</p>
    <h2 className="my-5 text-3xl font-semibold">{problem.title}</h2>
    <section className="mb-6 rounded-lg bg-[#fbebe5] p-4 text-sm leading-6" aria-label="How to answer">
      <h3 className="font-bold">How to answer</h3>
      {problem.format==="function"?<p>Complete <code>{problem.entrypoint??"the starter function"}</code> in the editor. Keep its name and parameters. The judge supplies the inputs; use <code>return</code> for your answer, not <code>print()</code>. You do not need to call the function yourself.</p>:<p>Read the input from standard input and print your answer to standard output. Match the output format shown below.</p>}
    </section>
    <Markdown source={problem.statementMarkdown}/>
    <h3 className="mt-6 font-bold">Examples: input → expected answer</h3>
    <p className="mt-2 text-sm text-black/60">These are the public tests used by practice. Your code should work for other valid inputs too.</p>
    {problem.publicTests.map((t,index)=>{const ex=formatExample(problem,t);return <section key={t.ordinal} className="mt-4 rounded-lg border border-black/10 p-4"><h4 className="mb-3 text-sm font-bold">Example {index+1}</h4><p className="text-xs font-semibold text-black/60">{problem.format==="function"?"Function call (inputs)":"Input"}</p><pre className="my-2 overflow-auto rounded bg-black/5 p-3 text-sm">{ex.call}</pre><p className="text-xs font-semibold text-black/60">{problem.format==="function"?"Expected return value":"Expected output"}</p><pre className="mt-2 overflow-auto rounded bg-black/5 p-3 text-sm">{ex.output}</pre></section>;})}
  </article>;
}
