"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
export default function SignInPage() {
  const router=useRouter();
  const [notice,setNotice]=useState<string|null>(null),[handle,setHandle]=useState(""),[busy,setBusy]=useState(false);
  async function devLogin(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setNotice(null);
    try {const result=await signIn("dev",{handle,redirect:false,callbackUrl:"/sign-in/continue"});
      if(result?.error)setNotice("Could not sign in. Use a handle with 3–24 letters, numbers or underscores.");
      else {router.push("/sign-in/continue");router.refresh();}
    } catch {setNotice("Sign-in is unavailable. Please retry.");} finally {setBusy(false);}
  }
  async function provider(name:string) {setBusy(true);try {await signIn(name,{callbackUrl:"/sign-in/continue"});}catch{setNotice("Sign-in is unavailable. Please retry.");setBusy(false);}}
  return <AppShell><section className="mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-8"><h1 className="text-4xl font-semibold">Play for rank.</h1><p className="my-5 text-black/60">Sign in to run practice code and play ranked matches.</p>
    <div className="grid gap-3"><button className={buttonClass} disabled={busy} onClick={()=>void provider("google")}>Continue with Google</button><button className={buttonClass} disabled={busy} onClick={()=>void provider("github")}>Continue with GitHub</button></div>
    {process.env.NODE_ENV==="development"&&<form onSubmit={devLogin} className="mt-8 border-t pt-6"><label className="block text-sm font-bold">Development handle<input value={handle} onChange={e=>setHandle(e.target.value)} pattern="[A-Za-z0-9_]{3,24}" required minLength={3} maxLength={24} autoComplete="off" className="my-3 block w-full rounded border p-3"/></label><button disabled={busy} className={buttonClass}>Sign in locally</button><p className="mt-2 text-xs text-black/50">Local testing only. This creates a placement-complete test player.</p></form>}
    <ErrorNotice message={notice}/><Link href="/practice" className="mt-7 block underline">Browse practice as a guest</Link>
  </section></AppShell>;
}
