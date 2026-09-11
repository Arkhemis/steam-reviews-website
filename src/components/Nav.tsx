import Link from "next/link";
import { GameSearchBox } from "@/components/GameSearchBox";

// Deux gabarits pour la même barre :
// - `inline` : posée dans le conteneur centré d'une page de contenu.
// - `banded` : pleine largeur, soulignée, telle que la veut la home
//   éditoriale, dont le héros et le bandeau de pouls sont eux aussi à fond
//   perdu. Le contenu de la barre, lui, ne change pas d'un gabarit à l'autre.
const LAYOUTS = {
  inline: "py-3",
  banded: "border-b border-[#16202a] px-6 py-3.5 sm:px-8",
} as const;

type NavProps = {
  variant?: keyof typeof LAYOUTS;
  /** La home annonce la taille du catalogue dans le champ ; ailleurs, générique. */
  searchPlaceholder?: string;
};

export function Nav({ variant = "inline", searchPlaceholder = "Search a game…" }: NavProps) {
  return (
    <nav className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 ${LAYOUTS[variant]}`}>
      {/* Sur un téléphone, marque et liens ne tiennent pas sur la même ligne :
          les liens ne se coupent pas, et rien ne les empêcherait de passer
          sous la marque. D'où `basis-full` sous `sm`, qui donne sa ligne à la
          marque et renvoie les liens à la suivante, plutôt que de laisser les
          deux groupes se chevaucher. */}
      <div className="flex min-w-0 basis-full items-center gap-4 sm:flex-1 sm:basis-auto">
        <Link
          href="/"
          className="bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-lg font-black whitespace-nowrap text-transparent"
        >
          steam.reviews
        </Link>
        <GameSearchBox placeholder={searchPlaceholder} size="sm" className="w-full max-w-[280px]" />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm whitespace-nowrap text-neutral-300">
        <Link href="/games">Games</Link>
        <Link href="/charts">Charts</Link>
        <Link href="/map">Language map</Link>
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
