"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function clock(seconds: number) { return `0:${seconds.toString().padStart(2, "0")}`; }

function MatchResultsContent() {
  const router = useRouter();
  const level = useSearchParams().get("level") ?? "Medium";
  const [seconds, setSeconds] = useState(60);
  const [ready, setReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([{ sender: "KiteByte", body: "Nice solve. That one got me.", own: false }]);
  useEffect(() => { if (seconds === 0) return; const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000); return () => window.clearInterval(timer); }, [seconds]);
  useEffect(() => { if (!ready) return; const timer = window.setTimeout(() => setOpponentReady(true), 900); return () => window.clearTimeout(timer); }, [ready]);
  useEffect(() => { if (!((ready && opponentReady) || seconds === 0)) return; const timer = window.setTimeout(() => router.push(`/match/round?round=2&level=${level}`), 700); return () => window.clearTimeout(timer); }, [level, opponentReady, ready, router, seconds]);
  const send = () => { const body = message.trim(); if (!body) return; setMessages((items) => [...items, { sender: "You", body, own: true }]); setMessage(""); };

  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]"><section className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
    <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel · {level}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Round one complete.</h1></div><span className="rounded-full bg-[#f4f4f1] px-3 py-1.5 text-xs font-bold">Best of 3</span></div>
    <div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-y border-black/10 py-7 text-center"><div><span className="grid mx-auto h-11 w-11 place-items-center rounded-full bg-[#161616] text-sm font-bold text-white">A</span><p className="mt-3 text-sm font-bold">You</p><p className="mt-1 text-xs text-black/45">Medium · Silver II</p><p className="mt-1 text-sm font-bold text-[#167149]">12 / 12 tests</p><p className="mt-1 text-xs text-black/45">4:38</p></div><div><p className="text-4xl font-semibold tracking-tight">1 — 0</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-black/40">Round score</p></div><div><span className="grid mx-auto h-11 w-11 place-items-center rounded-full bg-[#d9d8d2] text-sm font-bold">G</span><p className="mt-3 text-sm font-bold">GraphRunner</p><p className="mt-1 text-xs text-black/45">Medium · Silver II</p><p className="mt-1 text-sm font-bold text-black/65">7 / 12 tests</p><p className="mt-1 text-xs text-black/45">6:12</p></div></div>
    <p className="mt-4 text-center text-xs leading-5 text-black/45">Higher test score wins the round. Solve time breaks an equal-score tie.</p>
    <div className="mt-8 grid gap-5 lg:grid-cols-2"><div className="rounded-xl bg-[#f4f4f1] p-5"><div className="flex justify-between gap-4"><div><p className="font-semibold">Next: Round two</p><p className="mt-1 text-sm text-black/55">Starts early when both players are ready, or automatically at 0:00.</p></div><p className="font-mono text-xl font-bold">{clock(seconds)}</p></div><div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs font-bold"><div className={`rounded-lg border px-3 py-3 ${ready ? "border-[#21885d] bg-[#e9f6ef] text-[#167149]" : "border-black/10 bg-white"}`}>{ready ? "You are ready" : "You are not ready"}</div><div className={`rounded-lg border px-3 py-3 ${opponentReady ? "border-[#21885d] bg-[#e9f6ef] text-[#167149]" : "border-black/10 bg-white text-black/50"}`}>{opponentReady ? "GraphRunner is ready" : "GraphRunner deciding…"}</div></div></div><div className="rounded-xl border border-black/10 p-4"><div className="flex justify-between"><p className="text-sm font-bold">Between-round chat</p><span className="text-xs text-black/45">Closes at round start</span></div><div className="mt-3 h-28 space-y-2 overflow-y-auto text-sm">{messages.map((item, index) => <div key={`${item.sender}-${index}`} className={item.own ? "text-right" : ""}><b>{item.sender}</b><span className="text-black/60"> · {item.body}</span></div>)}</div><div className="mt-3 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} maxLength={300} placeholder="Say good game…" className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"/><button onClick={send} className="rounded-lg bg-[#161616] px-3 py-2 text-xs font-bold text-white">Send</button></div></div></div>
    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Link href="/practice" className="rounded-lg px-4 py-3 text-center text-sm font-bold text-black/60 hover:text-black">Finish this in solo practice</Link>{ready && opponentReady ? <span className="rounded-lg bg-[#21885d] px-5 py-3 text-center text-sm font-bold text-white">Both ready — starting</span> : <button onClick={() => setReady(true)} disabled={ready} className="rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white disabled:bg-[#21885d]">{ready ? "Ready — waiting" : "Ready for round two"}</button>}</div>
  </section></main>;
}

export default function MatchResultsPage() {
  return <Suspense><MatchResultsContent /></Suspense>;
}
