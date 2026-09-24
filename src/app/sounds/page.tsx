import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { VoiceLab } from "@/components/VoiceLab";

// Banc d'écoute des voix du battle : hauteur, effets et vitesse, réglés à
// l'oreille avant de passer dans les presets du duel.

export const metadata: Metadata = {
  title: "Voice lab",
  robots: { index: false, follow: false },
};

export default function SoundsPage() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Voice lab</h1>
        <p className="mt-1 text-sm text-[#9fb2bd]">
          The duel&apos;s voices: Google Translate&apos;s speech, re-pitched and run through an effect in your browser.
          Tweak, listen, and save the combinations worth keeping.
        </p>
        <VoiceLab />
      </main>
    </div>
  );
}
