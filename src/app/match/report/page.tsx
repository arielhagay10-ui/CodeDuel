"use client";

import Link from "next/link";
import { useState } from "react";

const reasons = [
  ["suspected_cheating", "Suspected cheating"],
  ["inappropriate_handle", "Inappropriate handle"],
  ["abusive_behavior", "Abusive behavior"],
  ["other", "Other"],
] as const;

export default function ReportPage() {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>("suspected_cheating");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]"><section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Report submitted</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Thanks for letting us know.</h1><p className="mt-4 text-sm leading-6 text-black/60">Reports are private and reviewed with match records and submission data. We will not share the outcome with the reported player.</p><Link href="/" className="mt-8 inline-block rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white">Back to dashboard</Link></section></main>;

  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]"><section className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Post-match report</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Report KiteByte</h1><p className="mt-3 text-sm leading-6 text-black/60">Use reports for genuine concerns. They are reviewed privately; false or abusive reports may limit your reporting access.</p><fieldset className="mt-7 space-y-2"><legend className="mb-3 text-sm font-bold">What happened?</legend>{reasons.map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${reason === value ? "border-[#161616] bg-[#f4f4f1]" : "border-black/10"}`}><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset><label className="mt-6 block text-sm font-bold">Details <span className="font-normal text-black/40">optional</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} placeholder="Tell us what made you concerned…" className="mt-2 min-h-28 w-full resize-y rounded-lg border border-black/15 p-3 text-sm font-normal outline-none focus:border-black" /></label><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/match/complete" className="rounded-lg px-4 py-3 text-center text-sm font-bold text-black/60 hover:text-black">Cancel</Link><button onClick={() => setSubmitted(true)} className="rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white">Submit report</button></div></section></main>;
}
