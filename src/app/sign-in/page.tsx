"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-9">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeWars<span className="text-[#ed5b39]">.</span></Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked access</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Play for rank.</h1>
        <p className="mt-4 text-sm leading-6 text-black/60">Sign in to complete placements and earn a separate rank in Easy, Medium, and Advanced.</p>
        <div className="mt-8 space-y-3">
          <button onClick={() => { setNotice(null); void signIn("google", { redirectTo: "/onboarding/handle" }); }} className="flex w-full items-center justify-center gap-3 rounded-lg border border-black/15 px-4 py-3 text-sm font-bold hover:border-black"><span className="grid h-5 w-5 place-items-center rounded-full border border-black/30 text-xs">G</span>Continue with Google</button>
          <button onClick={() => { setNotice(null); void signIn("github", { redirectTo: "/onboarding/handle" }); }} className="flex w-full items-center justify-center gap-3 rounded-lg border border-black/15 px-4 py-3 text-sm font-bold hover:border-black"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#161616] text-xs text-white">⌘</span>Continue with GitHub</button>
        </div>
        {notice && <p className="mt-5 rounded-lg bg-[#f4f4f1] px-4 py-3 text-sm text-black/65">{notice}</p>}
        <div className="mt-7 border-t border-black/10 pt-6"><p className="text-sm text-black/55">Just practicing? No account needed.</p><Link href="/practice" className="mt-3 inline-block text-sm font-bold underline decoration-black/25 underline-offset-4">Continue as guest</Link></div>
      </section>
    </main>
  );
}
