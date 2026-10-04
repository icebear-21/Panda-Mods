import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Boxes, LogIn, LogOut, SlidersHorizontal } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
export async function Header() {
  const user = await currentUser();
  return <header className="site-header"><div className="header-inner">
    <Link href="/" className="brand"><Image src="/panda-face.png" alt="" width={40} height={40} className="pixel-image" /><span>PANDA<span className="brand-accent">MODS</span><small>MINECRAFT JAVA</small></span></Link>
    <nav className="header-nav" aria-label="Main navigation">
      <Button asChild variant="ghost"><Link href="/"><Boxes /> <span className="nav-text">Library</span></Link></Button>
      {user?.role === "admin" && <Button asChild variant="outline"><Link href="/admin"><SlidersHorizontal /><span className="nav-text">Manage packs</span></Link></Button>}
      {user ? <form action={logoutAction}><Button variant="ghost" type="submit" aria-label="Log out"><LogOut /><span className="nav-text">Log out</span></Button></form> : <Button asChild variant="outline"><Link href="/login"><LogIn /><span>Log in</span></Link></Button>}
    </nav>
  </div></header>;
}

