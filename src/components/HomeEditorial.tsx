import Image from "next/image";
import Link from "next/link";
import { AwardsCarousel } from "@/components/AwardsCarousel";
import { verdictColor } from "@/components/GameCoverTile";
import { Nav } from "@/components/Nav";
import type { AwardSlide } from "@/lib/homeAwards";

// Home éditoriale : un carrousel de récompenses tient lieu de héros — le
// meilleur jeu de la semaine en tête —, les dauphins suivent en rangs, et il
// n'y a ni tableau ni numéro de section. Le composant ne fait que rendre :
// toutes les requêtes vivent dans `page.tsx`, qui lui passe des chaînes déjà
// formatées.

const enCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const enFull = new Intl.NumberFormat("en-US");

export type PodiumGame = {
  appId: number;
  name: string;
  coverUrl: string | null;
  /** Part d'avis positifs, de 0 à 100. */
  pct: number;
  /** Ligne de contexte déjà rédigée, e.g. « 12,043 reviews this week ». */
  meta: string;
};

export type HomeData = {
  /** Les récompenses du carrousel, dans l'ordre, celles sans lauréat en moins. */
  awards: AwardSlide[];
  /** Places 2 à 5 du podium dont le n°1 ouvre le carrousel. */
  runnersUp: PodiumGame[];
  sentiment: number[]; // 12 points, part d'avis positifs (0..1)
  volume: number[]; // 31 points, volume d'avis / jour
  /** `reviews` : avis chargés en base, pas le total déclaré par Steam. */
  totals: { reviews: number; games: number; languages: number; weekReviews: number; lists: number };
};

