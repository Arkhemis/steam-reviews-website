"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { autoSpeed, decodeVoice, EFFECTS, renderVoice, type VoiceEffect } from "@/components/duel/voiceFx";
import {
  BASE_SPEED,
  CPU_PRESETS,
  MAX_NORMAL_S,
  MAX_SPEED,
  PLAYER_PRESET,
  type VoicePreset,
} from "@/components/duel/voicePresets";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import { GOOGLE_TTS_LANG, GOOGLE_TTS_MAX } from "@/lib/tts";

// Le banc d'écoute de /sounds : la voix Google d'une langue, retravaillée comme
// dans le duel (hauteur, effet, vitesse selon la longueur), et les combinaisons
// retenues, gardées dans le navigateur et exportables en JSON.

type Settings = VoicePreset & { baseSpeed: number; maxNormal: number; maxSpeed: number };

const DEFAULTS: Settings = {
  ...PLAYER_PRESET,
  volume: 1,
  baseSpeed: BASE_SPEED,
  maxNormal: MAX_NORMAL_S,
  maxSpeed: MAX_SPEED,
};

const SAMPLES: Record<LanguageKey, string> = {
  arabic: "أربعمئة ساعة وما زلت أكره هذه الزفت. عشرة من عشرة.",
  bulgarian: "Четиристотин часа и още мразя това лайно. Десет от десет.",
  schinese: "玩了四百个小时，我还是讨厌这狗屎。十分满分。",
  tchinese: "玩了四百個小時，我還是討厭這狗屎。十分滿分。",
  czech: "Čtyři sta hodin a pořád nesnáším tohle hovno. Deset z deseti.",
  danish: "Fire hundrede timer, og jeg hader stadig det her lort. Ti ud af ti.",
  dutch: "Vierhonderd uur en ik haat deze kut nog steeds. Tien op tien.",
  english: "Four hundred hours in and I still hate this shit. Ten out of ten.",
  finnish: "Neljäsataa tuntia ja vihaan yhä tätä paskaa. Kymmenen kymmenestä.",
  french: "Quatre cents heures de jeu et je déteste toujours cette merde. Dix sur dix.",
  german: "Vierhundert Stunden und ich hasse diese Scheiße immer noch. Zehn von zehn.",
  greek: "Τετρακόσιες ώρες και ακόμα μισώ αυτά τα σκατά. Δέκα στα δέκα.",
  hungarian: "Négyszáz óra után is utálom ezt a szart. Tízből tíz.",
  italian: "Quattrocento ore e odio ancora questa merda. Dieci su dieci.",
  japanese: "四百時間遊んだけど、まだこのクソが嫌い。十点満点。",
  koreana: "사백 시간을 했는데 아직도 이 개똥이 싫어요. 십점 만점.",
  norwegian: "Fire hundre timer, og jeg hater fortsatt denne dritten. Ti av ti.",
  polish: "Czterysta godzin i dalej nienawidzę tego gówna. Dziesięć na dziesięć.",
  portuguese: "Quatrocentas horas e ainda odeio esta merda. Dez em dez.",
  brazilian: "Quatrocentas horas e eu ainda odeio essa merda. Nota dez.",
  romanian: "Patru sute de ore și încă urăsc căcatul ăsta. Zece din zece.",
  russian: "Четыреста часов, а я всё ещё ненавижу это говно. Десять из десяти.",
  spanish: "Cuatrocientas horas y sigo odiando esta mierda. Diez de diez.",
  latam: "Cuatrocientas horas y todavía odio esta mierda. Diez de diez.",
  swedish: "Fyrahundra timmar och jag hatar fortfarande den här skiten. Tio av tio.",
  thai: "เล่นไปสี่ร้อยชั่วโมงแล้ว ยังเกลียดเกมขี้นี่อยู่เลย สิบเต็มสิบ",
  turkish: "Dört yüz saat oynadım, hâlâ bu boktan nefret ediyorum. On üzerinden on.",
  ukrainian: "Чотириста годин, а я досі ненавиджу це лайно. Десять із десяти.",
  vietnamese: "Bốn trăm giờ rồi mà tôi vẫn ghét cái thứ cứt này. Mười điểm.",
};

const STORAGE_KEY = "voice-lab-presets";
// `storage` ne prévient que les autres onglets, d'où l'événement maison pour celui-ci.
const SAVED_EVENT = "voice-lab-presets";

function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SAVED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SAVED_EVENT, onChange);
  };
}

function readSaved(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeSaved(presets: VoicePreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Stockage indisponible : la liste ne survit pas à la page.
  }
  window.dispatchEvent(new Event(SAVED_EVENT));
}

