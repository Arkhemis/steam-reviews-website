// Un point d'interrogation qui révèle une phrase d'explication au survol et au
// focus. Tout en CSS (`group-hover` / `group-focus-within`) plutôt qu'en état
// React : ces bulles vivent dans le shell serveur des pages, qui n'a pas de
// `"use client"` et n'a aucune raison d'en gagner un pour du texte statique.
type InfoHintProps = {
  // L'explication. Sert aussi de nom accessible au déclencheur, la bulle étant
  // `aria-hidden` : sans ça un lecteur d'écran annoncerait le texte deux fois.
  text: string;
};

export function InfoHint({ text }: InfoHintProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="flex size-4 cursor-help items-center justify-center rounded-full border border-white/25 text-[10px] font-bold leading-none text-neutral-400 transition-colors hover:border-white/50 hover:text-white focus-visible:border-white/50 focus-visible:text-white"
      >
        ?
      </button>
      {/* `normal-case` et `tracking-normal` : les titres de carte sont en
          capitales espacées, dont une phrase entière hériterait. */}
      <span
        data-testid="info-hint-bubble"
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-white/10 bg-black/95 px-2.5 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-neutral-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
