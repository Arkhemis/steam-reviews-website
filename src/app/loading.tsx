import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// Every route here is either force-dynamic or reads searchParams, so none of
// them can be prerendered — without a loading state the browser sits on a blank
// document until Postgres answers. This ships the nav and the page frame
// immediately, and covers any segment that doesn't define its own.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Nav />
      <div className="mt-12 flex flex-col items-center gap-4">
        <Skeleton className="h-6 w-72 rounded-full" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-10 w-2/3 max-w-lg" />
      </div>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((column) => (
          <div key={column} className="space-y-2">
            <Skeleton className="mb-3 h-3 w-48" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
