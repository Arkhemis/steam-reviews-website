import { getRandomRivalry } from "@/lib/data/gameData";

// Tire la paire du bouton « Random rivalry » : un nouveau tirage à chaque appel,
// donc jamais prérendu.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rivalry = await getRandomRivalry();
  if (!rivalry) return Response.json({ error: "no rivalry" }, { status: 503 });
  return Response.json(rivalry);
}
