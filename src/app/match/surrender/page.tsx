"use client";

import Link from "next/link";
import { useState } from "react";

export default function SurrenderPage() {
  const [surrendered, setSurrendered] = useState(false);

  if (surrendered) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]"><section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Match ended</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">You surrendered.</h1><p className="mt-4 text-sm leading-6 text-black/60">The result is final and your Medium ranking will update after the match record is confirmed.</p><Link href="/" className="mt-8 inline-block rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white">Back to dashboard</Link></section></main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]"><section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel · Medium</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Surrender this match?</h1><p className="mt-4 text-sm leading-6 text-black/60">This ends the match immediately. It counts as a loss and has the same rating result as a disconnect forfeit.</p><div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/practice" className="rounded-lg px-4 py-3 text-center text-sm font-bold text-black/60 hover:text-black">Keep playing</Link><button onClick={() => setSurrendered(true)} className="rounded-lg bg-[#c73d25] px-5 py-3 text-sm font-bold text-white hover:bg-[#ad2e1c]">Surrender match</button></div></section></main>
  );
}
