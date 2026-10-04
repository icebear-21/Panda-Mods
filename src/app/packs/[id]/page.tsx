import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Download, FileBox, Layers, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DownloadLinks } from "@/components/download-links";
import { getGroup, listVersions } from "@/lib/db";
import { releaseMods } from "@/lib/archive";
import { currentUser } from "@/lib/auth";
import { formatDate, formatSize } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function PackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ release?: string }> }) {
  const { id } = await params;
  const { release } = await searchParams;
  const group = getGroup(id);
  const versions = listVersions(id);
  if (!group || !versions.length) notFound();
  const selected = release ? versions.find(v => v.id === release) : versions[0];
  if (!selected) notFound();
  const { mods, error } = await releaseMods(selected);
  const admin = (await currentUser())?.role === "admin";
  return <div className="page-shell detail-shell"><Link href="/" className="breadcrumb">Library / <span>{group.title}</span></Link>
    <div className="detail-heading"><div className="detail-icon"><Box size={38} /></div><div className="detail-title"><div className="inline-title"><Badge variant="secondary">{selected.loader}</Badge><span>Minecraft Java Edition</span></div><h1>{group.title}</h1><p>{group.description || "A new world of mods, ready to explore."}</p></div>{admin && <Button asChild variant="outline"><Link href={"/admin?pack=" + id}><Settings2 />Manage</Link></Button>}</div>
    <div className="detail-grid"><section className="detail-main"><Tabs key={selected.id} defaultValue="mods"><TabsList className="detail-tabs"><TabsTrigger value="mods">Mods <span>{mods.length}</span></TabsTrigger><TabsTrigger value="versions">Versions <span>{versions.length}</span></TabsTrigger><TabsTrigger value="notes">Release notes</TabsTrigger></TabsList>
      <TabsContent value="mods"><Card><CardContent className="detail-content"><div className="section-heading"><div><h2>Inside this pack</h2><p>JAR files included in release {selected.release_version}.</p></div><FileBox size={22} /></div>{error ? <p className="error-text">{error}</p> : mods.length ? <Table><TableHeader><TableRow><TableHead>Mod file</TableHead><TableHead className="text-right">Size</TableHead></TableRow></TableHeader><TableBody>{mods.map(mod => <TableRow key={mod.path}><TableCell><div className="mod-file"><FileBox size={17} /><div><strong>{mod.name}</strong><span>{mod.path}</span></div></div></TableCell><TableCell className="text-right whitespace-nowrap">{formatSize(mod.size)}</TableCell></TableRow>)}</TableBody></Table> : <div className="inner-empty"><FileBox size={28} /><p>No JAR files were found in this ZIP.</p></div>}</CardContent></Card></TabsContent>
      <TabsContent value="versions"><Card><CardContent className="detail-content"><div className="section-heading"><div><h2>Every release</h2><p>Pick a version to inspect its mods or download the ZIP.</p></div><Layers size={22} /></div><div className="version-list">{versions.map((version, index) => <div className={"version-row " + (version.id === selected.id ? "selected" : "")} key={version.id}><div><Link href={"/packs/" + id + "?release=" + version.id}><strong>{version.release_version}</strong></Link>{index === 0 && <Badge variant="secondary">Latest</Badge>}<p>MC {version.minecraft_version} · {version.loader} · {formatDate(version.created_at)}</p></div><div className="version-actions"><Button asChild size="sm" variant="outline"><Link href={"/packs/" + id + "?release=" + version.id}>View mods</Link></Button><Button asChild size="sm"><a href={"/api/packs/" + version.id + "/download"} aria-label={"Download version " + version.release_version}><Download /></a></Button></div></div>)}</div></CardContent></Card></TabsContent>
      <TabsContent value="notes"><Card><CardContent className="detail-content"><h2>Release {selected.release_version}</h2><p className="muted">Published {formatDate(selected.created_at)}</p><p className="release-notes">{selected.changelog || "No release notes were added for this version."}</p></CardContent></Card></TabsContent>
    </Tabs><DownloadLinks groupId={id} releaseId={selected.id} /></section>
    <aside><Card className="download-card"><CardContent className="detail-content"><span className="eyebrow">SELECTED RELEASE</span><h2>{selected.release_version}</h2><dl className="release-facts"><div><dt>Minecraft</dt><dd>{selected.minecraft_version}</dd></div><div><dt>Loader</dt><dd>{selected.loader}</dd></div><div><dt>Mods</dt><dd>{mods.length}</dd></div><div><dt>ZIP size</dt><dd>{formatSize(selected.size_bytes)}</dd></div><div><dt>Downloads</dt><dd>{selected.downloads.toLocaleString()}</dd></div></dl><Button asChild className="w-full"><a href={"/api/packs/" + selected.id + "/download"}><Download />Download ZIP</a></Button><p className="download-note">No account needed. Original ZIP, ready to use.</p><div className="release-picker"><strong>Switch release</strong>{versions.map(version => <Link key={version.id} href={"/packs/" + id + "?release=" + version.id} className={version.id === selected.id ? "active" : ""}>{version.release_version}<small>MC {version.minecraft_version}</small></Link>)}</div></CardContent></Card></aside></div>
  </div>;
}
