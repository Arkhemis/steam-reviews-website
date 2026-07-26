type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xl font-extrabold text-white">{value}</div>
      <div className="text-[0.65rem] uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}
