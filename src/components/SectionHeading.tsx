// Le bandeau numéroté qui ouvre chaque section de la home. Vit ici plutôt que
// dans `page.tsx` parce que le loading state en rend exactement les mêmes :
// c'est du texte statique, il n'a aucune raison d'attendre Postgres.
export function SectionHeading({ number, title, note, action }: {
  number: string;
  title: string;
  note: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-brand-blue">{number}</span>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-[26px]">{title}</h2>
        <span className="text-sm text-[#7d919c]">{note}</span>
      </div>
      {action}
    </div>
  );
}
