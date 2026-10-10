import type { Metadata } from "next";
import { Hind, Overpass, Overpass_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import KidharProvider from "@/components/KidharProvider";
import Backdrop from "@/components/Backdrop";
import NavBar from "@/components/NavBar";

const display = Overpass({ variable: "--font-overpass", subsets: ["latin"] });
const body = Public_Sans({ variable: "--font-publicsans", subsets: ["latin"] });
const mono = Overpass_Mono({ variable: "--font-overpassmono", subsets: ["latin"] });
const deva = Hind({ variable: "--font-devanagari", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Kidhar? | Emergency Locator for Mumbai",
  description: "Turn a landmark-style Hinglish emergency call into a map pin and the nearest help.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} ${deva.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="relative min-h-full">
        <KidharProvider>
          <Backdrop />
          <div className="relative z-10 flex min-h-screen flex-col">
            <NavBar />
            <div className="flex-1">{children}</div>
          </div>
        </KidharProvider>
      </body>
    </html>
  );
}
