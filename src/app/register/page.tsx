import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { registerAction } from "@/app/actions";
export const metadata = { title: "Create account" };
export default async function Register({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="auth-page"><div className="auth-aside"><Image src="/panda-face.png" alt="Minecraft panda face" width={96} height={96} className="pixel-image" /><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>New account.<br /><span>New adventures.</span></h1><p>Join Panda-Mods. Every mod pack is free to download, with or without an account.</p></div><Card className="auth-card"><CardContent className="detail-content"><h2>Create account</h2><p className="muted">A few details and you’re ready.</p>{error && <Alert variant="destructive"><AlertDescription>{error === "exists" ? "An account with that email already exists." : "Use a valid email and a password of at least 12 characters."}</AlertDescription></Alert>}<form action={registerAction} className="form-stack"><div><Label htmlFor="displayName">Display name</Label><Input id="displayName" name="displayName" placeholder="Your name" required minLength={2} maxLength={50} autoComplete="name" /></div><div><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" /></div><div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" placeholder="At least 12 characters" required minLength={12} autoComplete="new-password" /></div><SubmitButton>Create account</SubmitButton></form><p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p><Link href="/" className="back-link">Browse the library</Link></CardContent></Card></div>;
}

