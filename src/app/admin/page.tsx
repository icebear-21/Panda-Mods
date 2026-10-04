import Link from "next/link";
import { redirect } from "next/navigation";
import { Box, FileArchive, Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadForm } from "@/components/upload-form";
import { SubmitButton } from "@/components/submit-button";
import { currentUser } from "@/lib/auth";
import { getGroup, listPacks } from "@/lib/db";
import { updatePackAction } from "@/app/actions";
export const metadata = { title: "Manage packs" };
export const dynamic = "force-dynamic";
export default async function Admin({ searchParams }: { searchParams: Promise<{ pack?: string; saved?: string; error?: string }> }) {
  if ((await currentUser())?.role !== "admin") redirect("/login");
  const params = await searchParams;
  const packs = listPacks();
  const selected = params.pack ? getGroup(params.pack) : undefined;
  return <div className="page-shell admin-shell"><div className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> ADMIN WORKSPACE</span><h1>Build the next adventure.</h1><p>Publish a pack, add a new release, or update its details.</p></div><Badge variant="outline">Admin access</Badge></div>
    <div className="admin-grid"><Card><CardContent className="detail-content"><div className="section-heading"><div><h2>{selected ? "Publish an update" : "Upload a mod pack"}</h2><p>ZIP uploads stream directly to storage. Up to 1 GB.</p></div><FileArchive size={24} /></div><UploadForm key={selected?.id || "new"} packs={packs} selectedId={selected?.id} /></CardContent></Card>
    <aside className="admin-aside"><Card><CardContent className="detail-content"><div className="section-heading"><h2>Your packs</h2><Button asChild size="sm" variant="outline"><Link href="/admin"><Plus />New</Link></Button></div>{packs.length ? <div className="admin-pack-list">{packs.map(pack => <div key={pack.id} className={"admin-pack " + (pack.id === selected?.id ? "selected" : "")}><Box size={22} /><div><Link href={"/packs/" + pack.id}><strong>{pack.title}</strong></Link><span>{pack.version_count} releases · latest {pack.latest.release_version}</span></div><Button asChild variant="ghost" size="sm"><Link href={"/admin?pack=" + pack.id}>Update</Link></Button></div>)}</div> : <p className="muted">No packs yet. Your first upload will appear here.</p>}</CardContent></Card>
    {selected && <Card><CardContent className="detail-content"><h2>Edit pack details</h2><p className="muted">Changes apply to the public pack page.</p>{params.saved && <Alert><AlertDescription>Pack details saved.</AlertDescription></Alert>}{params.error && <Alert variant="destructive"><AlertDescription>{params.error === "name" ? "Another pack already uses that name." : "Check the pack name and description."}</AlertDescription></Alert>}<form action={updatePackAction} className="form-stack"><input type="hidden" name="groupId" value={selected.id} /><div><Label htmlFor="edit-title">Name</Label><Input id="edit-title" name="title" defaultValue={selected.title} required minLength={3} maxLength={80} /></div><div><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" name="description" defaultValue={selected.description} maxLength={500} /></div><SubmitButton>Save details</SubmitButton></form></CardContent></Card>}</aside></div>
  </div>;
}

