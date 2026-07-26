import { Nav } from "@/components/Nav";

const LANGUAGE_LEGEND = [
  { label: "Anglophone", color: "var(--series-1)" },
  { label: "Francophone", color: "var(--series-5)" },
  { label: "Sinophone / Japonophone", color: "var(--status-critical)" },
  { label: "Slave / Lusophone", color: "var(--series-3)" },
  { label: "Germanique", color: "var(--series-4)" },
];

const LANGUAGE_RANKING = [
  { language: "English", pct: 41, color: "var(--series-1)" },
  { language: "Simplified Chinese", pct: 24, color: "var(--status-critical)" },
  { language: "Russian", pct: 8, color: "var(--series-3)" },
  { language: "Portuguese-Brazilian", pct: 9, color: "var(--series-3)" },
  { language: "French", pct: 6, color: "var(--series-5)" },
  { language: "German", pct: 5, color: "var(--series-4)" },
];

export default function CartePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">
          🌍 Empreinte linguistique <span className="text-neutral-400">des reviews</span>
        </h1>
        <div className="flex gap-2">
          <span className="rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple px-3 py-1 text-xs font-bold text-black">
            Global
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">Par jeu</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl rounded-r-md border-l-2 border-brand-purple bg-white/5 px-3 py-2 text-xs text-neutral-400">
        ⚠️ Basé sur la langue déclarée de chaque review (champ Steam), pas sur une géolocalisation réelle. Le zoom
        infranational (Québec, Wallonie/Flandre, Romandie/Deutschschweiz) est limité à quelques pays connus pour être
        multilingues — données factices en attendant les marts dbt.
      </p>

      <div className="mt-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent p-4">
        <svg viewBox="0 0 1000 480" className="w-full">
          <path d="M60,90 C40,120 50,160 70,190 C60,220 90,250 120,240 C150,260 180,230 190,200 C220,190 230,150 210,120 C220,90 190,60 150,70 C120,50 80,60 60,90 Z" fill="var(--series-1)" opacity="0.45" />
          <path d="M210,270 C230,260 260,270 265,300 C280,330 275,380 255,410 C245,440 220,445 205,420 C190,390 195,340 200,310 C195,290 200,275 210,270 Z" fill="var(--series-3)" opacity="0.4" />
          <path d="M470,80 C460,100 470,120 490,125 C500,140 520,135 530,120 C545,125 555,105 545,90 C555,75 540,60 520,65 C505,55 480,60 470,80 Z" fill="var(--series-5)" opacity="0.45" />
          <path d="M470,140 C450,160 445,200 460,240 C455,280 470,330 495,360 C505,390 530,385 535,355 C550,320 545,270 530,230 C540,190 525,150 500,140 C490,130 480,132 470,140 Z" fill="var(--series-4)" opacity="0.4" />
          <path d="M550,60 C600,50 680,55 750,75 C820,80 880,100 900,130 C880,150 830,140 790,150 C740,145 680,150 630,140 C590,150 550,130 545,100 C540,80 545,65 550,60 Z" fill="var(--series-3)" opacity="0.3" />
          <path d="M630,150 C670,160 720,165 760,185 C790,200 795,230 770,245 C740,260 700,250 670,230 C645,220 625,195 620,175 C615,160 620,152 630,150 Z" fill="var(--status-critical)" opacity="0.45" />
          <path d="M800,320 C830,310 870,315 890,335 C900,350 890,370 865,375 C835,380 805,370 795,350 C790,338 793,326 800,320 Z" fill="var(--series-1)" opacity="0.3" />

          <circle cx="130" cy="150" r="5" fill="var(--series-1)" />
          <text x="140" y="153" fontSize="13" fill="var(--ink-primary)">USA · English</text>
          <circle cx="235" cy="340" r="5" fill="var(--series-3)" />
          <text x="245" y="343" fontSize="13" fill="var(--ink-primary)">Brésil · Português</text>
          <circle cx="500" cy="100" r="5" fill="var(--series-5)" />
          <text x="510" y="103" fontSize="13" fill="var(--ink-primary)">France · Français</text>
          <circle cx="710" cy="205" r="5" fill="var(--status-critical)" />
          <text x="720" y="208" fontSize="13" fill="var(--ink-primary)">Chine · 简体中文</text>
        </svg>
        <p className="mt-1 text-center text-[0.65rem] text-neutral-500">
          Silhouettes simplifiées à titre d&apos;illustration — pas les tracés géographiques finaux.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-neutral-300">
        {LANGUAGE_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">
        Répartition détaillée (top langues, global)
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LANGUAGE_RANKING.map((row) => (
          <div key={row.language} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
            <span className="flex-1 text-neutral-300">{row.language}</span>
            <span className="font-bold" style={{ color: row.color }}>
              {row.pct}%
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs uppercase tracking-wide text-neutral-400">
        Zoom : pays multilingues (découpage infranational, illustratif)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-2 text-sm font-semibold text-white">🇨🇦 Canada</h3>
          <div className="space-y-1 text-xs text-neutral-300">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-1)" }} /> Reste du Canada —
              English
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-5)" }} /> Québec — Français
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-2 text-sm font-semibold text-white">🇧🇪 Belgique</h3>
          <div className="space-y-1 text-xs text-neutral-300">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-1)" }} /> Flandre — Nederlands
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-5)" }} /> Wallonie — Français
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-4)" }} /> Bruxelles — mixte
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-2 text-sm font-semibold text-white">🇨🇭 Suisse</h3>
          <div className="space-y-1 text-xs text-neutral-300">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-5)" }} /> Romandie — Français
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-4)" }} /> Deutschschweiz —
              Deutsch
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--series-3)" }} /> Ticino — Italiano
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
