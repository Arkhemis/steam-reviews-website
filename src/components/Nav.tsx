import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center justify-between py-3">
      <Link
        href="/"
        className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-lg font-black text-transparent"
      >
        steam.reviews
      </Link>
      <div className="flex items-center gap-5 text-sm text-neutral-300">
        <Link href="/games">Jeux</Link>
        <Link href="/classements">Classements</Link>
        <Link href="/carte">Carte</Link>
        <Link
          href="/battle"
          className="rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple px-3 py-1 font-bold text-black"
        >
          Battle
        </Link>
      </div>
    </nav>
  );
}
