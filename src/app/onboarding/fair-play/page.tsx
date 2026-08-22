"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FairPlayPage() {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function acceptFairPlay() {
    if (!agreed || pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/onboarding/fair-play", { method: "POST" });
    const data = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) { setError(data.error ?? "Could not record your agreement."); return; }
    router.push("/onboarding/placement");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Step 2 of 3</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Keep it fair.</h1>
        <p className="mt-4 text-sm leading-6 text-black/60">Ranked results only mean something when every solve is yours.</p>
        <div className="mt-8 divide-y divide-black/10 rounded-xl border border-black/10">
          {[
            ["No AI assistance", "Do not use ChatGPT, Copilot, or any other AI tool during ranked matches or placements."],
            ["No searching for solutions", "Do not look up the problem, algorithm, or solutions online."],
            ["No outside help", "Solve independently. Do not ask another person for hints, code, or answers."],
          ].map(([title, detail]) => <div key={title} className="p-4"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-sm leading-5 text-black/55">{detail}</p></div>)}
        </div>
        <label className="mt-6 flex cursor-pointer gap-3 rounded-lg p-1 text-sm leading-5"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ed5b39]" /><span>I understand and agree to the fair-play rules.</span></label>
        {error && <p className="mt-5 text-sm text-[#c73d25]">{error}</p>}
        <button disabled={!agreed || pending} onClick={() => void acceptFairPlay()} className="mt-8 block w-full rounded-lg bg-[#161616] px-5 py-3.5 text-center text-sm font-bold text-white hover:bg-[#ed5b39] disabled:cursor-not-allowed disabled:bg-black/20">{pending ? "Saving…" : "Start placement"}</button>
        <p className="mt-5 text-xs leading-5 text-black/45">Violations may invalidate a result or restrict ranked access.</p>
      </section>
    </main>
  );
}
