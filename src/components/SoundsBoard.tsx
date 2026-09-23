"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CPU_STYLES,
  DuelVoices,
  genderOf,
  PLAYER_STYLE,
  SPEECH_LANG,
  voicesFor,
  warmUpVoices,
  type VoiceStyle,
} from "@/components/duel/voice";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";

// Le banc d'écoute de /sounds : les voix que l'OS propose pour une langue, et
// chaque timbre du duel posé sur la voix choisie. Temporaire, le temps du tri.

const SAMPLE = "10/10 would get destroyed by a chicken again. Refunded my sanity, kept the game.";

const STYLES: VoiceStyle[] = [PLAYER_STYLE, ...CPU_STYLES];

const btn =
  "rounded-full border border-[#24333f] bg-[#0c1116]/60 px-3 py-1 text-sm font-semibold text-[#cfdae1] hover:border-white/30 disabled:opacity-40";

function say(text: string, voice: SpeechSynthesisVoice | null, lang: string, style: VoiceStyle): Promise<void> {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? lang;
  utterance.pitch = style.pitch;
  utterance.rate = style.rate;
  utterance.volume = style.volume ?? 1;
  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

export function SoundsBoard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [language, setLanguage] = useState<string>("english");
  const [voiceUri, setVoiceUri] = useState<string>("");
  const [text, setText] = useState(SAMPLE);
  const [playing, setPlaying] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const stopRef = useRef(false);

  useEffect(() => {
    const ok = DuelVoices.supported();
    // L'API n'existe qu'au navigateur : on ne la sonde qu'une fois monté.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (!ok) return;
    return warmUpVoices(() => setAllVoices(window.speechSynthesis.getVoices()));
  }, []);

  const lang = SPEECH_LANG[language] ?? "en-US";
  const voices = voicesFor(allVoices, lang);
  const voice = voices.find((v) => v.voiceURI === voiceUri) ?? voices[0] ?? null;

  const stop = useCallback(() => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setPlaying(null);
  }, []);

  async function play(key: string, v: SpeechSynthesisVoice | null, style: VoiceStyle) {
    stop();
    stopRef.current = false;
    setPlaying(key);
    await say(text, v, lang, style);
    setPlaying((current) => (current === key ? null : current));
  }

  async function playAll() {
    stop();
    stopRef.current = false;
    for (const style of STYLES) {
      if (stopRef.current) break;
      setPlaying(`style:${style.id}`);
      await say(text, voice, lang, style);
    }
    setPlaying(null);
  }

  function toggleKept(id: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (supported === false) {
    return <p className="text-[#9fb2bd]">This browser has no speech synthesis, so there is nothing to play.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-[11px] tracking-[0.16em] text-brand-blue uppercase">temporary · duel voices</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Every voice the duel can use</h1>
        <p className="mt-2 max-w-[70ch] text-[15px] text-[#9fb2bd]">
          Voices come from your OS and browser ({allVoices.length} installed here). The duel only controls the
          timbre laid on top: pitch, rate and volume. Pick a voice, then play the timbres.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm text-[#9fb2bd]">
          Review language
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setVoiceUri("");
            }}
            className="rounded-md border border-[#24333f] bg-[#0a0f14] px-2 py-1.5 text-[#eef2f4]"
          >
            {Object.keys(SPEECH_LANG).map((key) => (
              <option key={key} value={key}>
                {LANGUAGE_LABELS[key as LanguageKey] ?? key} ({SPEECH_LANG[key]})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#9fb2bd]">
          Sample line
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-md border border-[#24333f] bg-[#0a0f14] px-2 py-1.5 text-[#eef2f4]"
          />
        </label>
      </div>

      <section>
        <h2 className="text-lg font-extrabold tracking-tight">
          Installed voices for {lang} <span className="text-[#7d919c]">({voices.length})</span>
        </h2>
        {voices.length === 0 ? (
          <p className="mt-2 text-sm text-[#9fb2bd]">
            No voice installed for this language: the browser falls back to its default voice.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {voices.map((v) => {
              const key = `voice:${v.voiceURI}`;
              const selected = v === voice;
              return (
                <li
                  key={v.voiceURI}
                  className={`flex items-center gap-3 rounded-md border p-3 ${selected ? "border-brand-blue" : "border-[#1e2b36]"} bg-[#0a0f14]`}
                >
                  <input
                    type="radio"
                    name="voice"
                    checked={selected}
                    onChange={() => setVoiceUri(v.voiceURI)}
                    aria-label={`Use ${v.name} for the timbres`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{v.name}</div>
                    <div className="font-mono text-[11px] text-[#7d919c]">
                      {v.lang} · {genderOf(v) ?? "gender unknown"} · {v.localService ? "local" : "remote"}
                      {v.default ? " · default" : ""}
                    </div>
                  </div>
                  <button type="button" className={btn} onClick={() => play(key, v, PLAYER_STYLE)}>
                    {playing === key ? "…" : "▶ Play"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold tracking-tight">
            Timbres <span className="text-[#7d919c]">({STYLES.length})</span>
          </h2>
          <span className="text-sm text-[#7d919c]">on {voice?.name ?? "the default voice"}</span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btn} onClick={playAll}>
              ▶ Play all
            </button>
            <button type="button" className={btn} onClick={stop} disabled={!playing}>
              ■ Stop
            </button>
          </div>
        </div>
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {STYLES.map((style, i) => {
            const key = `style:${style.id}`;
            return (
              <li
                key={style.id}
                className={`flex items-center gap-3 rounded-md border p-3 ${playing === key ? "border-brand-blue" : "border-[#1e2b36]"} bg-[#0a0f14]`}
              >
                <input
                  type="checkbox"
                  checked={kept.has(style.id)}
                  onChange={() => toggleKept(style.id)}
                  aria-label={`Keep ${style.label}`}
                />
                <span className="w-6 text-right font-mono text-[12px] text-[#7d919c]">{i}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{style.label}</div>
                  <div className="font-mono text-[11px] text-[#7d919c]">
                    {style.id} · pitch {style.pitch} · rate {style.rate}
                    {style.volume !== undefined ? ` · volume ${style.volume}` : ""}
                  </div>
                </div>
                <button type="button" className={btn} onClick={() => play(key, voice, style)}>
                  {playing === key ? "…" : "▶ Play"}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-[#9fb2bd]">
          Kept ({kept.size}):{" "}
          <code className="rounded bg-[#0a0f14] px-1.5 py-0.5 font-mono text-[12px] text-[#eef2f4] select-all">
            {kept.size ? [...kept].join(", ") : "none yet"}
          </code>
        </p>
      </section>
    </div>
  );
}
