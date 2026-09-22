"use client";

import { useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; };
  return <button onClick={toggle} className="m-5 self-end rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-bold shadow-lg hover:border-black">{dark ? "Light mode" : "Dark mode"}</button>;
}
