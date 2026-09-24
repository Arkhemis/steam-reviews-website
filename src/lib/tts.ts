// La synthèse vocale du battle passe par Google Traduction (route
// `/api/battle/gtts`) ; la voix du navigateur prend le relais en cas d'échec.

/** Au-delà, Google refuse le texte : les répliques plus longues sont découpées. */
export const GOOGLE_TTS_MAX = 200;

/** Langue Steam → code `tl` de Google Traduction. */
export const GOOGLE_TTS_LANG: Record<string, string> = {
  arabic: "ar",
  bulgarian: "bg",
  schinese: "zh-CN",
  tchinese: "zh-TW",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  finnish: "fi",
  french: "fr",
  german: "de",
  greek: "el",
  hungarian: "hu",
  italian: "it",
  japanese: "ja",
  koreana: "ko",
  norwegian: "nb",
  polish: "pl",
  portuguese: "pt-PT",
  brazilian: "pt-BR",
  romanian: "ro",
  russian: "ru",
  spanish: "es",
  latam: "es-419",
  swedish: "sv",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  vietnamese: "vi",
};
