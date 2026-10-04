import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { loginAction } from "@/app/actions";
export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="auth-page"><div className="auth-aside"><Image src="/panda-face.png" alt="Minecraft panda face" width={96} height={96} className="pixel-image" /><span className="eyebrow">WELCOME BACK, EXPLORER</span><h1>Your next world<br /><span>is waiting.</span></h1><p>Sign in to your Panda-Mods account. The library is always open for downloads.</p></div><Card className="auth-card"><CardContent className="detail-content"><h2>Log in</h2><p className="muted">Enter your account details to continue.</p>{error && <Alert variant="destructive"><AlertDescription>That email or password didn’t match an account.</AlertDescription></Alert>}<form action={loginAction} className="form-stack"><div><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" /></div><div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" placeholder="Your password" required autoComplete="current-password" /></div><SubmitButton>Log in</SubmitButton></form><p className="auth-switch">New here? <Link href="/register">Create an account</Link></p><Link href="/" className="back-link">Browse the library</Link></CardContent></Card></div>;
}

