import { PandaMascot } from "@/components/panda-mascot";
import { Badge } from "@/components/ui/badge";
import { Library } from "@/components/library";
import { currentUser } from "@/lib/auth";
import { listPacks } from "@/lib/db";
import { Download, Layers3, Package } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const packs = listPacks();
  const user = await currentUser();
  return <div className="page-shell"><section className="dashboard-intro"><div><Badge variant="outline" className="edition-badge">MINECRAFT JAVA EDITION</Badge><h1>Small packs.<br /><span>Big adventures.</span></h1><p>Explore what’s inside, pick a release, and build your next world. Every pack is a free download.</p></div><div className="world-card"><PandaMascot /><div><span className="eyebrow">YOUR INVENTORY</span><div className="inventory-stats"><span><Package size={18} /><strong>{packs.length}</strong><small>packs</small></span><span><Layers3 size={18} /><strong>{packs.reduce((n,p) => n+p.version_count,0)}</strong><small>releases</small></span><span><Download size={18} /><strong>{packs.reduce((n,p) => n+p.downloads,0)}</strong><small>downloads</small></span></div></div></div></section><Library packs={packs} admin={user?.role === "admin"} /></div>;
}

