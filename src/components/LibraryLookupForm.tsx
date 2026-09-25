// Le champ « Steam ID or profile URL ». Un simple formulaire GET vers
// `/api/library/lookup`, qui résout l'entrée et redirige : il marche sans
// JavaScript.
export function LibraryLookupForm({ defaultValue, className = "" }: { defaultValue?: string; className?: string }) {
  return (
    <form action="/api/library/lookup" method="get" className={`flex gap-2 ${className}`}>
      <input
        type="text"
        name="profile"
        required
        defaultValue={defaultValue}
        aria-label="Steam ID or profile URL"
        placeholder="Steam ID or profile URL, e.g. steamcommunity.com/id/gabelogannewell"
        className="min-w-0 flex-1 rounded-md border border-[#1e2b36] bg-[#0a0f14] px-3.5 py-2.5 text-sm text-[#eef2f4] placeholder:text-[#5f7481] focus:border-brand-blue focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-md border border-[#1e2b36] px-4 py-2.5 text-sm font-bold text-[#eef2f4] hover:border-brand-blue"
      >
        Look up
      </button>
    </form>
  );
}

/** Le bouton de connexion : un lien, la route handler fait le reste. */
export function SteamSignInButton() {
  return (
    <a
      href="/api/auth/steam/login"
      className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-brand-blue to-brand-red px-5 py-2.5 text-sm font-bold text-black"
    >
      Sign in through Steam
    </a>
  );
}
