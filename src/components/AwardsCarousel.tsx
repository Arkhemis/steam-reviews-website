"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { BBCodeText } from "@/components/BBCodeText";
import { InfoHint } from "@/components/InfoHint";
import type { AwardSlide } from "@/lib/homeAwards";

// Le carrousel de récompenses qui ouvre la home, à la place de l'ancien héros.
// Il ne fait que rendre et faire défiler : la page serveur a déjà lu, choisi et
// rédigé chaque diapositive (cf. `@/lib/homeAwards`).
//
// Les puces sont de vrais onglets (tablist / tab / tabpanel, flèches, Début,
// Fin) ; le défilement automatique s'arrête au survol, tant que le focus est
// dedans, quand l'onglet du navigateur est masqué, et ne démarre jamais pour
// qui a demandé moins d'animations.

export const AUTOPLAY_MS = 8000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

// Côté serveur, on répond « mouvement réduit » et « page masquée » : le rendu
// SSR et l'hydratation n'embarquent donc ni minuterie ni barre de progression,
// qui n'apparaissent qu'une fois le navigateur interrogé.
const onServer = () => true;

// La jaquette du mart est servie en `t_cover_big` (264 x 374) : juste assez
// pour une vignette, trop peu pour couvrir le bandeau quand Steam n'a pas
// d'illustration. IGDB rend la même image en retina quand on suffixe la
// taille ; une URL d'une autre forme passe telle quelle.
function retinaCover(url: string): string {
  return url.replace("/t_cover_big/", "/t_cover_big_2x/");
}

function Backdrop({ slide, preload }: { slide: AwardSlide; preload: boolean }) {
  // L'illustration Steam fait 1920 x 620, soit presque exactement le rapport
  // du bandeau : elle le couvre en entier, nette et sans recadrage notable.
  // La jaquette ne la remplace pas — 2:3 étirée sur un bandeau trois fois plus
  // large que haut, il n'en resterait qu'une bande centrale sans motif — elle
  // sert de repli flouté, pour la couleur seulement.
  const backdrop = slide.art ?? (slide.coverUrl && retinaCover(slide.coverUrl));
  if (!backdrop) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Image
        src={backdrop}
        alt=""
        fill
        sizes="100vw"
        preload={preload}
        className={
          slide.art ? "object-cover object-[70%_center]" : "scale-125 object-cover object-center opacity-45 blur-3xl"
        }
      />
      {/* Fondu horizontal, à partir de `lg` : le texte repose sur un aplat
          opaque, l'illustration se découvre entièrement sur le flanc droit.
          Les arrêts sont serrés à gauche pour que la colonne de texte ne
          mange pas le sujet, qui est au centre de l'image. */}
      <span className="absolute inset-0 hidden bg-[linear-gradient(90deg,#0c1116_0%,#0c1116_28%,rgba(12,17,22,0.9)_46%,rgba(12,17,22,0.5)_64%,rgba(12,17,22,0.1)_80%,transparent_92%)] lg:block" />
      {/* En colonne, le texte passe sur toute la largeur : le fondu devient
          vertical, sinon il n'y a plus un pixel de fond lisible. */}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,17,22,0.55)_0%,rgba(12,17,22,0.9)_46%,#0c1116_88%)] lg:hidden" />
      {/* Le bas se referme sur le fond de page, sans couture avec la rangée
          de puces qui suit immédiatement. */}
      <span className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent_0%,#0c1116_100%)]" />
    </div>
  );
}

function Figure({ slide, size }: { slide: AwardSlide; size: "lg" | "md" }) {
  return (
    <span className={`leading-none ${size === "lg" ? "text-[44px]" : "text-[34px]"}`} style={{ color: slide.figureColor }}>
      {slide.figure}
    </span>
  );
}

function Kicker({ slide }: { slide: AwardSlide }) {
  // Le kicker annonce la récompense et sa fenêtre ; la bulle dit comment on
  // l'attribue, parce qu'un titre ne trahit ni le seuil de volume ni le fait
  // que le palmarès ne juge que les avis écrits dans la fenêtre.
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-brand-blue uppercase">
      <span>{slide.range ? `${slide.label} · ${slide.range}` : slide.label}</span>
      <InfoHint text={slide.hint} />
    </div>
  );
}

