"use client";
import Image from "next/image";
import { useState } from "react";
export function PandaMascot() {
  const [booped, setBooped] = useState(false);
  return <button type="button" className={"panda-mascot " + (booped ? "booped" : "")} aria-label="Say hello to the panda" onClick={() => { setBooped(true); setTimeout(() => setBooped(false), 1600); }}><Image src="/panda-face.png" alt="Minecraft panda face" width={96} height={96} className="pixel-image world-panda" /><span className="panda-speech" aria-live="polite">{booped ? "Boop! 🐾" : ""}</span></button>;
}
