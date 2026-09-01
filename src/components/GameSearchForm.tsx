type GameSearchFormProps = {
  placeholder: string;
  defaultValue?: string;
  className?: string;
};

export function GameSearchForm({ placeholder, defaultValue, className }: GameSearchFormProps) {
  return (
    <form action="/games" method="GET" className={`relative ${className ?? "max-w-[420px]"}`}>
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-full border border-[#24333f] bg-[#111a21] px-4 py-3 pl-10 text-sm text-[#eef2f4] placeholder:text-[#7d919c] focus:outline-none"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7d919c"
        strokeWidth={1.8}
        className="absolute top-3.5 left-4 h-4 w-4"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" />
      </svg>
    </form>
  );
}
