import "./globals.css";
import type { Metadata } from "next";
import { Header } from "@/components/header";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mods.paarthshaunik.gay"),
  title: { default: "Panda-Mods · Your next world", template: "%s | Panda-Mods" },
  description: "Minecraft Java mod packs. Explore the mods, pick your version, and download a new adventure.",
  icons: { icon: "/dirt-block.png", apple: "/dirt-block.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark" data-scroll-behavior="smooth"><body><Header /><main>{children}</main><footer className="site-footer"><span>Panda-Mods <span className="footer-dot">◆</span> Built for your next world.</span><span>Minecraft Java Edition · Independent community project</span></footer></body></html>;
}

