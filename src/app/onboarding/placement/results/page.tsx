"use client";
import Link from "next/link";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { difficultyLabel,rankLabel } from "@/lib/match-view";
export default function Results(){const {data,error}=useResource("ranks",api.getRatings,4000);return <AppShell><h1 className="text-4xl font-semibold">Your placement results</h1><ErrorNotice message={error}/><div className="my-8 grid gap-5 sm:grid-cols-3">{data?.ratings.map(r=><section key={r.difficulty} className="rounded-xl border bg-white p-6"><h2>{difficultyLabel(r.difficulty)}</h2><p className="my-4 text-2xl font-bold">{rankLabel(r.rank)}</p><p>{r.placementsCompleted}/5 completed</p></section>)}</div><Link href="/onboarding/placement" className={buttonClass}>Continue placements</Link><Link href="/queue" className="ml-5 underline">Ranked queue</Link></AppShell>;}