/** Un preset tel qu'il s'écrit dans `voicePresets.ts`, sans les réglages de vitesse. */
function toPreset({ baseSpeed: _b, maxNormal: _n, maxSpeed: _s, ...preset }: Settings): VoicePreset {
  void _b;
  void _n;
  void _s;
  const out: VoicePreset = { ...preset };
  if (out.volume === undefined || out.volume === 1) delete out.volume;
  return out;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between text-[#9fb2bd]">
        <span>{props.label}</span>
        <span className="font-mono text-[#eef2f4]">{props.value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-[#66c0f4]"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

const button = "rounded border border-[#24333f] px-2 py-1 text-xs hover:border-[#66c0f4]";

export function VoiceLab() {
  const [language, setLanguage] = useState<LanguageKey>("english");
  const [text, setText] = useState(SAMPLES.english);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const decoded = useRef(new Map<string, Promise<AudioBuffer>>());
  const run = useRef(0);

  const savedRaw = useSyncExternalStore(subscribeSaved, readSaved, () => "[]");
  const saved = useMemo(() => JSON.parse(savedRaw) as VoicePreset[], [savedRaw]);

  const set = (patch: Partial<Settings>) => setSettings((was) => ({ ...was, ...patch }));
  const load = (preset: VoicePreset) => set({ volume: 1, ...preset });

  const stop = useCallback(() => {
    run.current++;
    audio.current?.pause();
    setPlaying(false);
  }, []);

  /** Le MP3 de Google pour ce texte, décodé une fois : les curseurs ne refont pas la requête. */
  const voiceFor = useCallback((lang: LanguageKey, words: string) => {
    const key = `${lang}\n${words}`;
    let buffer = decoded.current.get(key);
    if (!buffer) {
      buffer = fetch(`/api/battle/gtts?${new URLSearchParams({ lang, text: words })}`).then(async (response) => {
        if (!response.ok) throw new Error(`Google ${response.status}`);
        return decodeVoice(await response.arrayBuffer());
      });
      buffer.catch(() => decoded.current.delete(key));
      decoded.current.set(key, buffer);
    }
    return buffer;
  }, []);

  const play = useCallback(
    async (fx: Settings) => {
      const id = ++run.current;
      const el = (audio.current ??= new Audio());
      el.pause();
      setPlaying(true);
      setStatus("Rendering…");
      try {
        const voice = await renderVoice(await voiceFor(language, text.trim()), fx);
        if (id !== run.current) return URL.revokeObjectURL(voice.url);
        const speed = autoSpeed(voice.duration, fx.maxNormal, fx.maxSpeed, fx.baseSpeed);
        if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src);
        el.src = voice.url;
        el.preservesPitch = true;
        el.playbackRate = el.defaultPlaybackRate = voice.rateFor(speed);
        el.volume = fx.volume ?? 1;
        el.onended = () => id === run.current && setPlaying(false);
        setStatus(`${voice.duration.toFixed(1)} s at normal speed → ×${speed.toFixed(2)}`);
        await el.play();
      } catch (error) {
        if (id !== run.current) return;
        setPlaying(false);
        setStatus(error instanceof Error ? error.message : "Playback failed");
      }
    },
    [language, text, voiceFor],
  );

  const save = () => {
    const preset = toPreset(settings);
    writeSaved([...saved.filter((p) => p.label !== preset.label), preset]);
  };

  const exported = JSON.stringify(saved, null, 2);
  const effect = EFFECTS[settings.effect];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <label className="block text-xs text-[#9fb2bd]">
          Language
          <select
            className="mt-1 w-full rounded border border-[#24333f] bg-[#0a0f14] px-2 py-1.5 text-sm text-[#eef2f4]"
            value={language}
            onChange={(event) => {
              const next = event.target.value as LanguageKey;
              stop();
              setLanguage(next);
              setText(SAMPLES[next]);
            }}
          >
            {(Object.keys(GOOGLE_TTS_LANG) as LanguageKey[]).map((key) => (
              <option key={key} value={key}>
                {LANGUAGE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-[#9fb2bd]">
          <span className="flex justify-between">
            <span>Text</span>
            <span className="font-mono">
              {text.length}/{GOOGLE_TTS_MAX}
            </span>
          </span>
          <textarea
            className="mt-1 h-28 w-full rounded border border-[#24333f] bg-[#0a0f14] px-2 py-1.5 text-sm text-[#eef2f4]"
            maxLength={GOOGLE_TTS_MAX}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className="space-y-3 rounded-md border border-[#24333f] bg-[#0a0f14] p-3">
          <Slider label="Pitch" value={settings.pitch} min={0.4} max={2} step={0.05} onChange={(pitch) => set({ pitch })} />
          <label className="block text-xs text-[#9fb2bd]">
            Effect
            <select
              className="mt-1 w-full rounded border border-[#24333f] bg-[#0c1116] px-2 py-1.5 text-sm text-[#eef2f4]"
              value={settings.effect}
              onChange={(event) => {
                const next = event.target.value as VoiceEffect;
                set({ effect: next, param: EFFECTS[next].param?.default ?? 0, amount: settings.amount || 0.5 });
              }}
            >
              {(Object.keys(EFFECTS) as VoiceEffect[]).map((key) => (
                <option key={key} value={key}>
                  {EFFECTS[key].label}
                </option>
              ))}
            </select>
          </label>
          {settings.effect !== "none" && (
            <Slider label="Effect amount" value={settings.amount} min={0} max={1} step={0.05} onChange={(amount) => set({ amount })} />
          )}
          {effect.param && (
            <Slider
              label={effect.param.label}
              value={settings.param || effect.param.default}
              min={effect.param.min}
              max={effect.param.max}
              step={effect.param.step}
              onChange={(param) => set({ param })}
            />
          )}
          <Slider label="Volume" value={settings.volume ?? 1} min={0} max={1} step={0.05} onChange={(volume) => set({ volume })} />
          <p className="border-t border-[#24333f] pt-3 text-[11px] text-[#7d919c]">Speed follows the quote&rsquo;s length:</p>
          <Slider
            label="Base speed"
            value={settings.baseSpeed}
            min={0.8}
            max={1.6}
            step={0.05}
            onChange={(baseSpeed) => set({ baseSpeed })}
          />
          <Slider
            label="Base speed up to (s)"
            value={settings.maxNormal}
            min={1}
            max={10}
            step={0.5}
            onChange={(maxNormal) => set({ maxNormal })}
          />
          <Slider label="Max speed" value={settings.maxSpeed} min={1} max={3} step={0.05} onChange={(maxSpeed) => set({ maxSpeed })} />
        </div>
      </aside>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-[#66c0f4] px-4 py-2 text-sm font-semibold text-[#0a0f14] hover:bg-[#8fd3fa]"
            onClick={() => void play(settings)}
          >
            {playing ? "♪ Playing…" : "▶ Play"}
          </button>
          <button type="button" className="rounded border border-[#24333f] px-3 py-2 text-sm" onClick={stop}>
            ■ Stop
          </button>
          {status && <span className="font-mono text-xs text-[#c6d4df]">{status}</span>}
        </div>

        <div>
          <p className="text-xs text-[#9fb2bd]">Duel presets — click to load, ▶ to hear</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[PLAYER_PRESET, ...CPU_PRESETS].map((preset) => (
              <span key={preset.label} className="inline-flex">
                <button type="button" className={`${button} rounded-r-none`} onClick={() => load(preset)}>
                  {preset.label}
                </button>
                <button
                  type="button"
                  aria-label={`Play ${preset.label}`}
                  className={`${button} rounded-l-none border-l-0`}
                  onClick={() => {
                    const next = { ...settings, volume: 1, ...preset };
                    setSettings(next);
                    void play(next);
                  }}
                >
                  ▶
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#24333f] bg-[#0a0f14] p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block grow text-xs text-[#9fb2bd]">
              Name
              <input
                className="mt-1 w-full rounded border border-[#24333f] bg-[#0c1116] px-2 py-1.5 text-sm text-[#eef2f4]"
                value={settings.label}
                onChange={(event) => set({ label: event.target.value })}
              />
            </label>
            <button
              type="button"
              className="rounded bg-[#66c0f4] px-3 py-1.5 text-sm font-semibold text-[#0a0f14] hover:bg-[#8fd3fa]"
              onClick={save}
            >
              Save preset
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[#7d919c]">Same name replaces the saved one.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Saved presets <span className="text-[#7d919c]">({saved.length})</span>
            </h2>
            <button
              type="button"
              className="text-xs text-[#66c0f4] hover:underline"
              onClick={() => {
                void navigator.clipboard?.writeText(exported).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          {saved.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {saved.map((preset) => (
                <li key={preset.label} className="flex items-center gap-2 text-sm">
                  <span className="grow">
                    {preset.label}{" "}
                    <span className="font-mono text-[11px] text-[#7d919c]">
                      pitch {preset.pitch} · {EFFECTS[preset.effect].label}
                      {preset.effect !== "none" && ` ${preset.amount}`}
                    </span>
                  </span>
                  <button type="button" className={button} onClick={() => load(preset)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      const next = { ...settings, volume: 1, ...preset };
                      setSettings(next);
                      void play(next);
                    }}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className={button}
                    onClick={() => writeSaved(saved.filter((p) => p.label !== preset.label))}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-[#24333f] bg-[#0a0f14] p-3 font-mono text-[11px] text-[#c6d4df]">
            {exported}
          </pre>
        </div>
      </section>
    </div>
  );
}
