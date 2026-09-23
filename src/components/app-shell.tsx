"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";

export const buttonClass="inline-block rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white hover:bg-[#ed5b39] disabled:opacity-40";
export function AppShell({children,compact=false}:{children:React.ReactNode;compact?:boolean}) {
  const {data}=useResource("account",api.getMe);
  return <main className="flex min-h-svh flex-col bg-[#f7f7f5] text-[#161616]">
    <header className="border-b border-black/10 bg-white"><nav className={`mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 text-sm ${compact?"py-3":"py-5"}`}>
      <Link className="mr-auto text-xl font-bold" href="/">CodeDuel<span className="text-[#ed5b39]">.</span></Link>
      <Link href="/practice">Practice</Link><Link href="/queue">Ranked</Link>
      {process.env.NODE_ENV !== "production" && data?.user && <Link href="/dev/elo">Dev rating</Link>}
      {data?.user ? <><Link href={data.user.handle?`/players/${encodeURIComponent(data.user.handle)}`:"/onboarding/handle"}>{data.user.handle?`@${data.user.handle}`:"Choose handle"}</Link><button onClick={()=>void signOut({callbackUrl:"/"})}>Sign out</button></>:<Link href="/sign-in">Sign in</Link>}
    </nav></header>
    {process.env.NEXT_PUBLIC_MOCK_API==="1"&&<p className="bg-amber-100 p-2 text-center text-sm">Mock preview — simulated opponents and results</p>}
    <section className={`mx-auto w-full max-w-6xl flex-1 px-6 ${compact?"flex flex-col justify-center py-4":"py-10"}`}>{children}</section>
  </main>;
}
export function ErrorNotice({message}:{message:string|null}) {return message?<p role="alert" className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message} <Link href="/sign-in" className="underline">Sign in</Link></p>:null;}
