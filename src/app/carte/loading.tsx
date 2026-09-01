import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// The map is force-dynamic and inlines ~170 country paths, so its HTML is the
// slowest of the site to arrive. Same 1000x480 viewBox as the real SVG, so the
// legend below it doesn't jump when the map lands.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />
      <Skeleton className="mt-6 h-8 w-96" />
      <Skeleton className="mt-3 h-10 w-full max-w-md rounded-full" />
      <div className="mt-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent p-4">
        <Skeleton className="aspect-[1000/480] w-full" />
      </div>
      <div className="mt-8 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