function ReadTheReviews({ appId }: { appId: number }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      <Link href={`/games/${appId}`} className="rounded-full bg-brand-blue px-[18px] py-2.5 text-sm font-bold text-[#0c1116]">
        Read the reviews
      </Link>
    </div>
  );
}

// La première diapositive porte le titre de la page : c'est elle que rend le
// serveur, et le gagnant de la semaine reste le sujet de la home.
function GameSlide({ slide, Heading }: { slide: AwardSlide; Heading: "h1" | "h2" }) {
  return (
    <>
      <Kicker slide={slide} />
      <Heading className="mt-3 mb-0 max-w-[16ch] text-4xl leading-[0.95] font-extrabold tracking-tight text-balance drop-shadow-[0_2px_24px_rgba(12,17,22,0.9)] sm:text-5xl lg:text-[58px]">
        {slide.name}
      </Heading>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-[18px] gap-y-2 font-mono">
        <Figure slide={slide} size="lg" />
        {slide.figureLabel && <span className="text-sm text-[#cfdae1]">{slide.figureLabel}</span>}
        <span className="text-xs text-[#9fb2bd]">{slide.meta}</span>
      </div>
      {slide.quote && (
        <blockquote className="mt-[18px] line-clamp-4 max-w-[46ch] border-l-[3px] border-brand-blue pl-4 text-[19px] leading-relaxed text-[#dfe7eb]">
          <BBCodeText text={slide.quote} />
        </blockquote>
      )}
      <ReadTheReviews appId={slide.appId} />
    </>
  );
}

// Une review primée : la citation est le sujet, le jeu ne vient qu'après.
function ReviewSlide({ slide, Heading }: { slide: AwardSlide; Heading: "h1" | "h2" }) {
  return (
    <>
      <Kicker slide={slide} />
      {slide.quote && (
        <blockquote className="mt-4 line-clamp-6 max-w-[40ch] border-l-[3px] border-brand-blue pl-4 text-[22px] leading-snug font-semibold text-[#eef2f4] drop-shadow-[0_2px_24px_rgba(12,17,22,0.9)] sm:text-[26px]">
          <BBCodeText text={slide.quote} />
        </blockquote>
      )}
      <Heading className="mt-5 mb-0 text-2xl leading-tight font-extrabold tracking-tight text-balance">{slide.name}</Heading>
      <div className="mt-1.5 font-mono text-xs text-[#9fb2bd]">{slide.meta}</div>
      <div className="mt-4 flex items-baseline gap-3 font-mono">
        <Figure slide={slide} size="md" />
        {slide.figureLabel && <span className="text-sm text-[#cfdae1]">{slide.figureLabel}</span>}
      </div>
      <ReadTheReviews appId={slide.appId} />
    </>
  );
}

