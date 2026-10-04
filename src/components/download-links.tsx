"use client";
import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
export function DownloadLinks({ groupId, releaseId }: { groupId: string; releaseId: string }) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  async function copy(path: string) {
    try {
      const url = new URL(path, window.location.origin).href;
      await navigator.clipboard.writeText(url);
      setCopied(path); setError(""); setTimeout(() => setCopied(""), 2500);
    } catch { setError("Copy the displayed path from your browser’s address bar."); }
  }
  const links = [
    { label: "Latest release", path: "/downloads/" + groupId + "/latest" },
    { label: "This version", path: "/api/packs/" + releaseId + "/download" },
  ];
  return <div className="direct-links"><div className="inline-title"><Terminal size={16} /><strong>Public download links</strong></div><p>Use either URL with wget or curl. No login required.</p>{links.map(link => <div className="direct-link-row" key={link.path}><div><span>{link.label}</span><code>{link.path}</code></div><Button type="button" variant="outline" size="sm" onClick={() => copy(link.path)} aria-label={"Copy " + link.label + " link"}>{copied === link.path ? <Check /> : <Copy />}{copied === link.path ? "Copied" : "Copy URL"}</Button></div>)}{error && <p role="alert">{error}</p>}</div>;
}

