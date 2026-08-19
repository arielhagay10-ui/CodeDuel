"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Level = "Easy" | "Medium" | "Advanced";

const results: Record<Level, { rank: string; rating: number; note: string; color: string }> = {
  Easy: { rank: "Bronze II", rating: 1048, note: "A strong foundation. Keep sharpening your core patterns.", color: "#a85b3d" },
  Medium: { rank: "Silver II", rating: 1412, note: "Solid structure and speed. You are ready for competitive matches.", color: "#667483" },
  Advanced: { rank: "Gold I", rating: 1718, note: "Excellent algorithmic signal. Your ranked climb starts here.", color: "#b4862a" },
};

function PlacementResultsContent() {
  const params = useSearchParams();
  const level = (params.get("level") === "Easy" || params.get("level") === "Advanced" ? params.get("level") : "Medium") as Level;
  const result = results[level];

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]">
        <div className="bg-[#161616] px-7 py-8 text-white sm:px-10"><Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeWars<span className="text-[#ed5b39]">.</span></Link><p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Placement complete</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">You are ready to rank.</h1></div>
        <div className="p-7 sm:p-10"><div className="grid gap-7 border-b border-black/10 pb-8 sm:grid-cols-[1.25fr_.75fr]"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Starting rank</p><p className="mt-2 text-4xl font-semibold tracking-[-0.055em]" style={{ color: result.color }}>{result.rank}</p><p className="mt-3 text-sm leading-6 text-black/60">{result.note}</p></div><div className="border-l-0 border-black/10 sm:border-l sm:pl-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Rating</p><p className="mt-2 text-4xl font-semibold tracking-[-0.055em]">{result.rating}</p><p className="mt-2 text-sm text-black/55">{level} queue</p></div></div>
          <div className="grid gap-5 py-8 sm:grid-cols-3"><div><p className="text-2xl font-semibold">5 / 5</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-black/45">Placements complete</p></div><div><p className="text-2xl font-semibold">84%</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-black/45">Test pass rate</p></div><div><p className="text-2xl font-semibold">12:36</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-black/45">Average solve time</p></div></div>
          <div className="rounded-xl bg-[#f4f4f1] p-4 text-sm leading-6 text-black/65"><span className="font-bold text-black">Fair-play acknowledgement recorded.</span> Your placement score is now your starting ranked rating.</div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/queue" className="rounded-lg bg-[#161616] px-5 py-3.5 text-center text-sm font-bold text-white hover:bg-[#ed5b39]">Enter ranked queue</Link><Link href="/practice" className="rounded-lg border border-black/15 px-5 py-3.5 text-center text-sm font-bold hover:border-black">Practice first</Link></div>
        </div>
      </section>
    </main>
  );
}

export default function PlacementResultsPage() {
  return <Suspense><PlacementResultsContent /></Suspense>;
}
