"use client";
import { useCallback, useEffect, useState } from "react";

export function useResource<T>(key: string, load: () => Promise<T>, pollMs = 0) {
  const [entry,setEntry]=useState<{key:string;data:T|null;error:string|null}|null>(null);
  const [version,setVersion]=useState(0);
  const refresh=useCallback(()=>setVersion(n=>n+1),[]);
  useEffect(()=>{
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    async function run(){
      try {const data=await load();if(!cancelled)setEntry({key,data,error:null});}
      catch(error){if(!cancelled)setEntry(previous=>({key,data:previous?.key===key?previous.data:null,error:error instanceof Error?error.message:"Request failed."}));}
      finally {if(!cancelled&&pollMs)timer=setTimeout(run,pollMs);}
    }
    void run();return()=>{cancelled=true;clearTimeout(timer);};
  },[key,load,pollMs,version]);
  return { data:entry?.key===key?entry.data:null,error:entry?.key===key?entry.error:null,refresh };
}
