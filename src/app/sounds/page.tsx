import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { SoundsBoard } from "@/components/SoundsBoard";

// Page temporaire : écouter toutes les voix du battle pour trier les timbres.
// Ni indexée, ni dans le sitemap, ni dans la nav.
export const metadata: Metadata = {
  title: "Duel voices",
  robots: { index: false, follow: false },
};

export default function SoundsPage() {
  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" />
      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1100px]">
          <SoundsBoard />
        </div>
      </div>
    </div>
  );
}
