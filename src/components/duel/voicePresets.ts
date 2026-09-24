import type { VoiceFx } from "@/components/duel/voiceFx";

// Les timbres du battle. Le joueur garde sa voix normale ; l'ordinateur change
// de timbre à chaque réplique. La vitesse n'en fait pas partie : elle suit la
// longueur de la réplique (voir `autoSpeed`). Réglés à l'oreille sur /sounds.

export type VoicePreset = VoiceFx & { label: string; volume?: number };

/** Google parle un peu lentement : même une réplique courte est lue à cette vitesse… */
export const BASE_SPEED = 1.15;
/** …tant qu'elle tient en autant de secondes… */
export const MAX_NORMAL_S = 4;
/** …puis accélérée, jusqu'à cette vitesse. */
export const MAX_SPEED = 1.8;

export const PLAYER_PRESET: VoicePreset = { label: "Player", pitch: 1, effect: "none", amount: 0, param: 0 };

export const CPU_PRESETS: VoicePreset[] = [
  { label: "Demon", pitch: 0.55, effect: "cave", amount: 0.5, param: 2.5 },
  { label: "Low & hasty", pitch: 0.65, effect: "none", amount: 0, param: 0 },
  { label: "Movie villain", pitch: 0.8, effect: "cave", amount: 0.35, param: 2 },
  { label: "Cartoon villain", pitch: 1.4, effect: "wobble", amount: 0.4, param: 5 },
  { label: "Game-show host", pitch: 1.15, effect: "megaphone", amount: 0.3, param: 0 },
  { label: "Slow-mo", pitch: 0.7, effect: "wobble", amount: 0.3, param: 2 },
  { label: "Sleepy giant", pitch: 0.6, effect: "cave", amount: 0.3, param: 1.5 },
  { label: "Whispered threat", pitch: 0.65, effect: "cave", amount: 0.25, param: 1.2, volume: 0.4 },
  { label: "Whiny kid", pitch: 1.4, effect: "wobble", amount: 0.3, param: 9 },
  { label: "Smug elf", pitch: 1.35, effect: "metal", amount: 0.3, param: 6 },
  { label: "Helium", pitch: 1.8, effect: "none", amount: 0, param: 0 },
  { label: "Robot", pitch: 0.9, effect: "robot", amount: 0.8, param: 50 },
  { label: "Alien", pitch: 1.2, effect: "alien", amount: 0.7, param: 320 },
];
