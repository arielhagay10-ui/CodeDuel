"use client";

import { useEffect, useState } from "react";
import { AppShell, buttonClass } from "@/components/app-shell";

type RatingRow = {
  difficulty: "easy" | "medium" | "advanced";
  rating: number;
  deviation: number;
  placementsCompleted: number;
  rank: { tier: string; division: string | null; points: number | null };
};

const difficultyNames = { easy: "Easy", medium: "Medium", advanced: "Advanced" };
const rankBands: [number, string, string | null][] = [
  [1000, "Bronze", "III"], [1100, "Bronze", "II"], [1200, "Bronze", "I"],
  [1300, "Silver", "III"], [1400, "Silver", "II"], [1500, "Silver", "I"],
  [1600, "Gold", "III"], [1700, "Gold", "II"], [1800, "Gold", "I"],
  [1900, "Platinum", "III"], [2000, "Platinum", "II"], [2100, "Platinum", "I"],
  [2200, "Diamond", "III"], [2300, "Diamond", "II"], [2400, "Diamond", "I"], [2500, "Master Coder", null],
];
function previewRank(value: number) {
  const index = rankBands.findIndex(([ceiling]) => value < ceiling);
  const band = index < 0 ? null : rankBands[index];
  const floor = band ? index === 0 ? 900 : rankBands[index - 1][0] : 2500;
  return { name: `${band?.[1] ?? "Grandmaster Coder"}${band?.[2] ? ` ${band[2]}` : ""}`, points: band ? Math.min(99, Math.floor(value - floor)) : null };
}

export default function DevEloPage() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [difficulty, setDifficulty] = useState<RatingRow["difficulty"]>("medium");
  const [rating, setRating] = useState("1500");
  const [deviation, setDeviation] = useState("200");
  const [message, setMessage] = useState("Loading ratings…");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/dev/ratings/me", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load ratings.");
      setRows(data.ratings);
      const selected = data.ratings.find((row: RatingRow) => row.difficulty === difficulty) ?? data.ratings[0];
      if (selected) {
        setDifficulty(selected.difficulty);
        setRating(String(selected.rating));
        setDeviation(String(selected.deviation));
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load ratings.");
    }
  }

  useEffect(() => { void load(); }, []);

  const selected = rows.find((row) => row.difficulty === difficulty);
  const preview = previewRank(Number(rating));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dev/ratings/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, rating: Number(rating), deviation: Number(deviation) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save rating.");
      setMessage("Saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save rating.");
    } finally {
      setSaving(false);
    }
  }

  return <AppShell><div className="mx-auto max-w-2xl">
    <p className="text-sm font-semibold uppercase tracking-wide text-[#ed5b39]">Local development</p>
    <h1 className="mt-2 text-3xl font-bold">Rating controls</h1>
    <p className="mt-2 text-sm text-black/60">Adjust your Glicko-2 rating and uncertainty to preview ranks and queue progress.</p>

    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {rows.map((row) => <button key={row.difficulty} type="button" onClick={() => {
        setDifficulty(row.difficulty); setRating(String(row.rating)); setDeviation(String(row.deviation)); setMessage("");
      }} className={`rounded-xl border p-4 text-left ${difficulty === row.difficulty ? "border-[#ed5b39] bg-white" : "border-black/10 bg-white/70"}`}>
        <span className="block text-sm text-black/55">{difficultyNames[row.difficulty]}</span>
        <strong className="mt-1 block">{row.rank.tier}{row.rank.division ? ` ${row.rank.division}` : ""}</strong>
        <span className="text-sm text-black/55">{row.rank.points === null ? "Top rank" : `${row.rank.points}/100 points`}</span>
      </button>)}
    </div>

    <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-black/10 bg-white p-6">
      <label className="block text-sm font-semibold">Difficulty
        <select value={difficulty} onChange={(event) => {
          const next = event.target.value as RatingRow["difficulty"];
          setDifficulty(next);
          const row = rows.find((item) => item.difficulty === next);
          if (row) { setRating(String(row.rating)); setDeviation(String(row.deviation)); }
        }} className="mt-2 block w-full rounded-lg border border-black/15 bg-white p-3 font-normal">
          {Object.entries(difficultyNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Rating (900–3500)
          <input type="number" min="900" max="3500" step="1" value={rating} onChange={(event) => setRating(event.target.value)} className="mt-2 block w-full rounded-lg border border-black/15 p-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold">Rating deviation (30–350)
          <input type="number" min="30" max="350" step="1" value={deviation} onChange={(event) => setDeviation(event.target.value)} className="mt-2 block w-full rounded-lg border border-black/15 p-3 font-normal" />
        </label>
      </div>
      {selected && <p className="text-sm text-black/60">Preview: <strong className="text-black">{preview.name}</strong>{preview.points === null ? "" : ` · ${preview.points}/100 points`} · {selected.placementsCompleted}/5 placements</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button className={buttonClass} disabled={saving || !rows.length}>{saving ? "Saving…" : "Save rating"}</button>
        {message && <p role="status" className="text-sm text-black/65">{message}</p>}
      </div>
    </form>
  </div></AppShell>;
}
