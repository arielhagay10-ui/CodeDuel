"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const validHandle = /^[A-Za-z0-9](?:[A-Za-z0-9_]{1,22}[A-Za-z0-9])?$/;

function validationMessage(handle: string) {
  if (handle.length === 0) return "";
  if (handle.length < 3 || handle.length > 24) return "Use 3–24 characters.";
  if (!validHandle.test(handle)) return "Use letters, numbers, and single underscores only.";
  return "";
}

export default function HandleOnboardingPage() {
  const [handle, setHandle] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const message = useMemo(() => validationMessage(handle), [handle]);
  const canClaim = handle.length > 0 && !message && !pending;

  async function claimHandle() {
    setPending(true);
    setServerError(null);
    const response = await fetch("/api/onboarding/handle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
    const data = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) { setServerError(data.error ?? "Could not claim that handle."); return; }
    setClaimed(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Step 1 of 2</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Choose your handle.</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-black/60">This is the name your opponents see, and it will appear on leaderboards and your match history.</p>
        <label className="mt-8 block"><span className="text-sm font-bold">In-game handle</span><div className="mt-2 flex items-center rounded-lg border border-black/15 bg-white px-4 focus-within:border-black"><span className="text-black/35">@</span><input value={handle} onChange={(event) => { setHandle(event.target.value.replace(/\s/g, "")); setClaimed(false); }} maxLength={24} autoComplete="off" autoFocus placeholder="ArrayNinja" className="w-full bg-transparent px-1 py-3.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-black/30" /></div></label>
        <div className="mt-3 flex min-h-5 justify-between text-xs"><span className={message ? "text-[#c73d25]" : "text-black/45"}>{message || "3–24 characters · letters, numbers, underscores"}</span><span className="text-black/40">{handle.length}/24</span></div>
        {serverError && <div className="mt-6 rounded-lg border border-[#efb3a7] bg-[#fff0ed] px-4 py-3 text-sm text-[#c73d25]">{serverError}</div>}
        {claimed && <div className="mt-6 rounded-lg border border-[#a8d8bd] bg-[#e9f6ef] px-4 py-3 text-sm text-[#167149]"><span className="font-bold">@{handle}</span> is claimed. Continue to acknowledge fair play.</div>}
        {claimed ? <Link href="/onboarding/fair-play" className="mt-8 block w-full rounded-lg bg-[#161616] px-5 py-3.5 text-center text-sm font-bold text-white hover:bg-[#ed5b39]">Continue to fair play</Link> : <button disabled={!canClaim} onClick={() => void claimHandle()} className="mt-8 w-full rounded-lg bg-[#161616] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-black/20 hover:bg-[#ed5b39]">{pending ? "Claiming…" : "Check and claim handle"}</button>}
        <p className="mt-5 text-xs leading-5 text-black/45">Availability is confirmed by the server after sign-in. Offensive, impersonating, or reserved handles may be rejected.</p>
      </section>
    </main>
  );
}
