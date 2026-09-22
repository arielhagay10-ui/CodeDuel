"use client";
import { Suspense,useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { useMatchState } from "@/lib/hooks/use-match";
function Presence(){
  const id=useSearchParams().get("matchId");const {data,failures,refresh}=useMatchState(id);
  const active=!!data&&["waiting","active","between_rounds"].includes(data.status);
  const failing=failures>=2;
  useEffect(()=>{
    if(!id||!active)return;
    let sequence=Promise.resolve();
    const send=(connected:boolean)=>{sequence=sequence.then(()=>api.presence(id,connected)).then(()=>undefined,()=>undefined);};
    const visibility=()=>send(document.visibilityState==="visible"&&!failing);
    const leaving=()=>send(false);
    visibility();document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",leaving);
    return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",leaving);};
  },[id,active,failing]);
  return failing?<div role="alert" className="sticky top-0 z-20 bg-amber-100 p-4 text-center text-sm">Connection interrupted. Retrying automatically; your server timer continues. <button className="underline" onClick={()=>void refresh()}>Retry now</button></div>:null;
}
export default function MatchLayout({children}:{children:React.ReactNode}){return <><Suspense><Presence/></Suspense>{children}</>;}
