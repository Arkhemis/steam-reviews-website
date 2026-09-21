import { InfoHint } from "@/components/InfoHint";

type StatTileProps = {
  label: string;
  value: string;
  /** Ce que le chiffre compte vraiment, en trois mots sous la valeur. */
  note?: string;
  /** La définition complète, derrière le (?) à côté du titre. */
  hint?: string;
  className?: string;
};

// Une cellule du bandeau de KPI de la fiche de jeu : titre en capitales
// espacées en haut, chiffre en bas, et la cellule s'étire à la hauteur de sa
// voisine — celle qui porte les barres de volume. D'où le `justify-between`
// plutôt qu'une hauteur fixe.
export function StatTile({ label, value, note, hint, className = "" }: StatTileProps) {
  return (
    <div className={`flex flex-col justify-between gap-5 px-5 py-4 ${className}`}>
      <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.12em] text-[#7d919c] uppercase">
        {label}
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="font-mono">
        <div className="text-[26px] leading-none text-[#eef2f4]">{value}</div>
        {note && <div className="mt-1.5 text-[10px] text-[#7d919c]">{note}</div>}
      </div>
    </div>
  );
}
