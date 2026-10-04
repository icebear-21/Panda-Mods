"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Box, Download, Layers, Search, PackageOpen } from "lucide-react";
import type { PackSummary } from "@/lib/db";
import { formatSize } from "@/lib/utils";
export function Library({ packs, admin }: { packs: PackSummary[]; admin: boolean }) {
  const [query, setQuery] = useState("");
  const visible = packs.filter(pack => (pack.title + " " + pack.description + " " + pack.latest.loader).toLowerCase().includes(query.toLowerCase()));
  return <section id="packs" className="library-section">
    <div className="library-toolbar"><div><h2>Mod pack library <span>{packs.length}</span></h2><p>One pack. Every release. Your choice.</p></div><div className="search-field"><Search size={17} /><Input aria-label="Search mod packs" placeholder="Search the library…" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
    {visible.length ? <div className="pack-grid">{visible.map((pack, index) => <Card key={pack.id} className={"pack-card biome-" + (index % 3)}>
      <Link href={"/packs/" + pack.id} className="pack-cover" aria-label={"Open " + pack.title}><Box size={46} strokeWidth={1.5} /><span className="cover-caption">{pack.latest.loader.toUpperCase()} / JAVA</span><span className="cover-open">Explore pack</span></Link>
      <CardContent className="pack-content"><div className="pack-meta"><Badge variant="secondary">{pack.latest.loader}</Badge><span>MC {pack.latest.minecraft_version}</span></div><Link href={"/packs/" + pack.id}><h3>{pack.title}</h3></Link><p className="pack-description">{pack.description || "A new world of mods, ready to explore."}</p><div className="pack-stats"><span><Layers size={14} />{pack.version_count} {pack.version_count === 1 ? "release" : "releases"}</span><span><Download size={14} />{pack.downloads.toLocaleString()}</span><span>{formatSize(pack.latest.size_bytes)}</span></div><div className="pack-actions"><Button asChild variant="outline"><Link href={"/packs/" + pack.id}>View mods & versions</Link></Button><Button asChild><a href={"/downloads/" + pack.id + "/latest"} aria-label={"Download " + pack.title}><Download />Download</a></Button></div></CardContent>
    </Card>)}</div> : <Card className="empty-card"><PackageOpen size={42} /><h3>{packs.length ? "No matching packs" : "A fresh world awaits"}</h3><p>{packs.length ? "Try another name or mod loader." : "The library is ready for its first mod pack."}</p>{admin && !packs.length && <Button asChild><Link href="/admin">Upload your first pack</Link></Button>}</Card>}
  </section>;
}

