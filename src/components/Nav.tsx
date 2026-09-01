import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center justify-between py-3">
      <Link
        href="/"
        className="bg-gradient-to-r from-brand-blue to-brand-red bg-clip-text text-lg font-black text-transparent"
      >
        steam.reviews
      </Link>
      <div className="flex items-center gap-5 text-sm text-neutral-300">
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
