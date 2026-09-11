import { HomeSkeleton } from "@/app/homeChrome";

// La home est force-dynamic, donc rien n'est prérendu : sans loading state le
// navigateur reste sur un document vide jusqu'à ce que Postgres réponde. On
// envoie ici la même coquille que `page.tsx` (nav, titres de section, gabarits
// de podium), pour que l'arrivée du flux RSC remplisse les trous au lieu de
// tout redessiner.
export default function Loading() {
  return <HomeSkeleton />;
}
