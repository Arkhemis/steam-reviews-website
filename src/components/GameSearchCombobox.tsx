"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MIN_QUERY_LENGTH, type GameSearchHit } from "@/lib/gameSearch";

const DEBOUNCE_MS = 250;

type GameSearchComboboxProps = {
  placeholder: string;
  ariaLabel: string;
  /** Jeu retenu dans la liste de suggestions. */
  onSelect: (hit: GameSearchHit) => void;
  /** Entrée validée sans suggestion active — facultatif : sinon Entrée ne fait rien. */
  onSubmitTerm?: (term: string) => void;
  /** Le parent navigue : on garde le « … » allumé jusqu'à l'arrivée de la page. */
  busy?: boolean;
  defaultValue?: string;
  containerClassName?: string;
  inputClassName?: string;
  /** Décoration positionnée en absolu dans le champ (loupe, badge…). */
  adornment?: ReactNode;
};

function coverStyle(coverUrl: string | null) {
  return coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined;
}

/**
 * Champ de recherche typeahead partagé par la carte et le catalogue : le
 * parent ne décide que de ce qui se passe à la sélection.
 */
export function GameSearchCombobox({
  placeholder,
  ariaLabel,
  onSelect,
  onSubmitTerm,
  busy = false,
  defaultValue = "",
  containerClassName,
  inputClassName,
  adornment,
}: GameSearchComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(defaultValue);
  // Les résultats portent la requête qui les a produits : on en déduit l'état
  // de chargement, plutôt que de le stocker à part et de risquer qu'une
  // réponse lente vienne repeindre la liste d'une frappe déjà remplacée.
  const [result, setResult] = useState<{ term: string; hits: GameSearchHit[] }>({ term: "", hits: [] });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const term = query.trim();
  const hits = result.term === term ? result.hits : [];
  const loading = term.length >= MIN_QUERY_LENGTH && result.term !== term;

  // Une frappe = un timer + une requête, tous deux annulés par la frappe
  // suivante.
  useEffect(() => {
    if (term.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/games/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { games?: GameSearchHit[] };
        setResult({ term, hits: payload.games ?? [] });
        setActiveIndex(0);
      } catch {
        // Requête annulée par la frappe suivante, ou réseau KO : la liste
        // reste en « Recherche… » plutôt que de clignoter une erreur à
        // chaque touche.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  function choose(hit: GameSearchHit) {
    setOpen(false);
    setQuery("");
    onSelect(hit);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (open && hits.length > 0) choose(hits[activeIndex]);
      else if (term.length > 0) onSubmitTerm?.(term);
      return;
    }

    if (!open || hits.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length);
    }
  }

  const showList = open && term.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className={`relative ${containerClassName ?? ""}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits.length > 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />

      {adornment}

      {(loading || busy) && (
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] text-neutral-500">…</span>
      )}

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Résultats"
          className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-brand-bg p-1 shadow-xl shadow-black/60"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-neutral-500">
              {loading ? "Recherche…" : `Aucun jeu ne correspond à « ${term} ».`}
            </li>
          ) : (
            hits.map((hit, index) => (
              <li
                key={hit.appId}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(hit)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                  index === activeIndex ? "bg-white/10" : ""
                }`}
              >
                <span
                  className="h-8 w-8 flex-shrink-0 rounded-md bg-white/10 bg-cover bg-center"
                  style={coverStyle(hit.coverUrl)}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{hit.name}</span>
                  <span className="block text-[0.65rem] text-neutral-500">
                    {hit.totalReviews.toLocaleString("fr-FR")} reviews · {Math.round(hit.pctPositive * 100)}% positif
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
