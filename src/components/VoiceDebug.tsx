"use client";

import { useEffect, useRef, useState } from "react";
import { BLEEP_MS, DuelAudio } from "@/components/duel/sound";
import { DuelVoices, quoteParts, warmUpVoices, type VoiceDebugEvent } from "@/components/duel/voice";
import { CPU_PRESETS, PLAYER_PRESET } from "@/components/duel/voicePresets";
import { LANGUAGE_LABELS, type LanguageKey } from "@/lib/map";
import { GOOGLE_TTS_LANG } from "@/lib/tts";

// Le banc de débogage de /sounds : une réplique lue exactement comme dans le
// duel, avec la chronologie de chaque morceau (mise en file, début, fin) et le
// blanc qui sépare deux morceaux, pour traquer les silences.

const DEFAULT_QUOTE = "worst fucking game ever. fucking movement fucking loading time fucking devs";

/** Au-delà, le blanc entre deux morceaux s'entend. */
const AUDIBLE_GAP_MS = 120;

type Engine = "auto" | "browser" | "google";
type Row = VoiceDebugEvent & { gap?: number };

const PRESETS = [PLAYER_PRESET, ...CPU_PRESETS];

export function VoiceDebug() {
  const [text, setText] = useState(DEFAULT_QUOTE);
  const [language, setLanguage] = useState<LanguageKey>("english");
  const [engine, setEngine] = useState<Engine>("auto");
  const [presetLabel, setPresetLabel] = useState(PLAYER_PRESET.label);
  const [censored, setCensored] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [voiceInfo, setVoiceInfo] = useState<string>("");
  const voices = useRef<DuelVoices | null>(null);
  const audio = useRef<DuelAudio | null>(null);
  const t0 = useRef(0);
  const lastEnd = useRef<number | null>(null);

  // Chrome remplit sa liste de voix en différé : on la réclame dès l'arrivée.
  useEffect(() => warmUpVoices(() => {}), []);

  const parts = quoteParts(text, language, censored);

  const play = () => {
    const cast = (voices.current ??= new DuelVoices());
    const sfx = (audio.current ??= new DuelAudio());
    // Dans le geste : l'élément audio et le contexte n'ont le droit de parler qu'ainsi.
    cast.unlock();
    sfx.unlock();
    cast.cancel();
    cast.recast(language);

    const installed =
      "speechSynthesis" in window
        ? window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(GOOGLE_TTS_LANG[language].slice(0, 2)))
        : [];
    setVoiceInfo(
      installed.length
        ? `${installed.length} browser voice(s) for this language: ${installed.map((v) => v.name).join(", ")}`
        : "No browser voice for this language: auto mode goes straight to Google.",
    );

    setRows([]);
    t0.current = performance.now();
    lastEnd.current = null;
    const preset = PRESETS.find((p) => p.label === presetLabel) ?? PLAYER_PRESET;
    cast.debug = {
      engine: engine === "auto" ? undefined : engine,
      preset,
      log: (event) => {
        const at = performance.now() - t0.current;
        let gap: number | undefined;
        if (event.event === "start" && lastEnd.current !== null) gap = at - lastEnd.current;
        if (event.event === "end") lastEnd.current = at;
        setRows((was) => [...was, { ...event, at, gap }]);
      },
    };
    void cast.speakParts(parts, preset === PLAYER_PRESET ? "player" : "cpu", () => {
      sfx.play("bleep");
      cast.debug?.log({ engine: "browser", event: "bleep" });
      return new Promise((done) => setTimeout(done, BLEEP_MS));
    });
  };

  const gaps = rows.filter((row) => row.gap !== undefined).map((row) => row.gap!);
  const select = "mt-1 w-full rounded border border-[#24333f] bg-[#0a0f14] px-2 py-1.5 text-sm text-[#eef2f4]";

  return (
    <section className="mt-12 border-t border-[#24333f] pt-8">
      <h2 className="text-lg font-extrabold tracking-tight">Duel voice debug</h2>
      <p className="mt-1 text-sm text-[#9fb2bd]">
        Reads a quote exactly like the duel does, and logs every piece: when it was queued, when it started and ended,
        and the silence before it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-[#9fb2bd]">
          Language
          <select className={select} value={language} onChange={(e) => setLanguage(e.target.value as LanguageKey)}>
            {(Object.keys(GOOGLE_TTS_LANG) as LanguageKey[]).map((key) => (
              <option key={key} value={key}>
                {LANGUAGE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#9fb2bd]">
          Engine
          <select className={select} value={engine} onChange={(e) => setEngine(e.target.value as Engine)}>
            <option value="auto">Auto (browser, then Google)</option>
            <option value="browser">Browser only</option>
            <option value="google">Google only</option>
          </select>
        </label>
        <label className="block text-xs text-[#9fb2bd]">
          Preset
          <select className={select} value={presetLabel} onChange={(e) => setPresetLabel(e.target.value)}>
            {PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs text-[#9fb2bd]">
          <input type="checkbox" checked={censored} onChange={(e) => setCensored(e.target.checked)} />
          Censored (♥ become bleeps)
        </label>
      </div>

      <label className="mt-3 block text-xs text-[#9fb2bd]">
        Quote
        <textarea className={`${select} h-16`} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded bg-[#66c0f4] px-4 py-2 text-sm font-semibold text-[#0a0f14] hover:bg-[#8fd3fa]"
          onClick={play}
        >
          ▶ Play like the duel
        </button>
        <button type="button" className="rounded border border-[#24333f] px-3 py-2 text-sm" onClick={() => voices.current?.cancel()}>
          ■ Stop
        </button>
        {gaps.length > 0 && (
          <span className="font-mono text-xs text-[#c6d4df]">
            gaps: max {Math.round(Math.max(...gaps))} ms · avg {Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)} ms
          </span>
        )}
      </div>
      {voiceInfo && <p className="mt-2 font-mono text-[11px] text-[#7d919c]">{voiceInfo}</p>}

      <h3 className="mt-5 text-xs font-semibold tracking-[0.1em] text-[#9fb2bd] uppercase">Pieces</h3>
      <ol className="mt-1 flex flex-wrap gap-1.5 font-mono text-xs">
        {parts.map((part, i) => (
          <li
            key={i}
            className={`rounded border px-1.5 py-0.5 ${part?.swear ? "border-[#ff5a4f] text-[#ff5a4f]" : "border-[#24333f] text-[#c6d4df]"}`}
          >
            <span className="text-[#5f7480]">{i}</span> {part ? `“${part.text}”` : "BLEEP"}
          </li>
        ))}
      </ol>

      <h3 className="mt-5 text-xs font-semibold tracking-[0.1em] text-[#9fb2bd] uppercase">Timeline</h3>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full font-mono text-[11px]">
          <thead className="text-left text-[#5f7480]">
            <tr>
              <th className="py-1 pr-3">+ms</th>
              <th className="pr-3">engine</th>
              <th className="pr-3">event</th>
              <th className="pr-3">#</th>
              <th className="pr-3">gap</th>
              <th className="pr-3">text</th>
              <th>detail</th>
            </tr>
          </thead>
          <tbody className="text-[#c6d4df]">
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#1a2530]">
                <td className="py-1 pr-3">{Math.round(row.at)}</td>
                <td className="pr-3">{row.engine}</td>
                <td className="pr-3">{row.event}</td>
                <td className="pr-3">{row.part ?? ""}</td>
                <td className={`pr-3 ${row.gap !== undefined && row.gap > AUDIBLE_GAP_MS ? "font-bold text-[#ff5a4f]" : ""}`}>
                  {row.gap !== undefined ? `${Math.round(row.gap)} ms` : ""}
                </td>
                <td className={`pr-3 whitespace-pre ${row.swear ? "text-[#ff5a4f]" : ""}`}>{row.text ? `“${row.text}”` : ""}</td>
                <td className="text-[#7d919c]">{row.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
