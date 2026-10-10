import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans, Mukta } from "next/font/google";
import "./globals.css";
import KidharProvider from "@/components/KidharProvider";
import Backdrop from "@/components/Backdrop";
import NavBar from "@/components/NavBar";

const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700", "800"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const deva = Mukta({ variable: "--font-devanagari", subsets: ["devanagari", "latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Kidhar? | Emergency Locator for Mumbai",
  description: "Turn a landmark-style Hinglish emergency call into a map pin and the nearest help.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} ${deva.variable} h-full antialiased`}>
      <body className="relative min-h-full">
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