// Courbe lissée (Bézier horizontale) normalisée sur les valeurs reçues.
function curve(vals: number[], w: number, h: number, pad: number) {
  const n = vals.length - 1;
  const lo = Math.min(...vals) - 0.02;
  const hi = Math.max(...vals) + 0.02;
  const pts = vals.map((v, i) => ({
    x: (i * w) / n,
    y: pad + (h - pad * 2) * (1 - (v - lo) / (hi - lo)),
  }));
  let line = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[i - 1];
    const mx = (q.x + p.x) / 2;
    line += ` C${mx.toFixed(1)},${q.y.toFixed(1)} ${mx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return { line, fill: `${line} L${w},${h} L0,${h} Z` };
}

// Le liseré coloré en haut de chaque jaquette rejoue le verdict : c'est le seul
// endroit où le score apparaît sur les vignettes les plus petites.
function Cover({ game, sizes, radius = "rounded-[3px]" }: { game: PodiumGame; sizes: string; radius?: string }) {
  return (
    <span className={`relative block aspect-[2/3] overflow-hidden bg-white/5 ${radius}`}>
      {game.coverUrl && <Image src={game.coverUrl} alt="" fill sizes={sizes} className="object-cover" />}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: verdictColor(game.pct) }} />
    </span>
  );
}

// La taille du corpus, annoncée avant tout le reste : c'est le premier
// argument du site, et il n'apparaissait qu'en pied de page, dans une note de
// section. Une seule ligne, à fond perdu, entre la nav et le carrousel.
//
// Le compteur dit « collected » parce qu'il compte les avis réellement en
// base (cf. `getSiteStats`), pas ceux que Steam déclare pour les mêmes jeux.
export function ScaleBand({ totals }: { totals: Pick<HomeData["totals"], "reviews" | "games" | "languages"> }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[#16202a] bg-[#0a0f14] px-6 py-2.5 sm:px-8">
      <span className="font-mono text-[17px] leading-none text-[#eef2f4]">{enFull.format(totals.reviews)}</span>
      <span className="font-mono text-[10px] tracking-[0.12em] text-[#7d919c] uppercase">
        steam reviews collected · {enFull.format(totals.games)} games · {totals.languages} languages
      </span>
    </div>
  );
}

// Le bandeau de pouls : les deux graphes et deux compteurs, en quatre cellules.
export function PulseBand({ sentiment, volume, totals }: Pick<HomeData, "sentiment" | "volume" | "totals">) {
  const c = sentiment.length > 1 ? curve(sentiment, 300, 54, 6) : null;
  const peak = Math.max(...volume, 1);

  return (
    <div className="grid grid-cols-2 border-y border-[#1a2530] lg:grid-cols-4">
      <div className="border-r border-[#16202a] px-5 py-4">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">catalogue sentiment · 12 mo</div>
        {c && (
          <svg
            viewBox="0 0 300 54"
            preserveAspectRatio="none"
            className="mt-2 block h-[54px] w-full"
            role="img"
            aria-label={`Share of positive reviews across the catalogue over the last 12 months, from ${Math.round(sentiment[0] * 100)}% in the earliest month to ${Math.round(sentiment[sentiment.length - 1] * 100)}% in the latest`}
          >
            <path d={c.fill} fill="#e8622a" fillOpacity={0.15} />
            <path d={c.line} fill="none" stroke="#e8622a" strokeWidth={2} />
          </svg>
        )}
      </div>
      <div className="border-r border-[#16202a] px-5 py-4">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">reviews / day · 31d</div>
        <div
          className="mt-2 flex h-[54px] items-end gap-[2px]"
          role="img"
          aria-label={`Reviews per day over the last 31 days, peaking at ${enFull.format(peak)}`}
        >
          {volume.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{ height: `${(v / peak) * 100}%`, backgroundColor: v / peak >= 0.92 ? "#e8622a" : "#24414f" }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-between border-r border-[#16202a] px-5 py-4">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">this week</div>
        <div className="font-mono">
          <div className="text-[26px]">{enCompact.format(totals.weekReviews)}</div>
          <div className="text-[10px] text-[#7d919c]">reviews read</div>
        </div>
      </div>
      <div className="flex flex-col justify-between px-5 py-4">
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">catalogue</div>
        <div className="font-mono">
          <div className="text-[26px]">{enFull.format(totals.games)}</div>
          <div className="text-[10px] text-[#7d919c]">games · {totals.languages} languages</div>
        </div>
      </div>
    </div>
  );
}

export function SectionHead({ title, note, action }: { title: string; note: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="m-0 text-[26px] font-extrabold tracking-tight">{title}</h2>
        <span className="text-sm text-[#7d919c]">{note}</span>
      </div>
      {action}
    </div>
  );
}

function RunnerUp({ game, rank }: { game: PodiumGame; rank: number }) {
  return (
    <Link
      href={`/games/${game.appId}`}
      className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3.5 rounded-[5px] border border-[#1e2b36] p-3.5 transition-colors hover:border-brand-blue"
    >
      <Cover game={game} sizes="70px" />
      <span className="min-w-0">
        <span className="block font-mono text-[10px] text-[#5f7481]">{String(rank).padStart(2, "0")}</span>
        <span className="mt-[3px] block text-[15px] leading-tight font-bold">{game.name}</span>
        <span className="mt-1.5 block font-mono text-lg" style={{ color: verdictColor(game.pct) }}>
          {Math.round(game.pct)}%
        </span>
        <span className="block font-mono text-[10px] text-[#7d919c]">{game.meta}</span>
      </span>
    </Link>
  );
}

/** Une porte de sortie : un outil du site, et le chiffre qui donne envie de l'ouvrir. */
export type Door = {
  kicker: string;
  title: string;
  blurb: string;
  stat: string;
  statLabel: string;
  href: string;
};

// Les portes d'entrée vers les outils du site, en remplacement du duel d'avis.
// La home les pose sur le catalogue entier, la fiche de jeu sur le jeu qu'elle
// vient de raconter : même bloc, mêmes cartes, seuls les textes changent.
export function DigDeeper({ title = "Dig deeper", note, doors }: { title?: string; note: string; doors: Door[] }) {
  return (
    <div className="border-t border-[#1a2530] bg-[#0e141a] px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead title={title} note={note} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {doors.map((d) => (
            <Link
              key={d.title}
              href={d.href}
              className="block rounded-md border border-[#1e2b36] bg-[#0c1116] p-[22px] transition-colors hover:border-brand-blue"
            >
              <span className="block font-mono text-[10px] tracking-[0.14em] text-brand-blue uppercase">{d.kicker}</span>
              <span className="mt-2 block text-[22px] font-extrabold tracking-tight">{d.title}</span>
              <span className="mt-2 block text-sm leading-normal text-[#9fb2bd]">{d.blurb}</span>
              <span className="mt-4 flex items-baseline gap-2 font-mono">
                <span className="text-2xl text-[#eef2f4]">{d.stat}</span>
                <span className="text-[10px] tracking-[0.1em] text-[#7d919c] uppercase">{d.statLabel}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function homeDoors(totals: HomeData["totals"]): Door[] {
  return [
    {
      kicker: "compare",
      title: "Battle",
      blurb: "Put two games head to head — score, playtime, refunds, and what each camp actually wrote.",
      stat: "1v1",
      statLabel: "side by side",
      href: "/battle",
    },
    {
      kicker: "by language",
      title: "Language map",
      blurb: "The same game scores differently in Chinese, German or French. See where it lands.",
      stat: String(totals.languages),
      statLabel: "languages",
      href: "/map",
    },
    {
      kicker: "browse",
      title: "All lists",
      blurb: "Most reviewed, best and worst rated, trending, most polarised — every ranking in one place.",
      stat: String(totals.lists),
      statLabel: "rankings",
      href: "/charts",
    },
  ];
}

export function HomeEditorial({ data }: { data: HomeData }) {
  const { runnersUp } = data;

  return (
    <div className="min-h-screen bg-[#0c1116] text-[#eef2f4]">
      <Nav variant="banded" searchPlaceholder={`Search ${enFull.format(data.totals.games)} games…`} />
      <ScaleBand totals={data.totals} />

      <AwardsCarousel slides={data.awards} />
      <PulseBand sentiment={data.sentiment} volume={data.volume} totals={data.totals} />

      {runnersUp.length > 0 && (
        <div className="px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-[1320px]">
            <SectionHead
              title="Runners-up"
              note="the rest of the podium"
              action={
                <Link href="/charts" className="font-mono text-[10px] tracking-[0.12em] text-brand-blue uppercase">
                  full ranking →
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {runnersUp.map((game, i) => (
                <RunnerUp key={game.appId} game={game} rank={i + 2} />
              ))}
            </div>
          </div>
        </div>
      )}

      <DigDeeper
        note={`three ways into the same ${enCompact.format(data.totals.reviews)} reviews`}
        doors={homeDoors(data.totals)}
      />
    </div>
  );
}
