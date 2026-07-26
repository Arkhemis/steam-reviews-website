import { Nav } from "@/components/Nav";

type BattleStat = {
  label: string;
  left: string;
  right: string;
  leftPct: number;
};

const STATS: BattleStat[] = [
  { label: "Score positif", left: "97%", right: "72%", leftPct: 57 },
  { label: "Playtime médian", left: "62h", right: "41h", leftPct: 60 },
  { label: "Volume de reviews", left: "87.4k", right: "78.1k", leftPct: 53 },
  { label: "Taux de remboursement", left: "3.1%", right: "8.4%", leftPct: 30 },
];

export default function BattlePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Nav />

      <p className="mt-6 text-center text-sm text-neutral-400">
        Face-à-face 100% calculé à partir des données existantes — pas de vote, pas de compte. Données factices en
        attendant les marts dbt.
      </p>

      <div className="mt-6 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-[#ff5f6d] to-[#7f00ff]" />
          <h2 className="text-lg font-bold text-white">Baldur&apos;s Gate 3</h2>
          <div className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-2xl font-black text-transparent">
            97%
          </div>
        </div>
        <div className="pt-8 text-xl font-black text-neutral-500">VS</div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-[#36d1dc] to-[#5b86e5]" />
          <h2 className="text-lg font-bold text-white">Starfield</h2>
          <div className="text-2xl font-black text-neutral-300">72%</div>
        </div>
      </div>

      <div
        className="mx-auto mt-6 max-w-md rounded-lg border border-white/10 px-4 py-2 text-center text-sm"
        style={{ backgroundColor: "rgba(12,163,12,0.08)", color: "var(--status-good)" }}
      >
        🏆 Baldur&apos;s Gate 3 l&apos;emporte sur 4 critères sur 5
      </div>

      <div className="mx-auto mt-6 max-w-2xl space-y-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <div className="mb-1 text-center text-xs uppercase tracking-wide text-neutral-400">{stat.label}</div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-right text-sm font-bold text-white">{stat.left}</span>
              <div className="flex h-2.5 flex-1 overflow-hidden rounded-[4px] bg-white/5">
                <div className="h-full" style={{ width: `${stat.leftPct}%`, backgroundColor: "var(--series-1)" }} />
                <div className="h-full flex-1" style={{ backgroundColor: "var(--series-5)" }} />
              </div>
              <span className="w-16 text-sm font-bold text-white">{stat.right}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mx-auto mt-8 mb-3 max-w-2xl text-xs uppercase tracking-wide text-neutral-400">
        Meilleure review de chaque côté
      </h2>
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-1 text-xs text-neutral-400">Baldur&apos;s Gate 3 · 2 481 votes utiles</div>
          <p className="text-sm text-neutral-200">
            &quot;Chaque quête a l&apos;air d&apos;avoir été écrite par quelqu&apos;un qui l&apos;aime vraiment.&quot;
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-1 text-xs text-neutral-400">Starfield · 1 052 votes utiles</div>
          <p className="text-sm text-neutral-200">
            &quot;1000 planètes, mais j&apos;ai l&apos;impression d&apos;en avoir visité une seule 1000 fois.&quot;
          </p>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2">
        <div className="w-full max-w-sm truncate rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-400">
          steam.reviews/battle/baldurs-gate-3-vs-starfield
        </div>
        <button className="rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple px-4 py-2 text-xs font-bold text-black">
          Copier le lien
        </button>
      </div>
    </main>
  );
}