export function AwardsCarousel({ slides }: { slides: AwardSlide[] }) {
  const baseId = useId();
  // `lap` compte les changements de diapositive, défilement ou clic : c'est
  // lui qui date le temps écoulé, si bien qu'une puce choisie relance toujours
  // huit secondes pleines, même quand on revient sur la diapositive d'avant.
  const [{ index: active, lap }, setPosition] = useState({ index: 0, lap: 0 });
  // Les diapositives déjà montrées gardent leur illustration : revenir en
  // arrière ne doit pas recharger une image.
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, onServer);
  const pageHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, onServer);

  const count = slides.length;
  const autoplay = count > 1 && !reducedMotion;
  const paused = hovered || focused || pageHidden;
  const next = (active + 1) % Math.max(count, 1);

  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // Temps déjà écoulé sur la diapositive courante, pour qu'une pause reprenne
  // là où elle s'était arrêtée plutôt que de relancer huit secondes pleines.
  const elapsed = useRef({ lap: 0, ms: 0 });

  function goTo(index: number) {
    setPosition((position) => ({ index, lap: position.lap + 1 }));
    setVisited((seen) => (seen.has(index) ? seen : new Set(seen).add(index)));
  }

  useEffect(() => {
    if (!autoplay || paused) return;

    const already = elapsed.current.lap === lap ? elapsed.current.ms : 0;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      const target = (active + 1) % count;
      setPosition({ index: target, lap: lap + 1 });
      setVisited((seen) => (seen.has(target) ? seen : new Set(seen).add(target)));
    }, Math.max(AUTOPLAY_MS - already, 0));

    return () => {
      window.clearTimeout(timer);
      elapsed.current = { lap, ms: already + (Date.now() - startedAt) };
    };
  }, [autoplay, paused, active, lap, count]);

  // Sur mobile, la rangée de puces déborde : on fait glisser la puce active
  // dans le champ. Seulement la rangée — `scrollIntoView` ferait aussi défiler
  // la page, et arracherait le lecteur à ce qu'il lit plus bas.
  useEffect(() => {
    const list = listRef.current;
    const tab = tabsRef.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth || typeof list.scrollTo !== "function") return;
    list.scrollTo({
      left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [active, reducedMotion]);

  if (count === 0) return null;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const target = {
      ArrowRight: (active + 1) % count,
      ArrowLeft: (active - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (target === undefined) return;

    event.preventDefault();
    goTo(target);
    tabsRef.current[target]?.focus();
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }

  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (i: number) => `${baseId}-panel-${i}`;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Awards"
      className="relative flex flex-col bg-brand-bg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      {/* Les puces précèdent les panneaux dans le DOM, comme le veut le motif
          d'onglets, mais se rangent sous le bandeau à l'écran. */}
      <div className="order-last">
        <div
          ref={listRef}
          role="tablist"
          aria-label="Choose an award"
          className="relative mx-auto flex max-w-[1320px] gap-2 overflow-x-auto px-6 pb-6 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => {
            const isActive = i === active;
            return (
              <button
                key={slide.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-controls={panelId(i)}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => goTo(i)}
                onKeyDown={onTabKeyDown}
                className={`relative shrink-0 overflow-hidden rounded-full border px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] whitespace-nowrap uppercase transition-colors ${
                  isActive
                    ? "border-brand-blue bg-brand-blue/10 text-[#eef2f4]"
                    : "border-[#24333f] text-[#7d919c] hover:border-[#3a4d5c] hover:text-[#cfdae1]"
                }`}
              >
                {slide.chip}
                {isActive && autoplay && (
                  <span
                    key={lap}
                    data-testid="award-progress"
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-brand-blue"
                    style={{
                      animation: `award-progress ${AUTOPLAY_MS}ms linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Les panneaux s'empilent dans une seule cellule de grille : le
          bandeau prend la hauteur du plus grand, et le passage d'une
          récompense à l'autre ne fait pas sauter la page. */}
      <div className="grid">
        {slides.map((slide, i) => {
          const isActive = i === active;
          const Heading = i === 0 ? "h1" : "h2";
          return (
            <div
              key={slide.id}
              role="tabpanel"
              id={panelId(i)}
              aria-labelledby={tabId(i)}
              aria-hidden={!isActive}
              inert={!isActive}
              className={`relative col-start-1 row-start-1 overflow-hidden transition-opacity duration-500 motion-reduce:transition-none lg:min-h-[460px] ${
                isActive ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {/* Seule la première illustration est préchargée : c'est elle
                  que le serveur rend visible, donc elle qui fait le LCP. Les
                  autres attendent d'être montrées — ou d'être la suivante,
                  pour que la bascule n'ouvre pas sur un fond vide. */}
              {(visited.has(i) || (autoplay && i === next)) && <Backdrop slide={slide} preload={i === 0} />}
              <div className="relative mx-auto flex h-full max-w-[1320px] items-center px-6 pt-12 pb-8 sm:px-8 lg:pt-16">
                <div className="w-full min-w-0 lg:max-w-[52%]">
                  {slide.layout === "review" ? (
                    <ReviewSlide slide={slide} Heading={Heading} />
                  ) : (
                    <GameSlide slide={slide} Heading={Heading} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
