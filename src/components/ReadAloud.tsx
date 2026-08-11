import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  containerRef: React.RefObject<HTMLDivElement>;
  sentences: string[];
  language: string; // "English" | "Hinglish" | "Hindi"
}

const HIGHLIGHT_CLASS = "read-aloud-active";

const preferredLangCodes = (language: string): string[] => {
  const l = (language || "").toLowerCase();
  if (l.includes("hindi")) return ["hi-IN"];
  if (l.includes("hinglish")) return ["hi-IN", "en-IN"];
  return ["en-IN", "en-GB", "en-US"];
};

const filterVoices = (voices: SpeechSynthesisVoice[], language: string) => {
  const codes = preferredLangCodes(language);
  const matches = voices.filter((v) =>
    codes.some((c) => v.lang?.toLowerCase().startsWith(c.toLowerCase().slice(0, 2)))
  );
  // Prioritize India voices first
  return matches.sort((a, b) => {
    const aIn = /-IN/i.test(a.lang) ? 0 : 1;
    const bIn = /-IN/i.test(b.lang) ? 0 : 1;
    return aIn - bIn;
  });
};

export default function ReadAloud({ containerRef, sentences, language }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const idxRef = useRef(0);
  const cancelledRef = useRef(false);

  // Load voices
  useEffect(() => {
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const filtered = filterVoices(voices, language);

  // Pick default voice when list or language changes
  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.find((v) => v.voiceURI === voiceURI)) {
      setVoiceURI(filtered[0].voiceURI);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((v) => v.voiceURI).join("|")]);

  // Stop when sentences change (topic switch)
  useEffect(() => {
    stop();
    setIdx(0);
    idxRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences]);

  useEffect(() => () => stop(), []); // cleanup on unmount

  const highlight = (n: number) => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    const el = root.querySelector(`[data-sent="${n}"]`);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const clearHighlight = () => {
    const root = containerRef.current;
    root?.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
  };

  const speak = (n: number) => {
    if (n < 0 || n >= sentences.length) { stop(); return; }
    idxRef.current = n;
    setIdx(n);
    highlight(n);

    const u = new SpeechSynthesisUtterance(sentences[n]);
    const v = voices.find((x) => x.voiceURI === voiceURI) || filtered[0];
    if (v) { u.voice = v; u.lang = v.lang; }
    else {
      const codes = preferredLangCodes(language);
      u.lang = codes[0];
    }
    u.rate = rate;
    u.pitch = 1;
    u.onend = () => {
      if (cancelledRef.current) return;
      const next = idxRef.current + 1;
      if (next < sentences.length) speak(next);
      else { setPlaying(false); setPaused(false); clearHighlight(); }
    };
    u.onerror = () => { setPlaying(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  };

  const play = () => {
    if (!sentences.length) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      setPlaying(true);
      return;
    }
    cancelledRef.current = false;
    window.speechSynthesis.cancel();
    setPlaying(true);
    setPaused(false);
    speak(idxRef.current || 0);
  };

  const pause = () => {
    if (!playing) return;
    window.speechSynthesis.pause();
    setPaused(true);
    setPlaying(false);
  };

  const stop = () => {
    cancelledRef.current = true;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    setPlaying(false);
    setPaused(false);
    clearHighlight();
  };

  const jump = (delta: number) => {
    const target = Math.max(0, Math.min(sentences.length - 1, idxRef.current + delta));
    idxRef.current = target;
    setIdx(target);
    highlight(target);
    if (playing || paused) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      setTimeout(() => {
        cancelledRef.current = false;
        setPlaying(true);
        setPaused(false);
        speak(target);
      }, 60);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-muted/40 border border-border/60 mb-4">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => jump(-1)} title="Previous sentence" disabled={!sentences.length}>
          <SkipBack className="h-4 w-4" />
        </Button>
        {playing ? (
          <Button size="sm" variant="secondary" onClick={pause} title="Pause">
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={play} title="Play" disabled={!sentences.length}>
            <Play className="h-4 w-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={stop} title="Stop" disabled={!playing && !paused}>
          <Square className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => jump(1)} title="Next sentence" disabled={!sentences.length}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Select value={voiceURI} onValueChange={setVoiceURI}>
          <SelectTrigger className="h-8 w-[240px] text-xs">
            <SelectValue placeholder="Select voice" />
          </SelectTrigger>
          <SelectContent>
            {filtered.length === 0 && (
              <SelectItem value="none" disabled>No Indian voices available</SelectItem>
            )}
            {filtered.map((v) => (
              <SelectItem key={v.voiceURI} value={v.voiceURI}>
                {v.name} <span className="text-muted-foreground">({v.lang})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
        <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[0.75, 0.9, 1, 1.15, 1.3, 1.5].map((r) => (
            <SelectItem key={r} value={String(r)}>{r}x</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground ml-auto">
        {sentences.length > 0 ? `${Math.min(idx + 1, sentences.length)} / ${sentences.length}` : "—"}
      </span>
    </div>
  );
}
