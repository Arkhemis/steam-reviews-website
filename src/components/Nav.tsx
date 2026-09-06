import Link from "next/link";
import { GameSearchBox } from "@/components/GameSearchBox";

export function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link
          href="/"
          className="bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-lg font-black whitespace-nowrap text-transparent"
        >
          steam.reviews
        </Link>
        {/* Sous `sm`, la nav n'a plus la largeur pour les deux : les liens priment. */}
        <GameSearchBox
          placeholder="Chercher un jeu…"
          size="sm"
          className="hidden w-full max-w-[280px] sm:block"
        />
      </div>
      <div className="flex items-center gap-5 text-sm whitespace-nowrap text-neutral-300">
        <Link href="/games">Games</Link>
        <Link href="/classements">Charts</Link>
        <Link href="/carte">Language map</Link>
        <Link
          href="/battle"
          className="rounded-full bg-gradient-to-r from-brand-blue to-brand-red px-3 py-1 font-bold text-black"
        >
          Battle
        </Link>
      </div>
    </nav>
  );
}
