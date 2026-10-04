"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, FileArchive, LoaderCircle, UploadCloud } from "lucide-react";
import type { PackSummary } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { formatSize } from "@/lib/utils";

export function UploadForm({ packs, selectedId }: { packs: PackSummary[]; selectedId?: string }) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(selectedId || "new");
  const [loader, setLoader] = useState("Fabric");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ groupId: string; duplicate: boolean } | null>(null);
  const locked = useRef(false);
  const uploadKey = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = status === "uploading" || status === "processing";
  const group = packs.find(p => p.id === groupId);

  function chooseFile(next: File | null) {
    if (next && (!next.name.toLowerCase().endsWith(".zip") || next.size > MAX_UPLOAD_BYTES)) { setError("Choose a ZIP file no larger than 1 GB."); setFile(null); return; }
    setFile(next); setError(""); setStatus("idle"); setResult(null); uploadKey.current = null;
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!file) { setError("Choose a ZIP file first."); return; }
    locked.current = true; setStatus("uploading"); setProgress(0); setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    form.set("file", file); form.set("loader", loader);
    if (group) { form.set("groupId", group.id); form.set("title", group.title); form.set("description", group.description); }
    // Retain the key after a network failure, so a retry cannot create another release.
    uploadKey.current ||= crypto.randomUUID();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.setRequestHeader("X-Upload-Key", uploadKey.current);
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.upload.onload = () => { setProgress(100); setStatus("processing"); };
    const failed = (message: string) => { locked.current = false; setStatus("idle"); setError(message); };
    xhr.onerror = () => failed("Connection lost. Try again; your upload won’t be published twice.");
    xhr.onabort = () => failed("Upload cancelled.");
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { failed(xhr.status === 413 ? "Your hosting proxy rejected the upload size. Set its upload limit to at least 1 GB." : "The server returned an unexpected response. Please retry."); return; }
      if (xhr.status < 200 || xhr.status >= 300) { uploadKey.current = null; failed(data.error || "Upload failed."); return; }
      locked.current = false; setStatus("done"); setResult(data); router.refresh();
    };
    xhr.send(form);
  }
  return <form onSubmit={submit} className="form-stack">
    <fieldset disabled={active || status === "done"} className="form-stack" onChange={() => { uploadKey.current = null; }}>
      <div><Label htmlFor="pack-choice">Mod pack</Label><Select value={groupId} onValueChange={value => { setGroupId(value); uploadKey.current = null; }}><SelectTrigger id="pack-choice" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Create a new pack</SelectItem>{packs.map(pack => <SelectItem key={pack.id} value={pack.id}>{pack.title}</SelectItem>)}</SelectContent></Select><p className="field-help">Choose an existing pack to publish an update under the same page.</p></div>
      {!group && <><div><Label htmlFor="title">Pack name</Label><Input id="title" name="title" required minLength={3} maxLength={80} placeholder="e.g. Cobblemon Adventures" /></div><div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" maxLength={500} placeholder="What makes this world worth exploring?" /></div></>}
      <div className="form-two-columns"><div><Label htmlFor="version">Release version</Label><Input id="version" name="version" required maxLength={40} placeholder="e.g. 1.0.0" onChange={() => { uploadKey.current = null; }} /></div><div><Label htmlFor="minecraftVersion">Minecraft version</Label><Input id="minecraftVersion" name="minecraftVersion" required minLength={3} maxLength={30} placeholder="e.g. 1.21.1" /></div></div>
      <div><Label htmlFor="loader">Mod loader</Label><Select value={loader} onValueChange={value => { setLoader(value); uploadKey.current = null; }}><SelectTrigger id="loader" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["Fabric", "Forge", "NeoForge", "Quilt", "Other"].map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="changelog">Release notes</Label><Textarea id="changelog" name="changelog" maxLength={4000} rows={3} placeholder="What changed in this release?" /></div>
      <div className="file-drop" onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!active && status !== "done") chooseFile(event.dataTransfer.files[0]); }}><FileArchive size={30} /><strong>{file ? file.name : "Drop your ZIP here"}</strong><span>{file ? formatSize(file.size) : "or choose a file · up to 1 GB"}</span><Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>Choose ZIP</Button><input ref={fileInput} id="file" aria-label="Mod pack ZIP" type="file" accept=".zip" className="sr-only" onChange={event => chooseFile(event.target.files?.[0] || null)} /></div>
    </fieldset>
    {active && <div className="upload-progress" role="status" aria-live="polite"><div><span>{status === "processing" ? "Inspecting mods and publishing…" : "Uploading ZIP…"}</span><strong>{progress}%</strong></div><Progress value={progress} aria-label="Upload progress" /><p>{status === "processing" ? "Upload complete. Keep this page open while the archive is checked." : "You can publish only once while this upload is running."}</p></div>}
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    {result && <Alert><Check size={16} /><AlertDescription>{result.duplicate ? "This ZIP was already published. No duplicate release was created." : "Release published. Players can download it now."}<Link href={"/packs/" + result.groupId} className="text-link">Open pack page</Link></AlertDescription></Alert>}
    {status === "done" ? <Button type="button" variant="outline" onClick={() => { setStatus("idle"); setResult(null); setFile(null); uploadKey.current = null; if (fileInput.current) fileInput.current.value = ""; }}>Upload another release</Button> : <Button type="submit" disabled={active}>{active ? <LoaderCircle className="animate-spin" /> : <UploadCloud />}{active ? status === "processing" ? "Publishing…" : "Uploading…" : group ? "Publish update" : "Publish pack"}</Button>}
  </form>;
}
