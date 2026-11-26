"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLongPoll } from "@/app/(killer)/killer/useLongPoll";
import type { ProjectionView } from "@/modules/loups/scenarios/data";
import { LOADING_MS, protocolOf, registry, timeLeft, type Action } from "@/modules/loups/scenarios/engine";
import { parseCues, type Cue } from "@/modules/loups/scenarios/subtitles";
import type { Fault, PublicScenario, Terminal } from "@/modules/loups/scenarios/types";
import { projectionReportAction } from "../../actions";
import { forgetFiles, keepFiles, keyOf, loadFiles, MEDIA_FORMATS } from "./media";
import { SPOTS, STATION_DOORS, STATION_H, STATION_W } from "@/modules/loups/scenarios/station";
import { DoorOpening, FlyingKey, Inventory, PropScene } from "./Sandbox";
import { Plan } from "./Plan";
import { SFX, audio, cassette } from "./sfx";

type Overlay = { kind: "banner"; text: string; tone: "ok" | "bad"; key: number } | null;

/** The room's screen. It only shows the evening's state, and plays once the effects of new gestures. */
export function Projection({ token, def, initial }: { token: string; def: PublicScenario; initial: ProjectionView }) {
  const { data } = useLongPoll<ProjectionView>(`/api/scenario/${token}/poll`, initial);
  const view = data ?? initial;
  const s = view.state;

  // ── The projection computer's own files, and its microphone ──
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [mic, setMic] = useState(false);
  const [panel, setPanel] = useState(true);
  const recording = useRef<string | null>(null);
  /** When the room was recorded (the hall microphone's file shows it, and « il y a n min »). */
  const recordedAt = useRef<number | null>(null);
  const wanted = useMemo(() => [...def.media.map((m) => m.file), ...view.extraFaults.filter((f) => f.kind === "image" && f.media).map((f) => f.media!)], [def.media, view.extraFaults]);
  // Subtitles, optional: a .vtt of the same name next to a video or an audio file.
  const subtitleFiles = useMemo(() => def.media.filter((m) => m.kind !== "image").map((m) => m.file.replace(/\.[^.]+$/, ".vtt")), [def.media]);
  const [subtitles, setSubtitles] = useState<Map<string, string>>(new Map());
  const urlOf = useCallback(
    (slotOrFile: string | undefined) => {
      if (!slotOrFile) return null;
      const slot = def.media.find((m) => m.id === slotOrFile);
      return files.get(keyOf(slot ? slot.file : slotOrFile)) ?? null;
    },
    [def.media, files],
  );
  const reload = useCallback(async () => {
    try {
      const blobs = await loadFiles();
      setFiles((old) => {
        for (const url of old.values()) URL.revokeObjectURL(url);
        return new Map([...blobs].filter(([k]) => !k.endsWith(".vtt")).map(([k, b]) => [k, URL.createObjectURL(b)]));
      });
      const texts = await Promise.all([...blobs].filter(([k]) => k.endsWith(".vtt")).map(async ([k, b]) => [k, await b.text()] as const));
      setSubtitles(new Map(texts));
    } catch {
      // No IndexedDB (private window): the files must be picked again each time.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- IndexedDB only exists in the browser
    void reload();
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => setMic(p.state === "granted"))
      .catch(() => undefined);
  }, [reload]);
  const ready = wanted.filter((f) => files.has(keyOf(f))).length;

  // The heartbeat: the console shows the projection connected, its media and its microphone.
  useEffect(() => {
    const beat = () => void projectionReportAction(token, { ready, total: wanted.length, mic }).catch(() => undefined);
    beat();
    const timer = setInterval(beat, 5000);
    return () => clearInterval(timer);
  }, [token, ready, wanted.length, mic]);

  // ── Sounds: one-shots on a gesture, ambiances while the state says so ──
  const sounds = useRef(new Map<string, HTMLAudioElement>());
  /** What « lecture, pause, ±10 s » acts on: the tape on the terminal, else the last sound played. */
  const media = useRef<HTMLMediaElement | null>(null);
  const soundOf = useCallback(
    (slot: string) => {
      const url = urlOf(slot);
      if (!url) return null;
      let el = sounds.current.get(slot);
      if (!el || el.dataset.url !== url) {
        el = new Audio(url);
        el.dataset.url = url;
        el.loop = !!def.media.find((m) => m.id === slot)?.loop;
        sounds.current.set(slot, el);
      }
      return el;
    },
    [urlOf, def.media],
  );
  // The welcome screen comes with its own ambiance (the wind on the station's sign), as long as it's shown.
  const welcomeShown = s.phase === "welcome" && s.loadingAt === null && s.screen === "accueil" && !s.neutral;
  useEffect(() => {
    for (const m of def.media.filter((x) => x.loop)) {
      const el = soundOf(m.id);
      if (!el) continue;
      if (s.ambiances.includes(m.id) || (welcomeShown && m.id === def.base.welcomeSound)) void el.play().catch(() => undefined);
      else el.pause();
    }
    // `panel`: the browser lets sound play once « Lancer la projection » has been pressed.
  }, [s.ambiances, def.media, def.base.welcomeSound, welcomeShown, soundOf, panel]);

  // ── Effects played once, for gestures newer than what this screen has seen ──
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [flash, setFlash] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const [denied, setDenied] = useState(false);
  const [darkOverride, setDarkOverride] = useState<number | null>(null);
  const [sparks, setSparks] = useState(0);
  const [tracker, setTracker] = useState(false);
  const [faultShow, setFaultShow] = useState<Fault | null>(null);
  const [announce, setAnnounce] = useState<string[] | null>(null);
  const [eventBig, setEventBig] = useState(false);
  const [reboot, setReboot] = useState<string | null>(null);
  // The sandbox's moments: a key flying to the group's slots, a password being typed, a door opening.
  const [flyKey, setFlyKey] = useState(0);
  const [typing, setTyping] = useState<{ text: string; ok: boolean; key: number } | null>(null);
  const [doorAnim, setDoorAnim] = useState<{ letter: string; dest: (typeof STATION_DOORS)[number]["b"]; withKey: boolean; key: number } | null>(null);
  const lastInventory = useRef(initial.state.inventory.length);
  const [bootKey, setBootKey] = useState(0);
  const lastSeq = useRef<number | null>(null);
  const wasLocked = useRef(initial.state.locked);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const flicker = useCallback((seq: number[], step: number) => {
    seq.forEach((v, i) => later(() => setDarkOverride(v), i * step));
    later(() => setDarkOverride(null), seq.length * step);
  }, []);
  const banner = (text: string, tone: "ok" | "bad") => setOverlay({ kind: "banner", text, tone, key: Date.now() });
  const doGlitch = () => {
    SFX.glitch();
    setGlitch(true);
    later(() => setGlitch(false), 620);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // Kept in this page's memory only: never sent, gone when the page closes.
        if (recording.current) URL.revokeObjectURL(recording.current);
        recording.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
        recordedAt.current = Date.now() - 30_000;
      };
      rec.start();
      setTimeout(() => rec.state === "recording" && rec.stop(), 30_000);
    } catch {
      // No microphone: the fault will play the fallback file.
    }
  }, []);

  useEffect(() => {
    // Only gestures of the last few seconds: after a network cut, the screen catches up with the
    // journal without replaying the sounds and videos that went by meanwhile.
    const fresh = view.recent.filter((r) => view.now - r.at < 5000 && (lastSeq.current === null || r.seq > lastSeq.current));
    lastSeq.current = Math.max(lastSeq.current ?? 0, ...view.recent.map((r) => r.seq));
    const allFaults = [...def.faults, ...view.extraFaults];
    const nameOf = (id: string | null | undefined) => view.players.find((p) => p.id === id)?.name.toUpperCase() ?? "—";
    const lockedNow = s.locked && !wasLocked.current;
    wasLocked.current = s.locked;
    for (const { action: a } of fresh) {
      play(a);
    }
    lastInventory.current = s.inventory.length;
    function play(a: Action) {
      switch (a.t) {
        case "light":
          if (a.on) {
            SFX.neon();
            flicker([0, 0.95, 0.3, 1, 0, 0.85, 1], 110);
          }
          break;
        case "cut":
          SFX.zap();
          flicker([1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.8, 0, 1, 0.2, 0], 200);
          break;
        case "door":
          if (def.doors.find((d) => d.id === a.door)?.locked) {
            SFX.deny();
            setFlash(Date.now());
            banner("ACCÈS REFUSÉ", "bad");
            setDenied(true);
            later(() => setDenied(false), 800);
          } else if (a.open) SFX.door();
          else SFX.click();
          break;
        case "terminal":
          if (a.id) {
            SFX.boot();
            setBootKey(Date.now());
          }
          break;
        case "switch":
          SFX.click();
          break;
        case "power":
          if (s.lastPower) {
            SFX.ok();
            banner("PANIC ROOM OPÉRATIONNELLE", "ok");
          } else {
            SFX.zap();
            setSparks(Date.now());
            setFlash(Date.now());
            banner("COURT-CIRCUIT", "bad");
            flicker([1, 0, 1, 1, 1, 1, 1, 1, 0.6, 1, 0], 180);
          }
          break;
        case "glitch":
          doGlitch();
          break;
        case "blizzard":
          if (a.on) SFX.wind();
          break;
        case "sound": {
          const el = soundOf(a.slot);
          if (el && !el.loop) {
            el.currentTime = 0;
            void el.play().catch(() => undefined);
            media.current = el;
          }
          break;
        }
        case "stopSound":
          if (!a.slot) for (const el of sounds.current.values()) el.pause();
          break;
        case "stop":
          // Everything stops: sounds, the tape, the faults on screen, the announcements.
          for (const el of sounds.current.values()) el.pause();
          media.current?.pause();
          timers.current.forEach(clearTimeout);
          timers.current = [];
          setTracker(false);
          setFaultShow(null);
          setAnnounce(null);
          setEventBig(false);
          setReboot(null);
          setOverlay(null);
          setDarkOverride(null);
          break;
        case "neutral":
          setTracker(false);
          setFaultShow(null);
          setAnnounce(null);
          setEventBig(false);
          break;
        case "media": {
          const el = media.current;
          if (!el) break;
          if (a.cmd === "play") void el.play().catch(() => undefined);
          if (a.cmd === "pause") el.pause();
          if (a.cmd === "restart") el.currentTime = 0;
          if (a.cmd === "back") el.currentTime = Math.max(0, el.currentTime - 10);
          if (a.cmd === "forward") el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 10);
          break;
        }
        case "record":
          void startRecording();
          break;
        case "intrusion":
          if (a.text) doGlitch();
          break;
        case "fault": {
          const f = allFaults.find((x) => x.id === a.id);
          if (!f) break;
          doGlitch();
          if (f.kind === "tracker") {
            setTracker(true);
            later(() => setTracker(false), 4000);
          }
          if (f.kind === "image" || f.kind === "text") {
            setFaultShow(f);
            later(() => setFaultShow(null), 10_000);
          }
          break;
        }
        case "dawn":
          // The day breaks; the dead wait for the meneur's « Révéler » (suspense).
          break;
        case "reveal":
          setAnnounce(s.announced.map((id) => view.players.find((p) => p.id === id)?.name ?? "?"));
          later(() => {
            setAnnounce(null);
            setEventBig(true);
            later(() => setEventBig(false), 12_000);
          }, 9000);
          break;
        case "chief":
          if (a.player) {
            SFX.ok();
            banner(`CHEF DE MISSION : ${nameOf(a.player)}. IDENTIFICATION ENREGISTRÉE.`, "ok");
          }
          break;
        case "chiefConfirm":
          SFX.ok();
          banner(`CHEF DE MISSION : ${nameOf(s.chief)}. IDENTIFICATION CONFIRMÉE.`, "ok");
          break;
        case "vote":
          SFX.boot();
          break;
        case "voteResult":
          if (!a.choice) break;
          SFX.ok();
          if (s.chief === a.choice && s.phase !== "night") banner(`CHEF DE MISSION : ${nameOf(a.choice)}. IDENTIFICATION ENREGISTRÉE.`, "ok");
          else if (s.lastAction && s.lastAction !== "fouiller") SFX.door();
          break;
        case "dayAction":
          SFX.door();
          break;
        case "labForce":
          doGlitch();
          SFX.zap();
          banner("ACCÈS FORCÉ · LABORATOIRE", "bad");
          break;
        case "shoot":
          SFX.zap();
          setFlash(Date.now());
          if (s.lastShot && !s.lastShot.infected) banner("TIR SANS MOTIF. LE TIREUR EST EXCLU.", "bad");
          else if (s.lastShot) banner(`SIGNAL PERDU : ${nameOf(s.lastShot.target)}`, "bad");
          break;
        case "bloodTest":
          if (s.lastTest) {
            if (s.lastTest.positive) SFX.deny();
            else SFX.ok();
            banner(`TEST SANGUIN · ${nameOf(s.lastTest.target)} : ${s.lastTest.positive ? "POSITIF" : "NÉGATIF"}`, s.lastTest.positive ? "bad" : "ok");
          }
          break;
        case "radio":
          if (s.lastRadio !== null) {
            SFX.boot();
            banner(`CONTAMINÉS EN VIE : ${s.lastRadio}`, "bad");
          }
          break;
        case "confinement":
          if (a.on) {
            SFX.deny();
            setFlash(Date.now());
            banner("CONFINEMENT · PORTE COUPE-FEU FERMÉE", "bad");
          } else {
            SFX.door();
            banner("PORTE COUPE-FEU ROUVERTE", "ok");
          }
          break;
        case "exile":
          // Who leaves the base, never which side they were on.
          if (a.player) {
            const who = view.players.find((p) => p.id === a.player);
            SFX.deny();
            banner(`SUJET ${String(who?.room ?? 0).padStart(2, "0")} · ${(who?.name ?? "?").toUpperCase()} : EXILÉ`, "bad");
          }
          if (lockedNow)
            later(() => {
              doGlitch();
              SFX.deny();
              banner("PERTE DE CONFIANCE. CHEF DE MISSION ÉLIMINÉ SANS MOTIF. VERROUILLAGE GÉNÉRAL.", "bad");
            }, 2600);
          break;
        case "gesture":
          if (s.inventory.length > lastInventory.current) {
            // Something found: it shows in its hiding place, then flies to the group's slots.
            later(() => {
              SFX.ok();
              setFlyKey(Date.now());
              later(() => setFlyKey(0), 1500);
            }, 700);
          } else SFX.click();
          break;
        case "password":
          setTyping({ text: a.text.trim().toUpperCase(), ok: s.unlocked.includes(a.prop), key: Date.now() });
          later(() => (s.unlocked.includes(a.prop) ? SFX.ok() : SFX.deny()), 140 * a.text.trim().length + 200);
          break;
        case "unlock": {
          const door = def.doors.find((d) => d.id === a.door);
          const sd = STATION_DOORS.find((d) => d.id === a.door);
          if (door && sd && s.doors[a.door]) {
            setDoorAnim({ letter: sd.letter, dest: sd.b, withKey: !!door.requires, key: Date.now() });
            later(() => SFX.door(), door.requires ? 1500 : 600);
            later(() => setDoorAnim(null), door.requires ? 4600 : 3700);
          } else {
            SFX.deny();
            setFlash(Date.now());
            banner(door?.locked ? "ACCÈS REFUSÉ" : "PORTE VERROUILLÉE", "bad");
          }
          break;
        }
        case "reset": {
          // « Redémarrer la station »: a glitch, the reboot sound (or a beep), and the words.
          doGlitch();
          const el = soundOf("son-reboot");
          if (el) {
            el.currentTime = 0;
            void el.play().catch(() => undefined);
          } else SFX.boot();
          setReboot("");
          later(() => setReboot("REDÉMARRAGE DE LA STATION"), 700);
          later(() => setReboot(null), 2600);
          break;
        }
        case "reboot":
          doGlitch();
          setReboot("");
          later(() => setReboot(`${def.texts.reboot} 0${s.loop}`), 900);
          later(() => setReboot(null), 1500);
          break;
        default:
          break;
      }
    }
    // Only new gestures matter here; the state itself is drawn below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.version]);

  // ── The gauge of the generators ──
  // The server's clock, as seen from here: the gauge started by its time.
  const [offset] = useState(() => initial.now - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const gaugeLeft = s.gauge ? timeLeft(s.gauge, now + offset) : null;
  const mainLeft = s.timer ? timeLeft(s.timer, now + offset) : null;
  const gaugeDone = useRef<number | null>(null);
  useEffect(() => {
    if (s.gauge && gaugeLeft === 0 && gaugeDone.current !== s.gauge.endsAt) {
      gaugeDone.current = s.gauge.endsAt;
      SFX.zap();
      flicker([1, 0, 1, 1, 0.6, 1, 0], 200);
    }
  }, [gaugeLeft, s.gauge, flicker]);

  const night = s.phase === "night";
  // Before the game, the station on its own: its welcome image, or its plan; then the scenario loading.
  const protocol = protocolOf(s, now + offset);
  const stationPlan = s.phase === "welcome" && protocol === "none" && s.screen === "plan";
  const mapPhase = s.phase === "arrival" || s.phase === "day" || s.phase === "loopEnd" || stationPlan;
  // Arriving on the plan (the station's, or the base at the arrival): a short electronic chirp.
  const planArrived = (stationPlan || s.phase === "arrival") && !s.neutral && !s.terminal;
  const wasOnPlan = useRef(planArrived);
  useEffect(() => {
    if (planArrived && !wasOnPlan.current && !panel) SFX.plan();
    wasOnPlan.current = planArrived;
  }, [planArrived, panel]);
  // Délestage: the day's event in the game; any time on the station alone.
  const shedding = s.dark && (s.phase === "day" || stationPlan);
  const term = def.terminals.find((t) => t.id === s.terminal) ?? null;
  // Zoom on the terminal's place on the station's plan (by the room the scenario puts it in), or the electrical box.
  const zoom = term ? (SPOTS[term.room] ?? term.hot) : s.circuitShown ? SPOTS.circuit! : null;
  const event = view.events.find((e) => e.id === s.event) ?? null;
  // Until the meneur reveals them, the night's dead still look alive on the room's screen.
  const shownPlayers = s.revealed ? view.players : view.players.map((p) => (s.announced.includes(p.id) ? { ...p, status: "alive" as const } : p));
  const aliveCount = shownPlayers.filter((p) => p.status === "alive").length;

  return (
    <div className="pj" onMouseMove={() => document.body.dataset.cursor !== "on" && (document.body.dataset.cursor = "on")}>
      <div className={`pj-screen ${glitch ? "glitch" : ""}`}>
        {s.phase === "welcome" && protocol === "none" && s.screen === "accueil" && (
          <div className="pj-full" style={{ zIndex: 12, background: "#05080c" }}>
            {urlOf("image-accueil") && (
              // eslint-disable-next-line @next/next/no-img-element -- a local file of the projection computer
              <img src={urlOf("image-accueil")!} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            )}
            <p className="scn-vt relative text-[7cqw] tracking-[0.15em] text-[var(--scn-ice)] drop-shadow-[0_0_24px_rgba(127,216,255,.6)]">{def.base.name.toUpperCase()}</p>
          </div>
        )}
        {s.phase === "welcome" && protocol !== "none" && <Loading def={def} players={view.players.length} progress={Math.min(1, (now + offset - (s.loadingAt ?? 0)) / LOADING_MS)} ready={protocol === "ready"} />}

        {s.phase === "bus" && (
          <div className="pj-full" style={{ background: "radial-gradient(ellipse at 50% 120%, #10161f 0, #000 60%)" }}>
            <div className="absolute bottom-[12%] flex gap-[3cqw]">
              {["#ffb23e", "#5fe39a", "#ff4d4d", "#7fd8ff", "#ffb23e"].map((c, i) => (
                <span key={i} className="block h-[0.8cqw] w-[0.8cqw] rounded-full" style={{ background: c, boxShadow: `0 0 1.2cqw ${c}`, opacity: 0.7, animation: `pj-blink ${2 + i * 0.7}s steps(1) infinite` }} />
              ))}
            </div>
          </div>
        )}

        {(mapPhase || night) && (
          <>
            {!night && (
              <div className="pj-hud">
                <span className={glitch ? "alt" : ""}>{glitch ? `SIMULATION ALPHA — SESSION 0${s.loop} — SUJETS ACTIFS : ${aliveCount}` : def.header}</span>
                <span className="flex gap-[2.4em] opacity-85">
                  <Clock date={glitch ? (view.dates.real ?? def.realDate) : (view.dates.world ?? def.worldDate)} />
                  <Temperature around={def.temperature} />
                  {s.chief && <span>CHEF : {view.players.find((p) => p.id === s.chief)?.name.toUpperCase()}</span>}
                  <span className="pj-rec">● REC</span>
                </span>
              </div>
            )}
            <div className="pj-mapbox" style={zoom ? { transformOrigin: `${(zoom.x / STATION_W) * 100}% ${(zoom.y / STATION_H) * 100}%`, transform: "scale(2.6)", filter: "blur(3px) brightness(.45)" } : undefined}>
              <Plan
                players={shownPlayers}
                sealed={s.sealed}
                light={s.light}
                doors={s.doors}
                panicReady={s.panicReady}
                hot={{ hall: s.light && !term, beta: !!s.doors.beta && !term, securite: !!s.doors.securite && !term, labo: !!s.doors.labo && !term }}
                denied={denied}
                parity={(s.parity || s.confinement) && s.phase === "day"}
                confinement={s.confinement}
                at={s.at}
                overview={s.overview}
              />
            </div>
            <div className="pj-dark" style={{ opacity: darkOverride ?? (s.light && !shedding ? 0 : 1) }}>
              <Torch />
              <div className="msg">{shedding ? "— DÉLESTAGE · SEULE LA LAMPE ÉCLAIRE —" : "— SECTEUR NON ÉCLAIRÉ —"}</div>
            </div>
            {s.phase === "day" && <DayNotes view={view} />}
            {s.locked && !night && <div className="absolute top-[8.5%] left-[2.2%] z-[8] border border-[var(--scn-bad)] px-[1%] py-[0.3%] text-[1.2cqw] tracking-[0.25em] text-[var(--scn-bad)]">VERROUILLAGE GÉNÉRAL</div>}
            {s.chiefToConfirm && s.phase === "arrival" && s.chiefB1 && !term && (
              <div className="pj-intrusion" style={{ top: "30%", fontSize: "2.4cqw", textAlign: "center" }}>
                CHEF DE MISSION : {view.players.find((p) => p.id === s.chiefB1)?.name.toUpperCase()}.<br />
                CONFIRMER ?
              </div>
            )}
            {s.aurora && !night && <div className="pj-aurora" />}
            {s.blizzard && !night && <Snow />}
            {night && <div className="pj-full" style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(10,18,28,.6), #000 70%)", zIndex: 6 }} />}
            {term && !night && (
              <Crt
                term={term}
                playing={s.playing}
                faults={s.faults.map((f) => f.id)}
                bootKey={bootKey}
                urlOf={urlOf}
                recording={recording}
                recordedAt={recordedAt}
                files={view.files}
                registryLines={registry({ loop: s.loop, players: view.players, past: s.past })}
                onMedia={(el) => {
                  if (el) media.current = el;
                }}
                subtitlesOf={(slot) => {
                  const file = def.media.find((m) => m.id === slot)?.file;
                  return file ? (subtitles.get(keyOf(file.replace(/\.[^.]+$/, ".vtt"))) ?? null) : null;
                }}
                simulated={view.simulated}
              />
            )}
            {s.prop && !term && !night && (
              <PropScene
                key={s.prop}
                prop={s.prop}
                gestures={s.gestures}
                hides={def.sandbox?.hides ?? {}}
                notes={def.sandbox?.notes ?? {}}
                inventory={s.inventory}
                unlocked={s.unlocked.includes(s.prop)}
                typing={typing}
                boot={def.terminals.find((t) => t.id === "accueil")?.boot ?? ""}
                files={(def.terminals.find((t) => t.id === "accueil")?.files ?? []).filter((f) => !f.fault).map((f) => view.files[f.id]?.name || f.name)}
              />
            )}
            {def.sandbox && !night && <Inventory items={s.inventory.map((id) => ({ id, name: def.sandbox!.stash.find((x) => x.id === id)?.name ?? id }))} />}
            {s.circuitShown && !term && !night && <CircuitBox switches={s.switches} ready={s.panicReady} sparks={sparks} />}
            {!night && (
              <div className="pj-ticker">
                <span>{tickerText(def, s.phase, view.recent.at(-1)?.action)}</span>
                <span className="pj-cursor" />
              </div>
            )}
            {gaugeLeft !== null && !night && (
              <div className="absolute right-[2.2%] bottom-[8%] left-[2.2%] z-[7]">
                <p className="text-[1.3cqw] tracking-[0.2em] text-[var(--scn-amber)]">CARBURANT GÉNÉRATEURS · {Math.ceil(gaugeLeft / 60)} MIN</p>
                <div className="mt-[0.4%] h-[1.2cqw] border border-[var(--scn-amber)]">
                  <div className="h-full bg-[var(--scn-amber)] transition-[width] duration-500" style={{ width: `${(gaugeLeft / (s.gauge?.total ?? 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {event && s.phase === "day" && s.revealed && !announce && (
              // Big for a moment after dawn, then a small reminder at the top; never over a terminal or the box.
              <div className={`absolute left-1/2 z-[9] -translate-x-1/2 border border-[var(--scn-ice-dim)] bg-[rgba(5,8,12,.88)] text-center transition-all ${eventBig && !term && !s.circuitShown ? "top-[35%] px-[3%] py-[2%]" : "top-[8.5%] px-[1.5%] py-[0.4%]"}`}>
                <p className={`tracking-[0.2em] ${eventBig && !term && !s.circuitShown ? "text-[5cqw]" : "text-[1.6cqw]"}`}>{event.name.toUpperCase()}</p>
                <p className={eventBig && !term && !s.circuitShown ? "text-[2.2cqw] text-[var(--scn-txt)]" : "text-[1.2cqw] text-[var(--scn-muted)]"}>{event.rule}</p>
              </div>
            )}
          </>
        )}

        {announce && (
          <div className="pj-full" style={{ zIndex: 10, background: "rgba(0,0,0,.85)" }}>
            <p className="text-[2cqw] tracking-[0.3em] text-[var(--scn-muted)]">{announce.length ? "CETTE NUIT, SIGNAL PERDU :" : "CETTE NUIT, AUCUN SIGNAL PERDU"}</p>
            {announce.map((n) => (
              <p key={n} className="text-[6cqw] tracking-[0.15em] text-[var(--scn-blood-hi)] drop-shadow-[0_0_20px_rgba(208,24,28,.7)]">
                {n.toUpperCase()}
              </p>
            ))}
          </div>
        )}

        {tracker && (
          <div className="pj-intrusion" style={{ top: "14%", fontSize: "1.6cqw" }}>
            <p>SUIVI DES SUJETS — SESSION 0{s.loop}</p>
            <p className="mt-[1%] columns-3">
              {view.players.map((p) => (
                <span key={p.id} className="block">
                  S{String(p.room).padStart(2, "0")} · {p.name.toUpperCase()} · {p.status === "alive" ? "ACTIF" : "EXCLU"}
                </span>
              ))}
            </p>
            <p className="mt-[1%]">DERNIER EXCLU : {s.lastExiled?.toUpperCase() ?? "—"}</p>
            <p>DERNIÈRE VARIABLE CHOISIE : {s.lastEvent?.toUpperCase() ?? "—"}</p>
          </div>
        )}
        {faultShow?.kind === "image" && urlOf(faultShow.media) && (
          <div className="pj-full" style={{ zIndex: 11, background: "#000" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local file of the projection computer */}
            <img src={urlOf(faultShow.media)!} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {faultShow?.kind === "text" && faultShow.text && <Typed className="pj-intrusion" text={faultShow.text} />}
        {s.intrusion && <Typed className="pj-intrusion" text={s.intrusion} />}

        {s.phase === "good" && (
          <div className="pj-full" style={{ zIndex: 12, background: "radial-gradient(ellipse at 50% 40%, #fff1d6 0, #f2c98a 40%, #7a4f22 100%)" }}>
            <p className="text-[5cqw] tracking-[0.2em] text-[#3a2410]">{def.texts.goodEnd}</p>
          </div>
        )}
        {s.phase === "bad" && <BadEnd text={def.texts.badEnd} clues={view.clues} />}
        {reboot !== null && (
          <div className="pj-full" style={{ zIndex: 13, background: "#000" }}>
            <p className="text-[4cqw] tracking-[0.2em] text-[var(--scn-magenta)]" style={{ textShadow: "3px 0 var(--scn-cyan)" }}>
              {reboot}
            </p>
          </div>
        )}

        {s.vote && !s.neutral && view.status === "live" && (
          <VoteDoors def={def} view={view} left={mainLeft} />
        )}
        {mainLeft !== null && s.timer && !s.neutral && !s.vote && (
          <div className="absolute top-[9%] left-1/2 z-[12] -translate-x-1/2 border border-[var(--scn-amber)] bg-[rgba(5,8,12,.88)] px-[2%] py-[0.5%] text-center text-[var(--scn-amber)]">
            {s.timer.label && <p className="text-[1.3cqw] tracking-[0.25em]">{s.timer.label.toUpperCase()}</p>}
            <p className="text-[4.5cqw] leading-none tabular-nums">
              {Math.floor(mainLeft / 60)}:{String(Math.floor(mainLeft % 60)).padStart(2, "0")}
              {s.timer.endsAt === null && <span className="ml-[0.4em] text-[2cqw]">PAUSE</span>}
            </p>
          </div>
        )}
        {!!flyKey && <FlyingKey key={flyKey} to="slot" />}
        {doorAnim && <DoorOpening key={doorAnim.key} letter={doorAnim.letter} dest={doorAnim.dest} withKey={doorAnim.withKey} />}
        {s.neutral === "black" && <Waiting />}
        {!!flash && <div key={flash} className="pj-flash" />}
        {overlay && (
          <div key={overlay.key} className={`pj-banner ${overlay.tone}`}>
            {overlay.text}
          </div>
        )}
        {view.simulated && <div className="absolute top-[8%] right-[1%] z-[14] text-[1cqw] tracking-[0.3em] text-[var(--scn-magenta)] opacity-60">SIMULATION</div>}
        <div className="pj-fx pj-scan" />
        <div className="pj-fx pj-vig" />
      </div>

      {panel ? (
        <OperatorPanel
          def={def}
          wanted={wanted}
          files={files}
          subtitles={subtitleFiles.filter((f) => subtitles.has(keyOf(f)))}
          mic={mic}
          onPick={async (list) => {
            await keepFiles(list, new Set([...wanted, ...subtitleFiles].map(keyOf)));
            await reload();
          }}
          onForget={async () => {
            await forgetFiles();
            await reload();
          }}
          onMic={async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach((t) => t.stop());
              setMic(true);
            } catch {
              setMic(false);
            }
          }}
          onStart={async () => {
            audio();
            try {
              await document.documentElement.requestFullscreen();
            } catch {
              // Fullscreen refused: the page still works in a window.
            }
            setPanel(false);
          }}
        />
      ) : (
        <button type="button" aria-label="Réglages de la projection" className="fixed right-2 bottom-2 z-50 h-8 w-8 rounded-full text-xs text-[var(--scn-ice-faint)] opacity-30 hover:opacity-100" onClick={() => setPanel(true)}>
          ⚙
        </button>
      )}
    </div>
  );
}

/** « Chargement du scénario : SANG-FROID »: what the room sees while the meneur loads the game into the station. */
function Loading({ def, players, progress, ready }: { def: PublicScenario; players: number; progress: number; ready: boolean }) {
  const pct = Math.floor(progress * 100);
  const checks: [string, string, boolean][] = [
    ["VÉRIFICATION DES SUJETS", `${players}/${players}`, progress > 0.25],
    ["CARTOGRAPHIE DE LA BASE", `${def.doors.length + 1} ZONES`, progress > 0.5],
    ["PROTOCOLE ALPHA", "CHIFFRÉ", progress > 0.72],
    ["LIAISON SATELLITE", "ÉCHEC", progress > 0.9],
  ];
  return (
    <div className="pj-full scn-vt" style={{ zIndex: 12, background: "radial-gradient(ellipse at 50% 40%, #0c1a24 0%, #05080c 70%)", alignItems: "stretch", justifyContent: "center", gap: "2.2cqw", padding: "0 9cqw", color: "#bfeaff" }}>
      <div className="absolute top-[3%] right-[2.5%] left-[2.5%] flex justify-between text-[1.7cqw] text-[var(--scn-muted)]">
        <span>NORDATA · BIOS v1.04 · (C) 1986</span>
        <span>{def.base.name.toUpperCase()}</span>
      </div>
      <p className="text-[2.7cqw] text-[var(--scn-ice)]">{ready ? "SCÉNARIO CHARGÉ :" : "CHARGEMENT DU SCÉNARIO :"}</p>
      <p className="text-[13cqw] leading-[0.8] text-[#e6f2fa]" style={{ textShadow: "0 0 2.6cqw rgba(127,216,255,.5)" }}>
        {(def.short ?? def.title).toUpperCase()}
      </p>
      <div className="flex items-center gap-[2cqw]">
        <div className="h-[2cqw] flex-1 border-2 border-[var(--scn-ice)] p-[0.25cqw]">
          <div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: "repeating-linear-gradient(90deg, #7fd8ff 0 1.4cqw, transparent 1.4cqw 1.7cqw)" }} />
        </div>
        <span className="w-[8cqw] text-right text-[3.1cqw] text-[#e6f2fa]">{pct} %</span>
      </div>
      <div className="flex flex-col gap-[0.3cqw] text-[2cqw] text-[var(--scn-muted)]">
        {checks.map(([label, value, shown]) => (
          <span key={label} style={{ visibility: shown ? "visible" : "hidden" }}>
            {label} {".".repeat(Math.max(3, 34 - label.length))}{" "}
            {value === "ÉCHEC" || value === "CHIFFRÉ" ? (
              <span style={{ color: value === "ÉCHEC" ? "#ff6b6b" : "#ffb23e" }}>{value}</span>
            ) : (
              <>
                {value} <span style={{ color: "#5fe39a" }}>OK</span>
              </>
            )}
          </span>
        ))}
        {ready && <span className="text-[var(--scn-amber)]">EN ATTENTE DU LANCEMENT<span className="pj-cursor" /></span>}
      </div>
    </div>
  );
}

/** What the bottom line says after a gesture: the base's own voice, never a secret. */
function tickerText(def: PublicScenario, phase: string, a: Action | undefined): string {
  if (phase === "night") return "VEILLE NOCTURNE · CAPTEURS EN VEILLE";
  if (!a) return "ALIMENTATION DE SECOURS · CAPTEURS EN VEILLE";
  switch (a.t) {
    case "light":
      return a.on ? "ÉCLAIRAGE HALL : RÉTABLI" : "ÉCLAIRAGE HALL : COUPÉ";
    case "cut":
      return "GÉNÉRATEUR B : CHUTE DE TENSION";
    case "door": {
      const d = def.doors.find((x) => x.id === a.door);
      if (!d) return "";
      if (d.locked) return `PORTE ${d.letter} : TENTATIVE D'ACCÈS NON AUTORISÉE`;
      return `PORTE ${d.letter} ${d.label.toUpperCase()} : ${a.open ? "OUVERTE" : "FERMÉE"}`;
    }
    case "terminal":
      return a.id ? `TERMINAL ${def.terminals.find((t) => t.id === a.id)?.label.toUpperCase() ?? ""} : SESSION OUVERTE` : "RETOUR AU PLAN";
    case "power":
      return "BOÎTIER PANIC ROOM : MISE SOUS TENSION";
    case "circuit":
      return a.show ? "BOÎTIER PANIC ROOM : CAPOT RETIRÉ" : "RETOUR AU PLAN";
    case "blizzard":
      return a.on ? "VENT EXTÉRIEUR : 140 KM/H · VISIBILITÉ NULLE" : "BLIZZARD : ACCALMIE";
    case "glitch":
    case "fault":
      return "ANOMALIE AFFICHAGE · 0,6 S";
    case "dawn":
      return "JOUR · REPRISE DES CAPTEURS";
    case "dayAction":
    case "voteResult":
      return "ACCÈS ENREGISTRÉ · SECTEUR OUVERT";
    case "labForce":
      return "PORTE Η : OUVERTURE NON AUTORISÉE";
    case "radio":
      return "RADIO : BALAYAGE DES FRÉQUENCES";
    case "bloodTest":
      return "INFIRMERIE : ANALYSE TERMINÉE";
    case "confinement":
      return a.on ? "CONFINEMENT : PORTE COUPE-FEU FERMÉE" : "CONFINEMENT : LEVÉ";
    default:
      return "SURVEILLANCE ACTIVE";
  }
}

function Clock({ date }: { date: string }) {
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(t0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // The evening's real hour (Arthur, 26/11/2026), on the world's date.
  const d = new Date(now);
  return (
    <span>
      {date} {d.toLocaleTimeString("fr-FR")}
    </span>
  );
}

/**
 * The day's public facts, in a corner until nightfall: the quarantine, the blood test, the radio. Stop
 * and the neutral screen leave them (they come back with the plan); only the night or Annuler clears them.
 */
function DayNotes({ view }: { view: ProjectionView }) {
  const s = view.state;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name.toUpperCase() ?? "?";
  const notes = [
    s.quarantine.length ? { key: "q", text: `QUARANTAINE : ${s.quarantine.map(name).join(", ")}`, tone: "var(--scn-ice)" } : null,
    s.lastTest ? { key: "t", text: `TEST SANGUIN · ${name(s.lastTest.target)} : ${s.lastTest.positive ? "POSITIF" : "NÉGATIF"}`, tone: s.lastTest.positive ? "var(--scn-bad)" : "var(--scn-ok)" } : null,
    s.lastRadio !== null ? { key: "r", text: `CONTAMINÉS EN VIE : ${s.lastRadio}`, tone: "var(--scn-amber)" } : null,
  ].filter((n): n is { key: string; text: string; tone: string } => !!n);
  if (!notes.length) return null;
  return (
    <div className="absolute top-[64%] left-[2.2%] z-[8] flex max-w-[30%] flex-col items-start gap-[0.4cqw]" aria-label="Le jour">
      {notes.map((n) => (
        <p key={n.key} className="border bg-[rgba(5,8,12,.88)] px-[0.7cqw] py-[0.2cqw] text-[1.05cqw] tracking-[0.15em]" style={{ color: n.tone, borderColor: n.tone }}>
          {n.text}
        </p>
      ))}
    </div>
  );
}

/** The outside temperature, wavering a degree or two around the scenario's. */
function Temperature({ around }: { around: number }) {
  const [t, setT] = useState(around);
  useEffect(() => {
    const timer = setInterval(() => Math.random() < 0.2 && setT(around - 2 + Math.floor(Math.random() * 5)), 1000);
    return () => clearInterval(timer);
  }, [around]);
  return <span>EXT {t < 0 ? `−${-t}` : t} °C</span>;
}

/**
 * The vote by moving: two doors side by side (or the candidates of the election), each with its name
 * and a sentence, and the chrono. The same screen for a door of the day, the dead's moment, the chief.
 */
function VoteDoors({ def, view, left }: { def: PublicScenario; view: ProjectionView; left: number | null }) {
  const vote = view.state.vote!;
  const options = vote.options.map((id) => {
    if (vote.kind === "chief") return { id, name: view.players.find((p) => p.id === id)?.name ?? id, sentence: "" };
    if (vote.kind === "dead") {
      const e = view.events.find((x) => x.id === id);
      return { id, name: e?.name ?? id, sentence: e?.rule ?? "" };
    }
    if (id === "fouiller") return { id, name: "Fouiller ce qu'on connaît déjà", sentence: "Revenir sur ses pas : rien de neuf, peut-être.", letter: "" };
    const a = def.dayActions.find((x) => x.id === id);
    const door = def.doors.find((d) => d.id === a?.zone);
    return { id, name: a?.label ?? id, sentence: a?.sentence ?? "", letter: door?.letter ?? "" };
  });
  const title = vote.kind === "chief" ? "IDENTIFICATION DU CHEF DE MISSION REQUISE" : vote.kind === "dead" ? "LES MORTS CHOISISSENT" : "CHOIX DE LA PORTE";
  const paused = view.state.timer?.endsAt === null;
  // The day's door: drawn as the base's doors (their Greek letter on the leaves), left half and right half of the room.
  if (vote.kind === "door")
    return (
      <div className="pj-full" style={{ zIndex: 11, background: "rgba(3,6,10,.92)", flexDirection: "column", gap: "2.5%" }}>
        <p className="text-[2.2cqw] tracking-[0.3em] text-[var(--scn-ice)]">{title}</p>
        <div className="flex w-[86%] items-end justify-center gap-[6cqw]">
          {options.map((o, i) => (
            <div key={o.id} className="flex w-[34%] flex-col items-center gap-[0.8cqw] text-center">
              <p className="text-[1.4cqw] tracking-[0.35em] text-[var(--scn-muted)]">{options.length === 2 ? (i === 0 ? "◀ À GAUCHE" : "À DROITE ▶") : `PORTE ${"ABC"[i]}`}</p>
              <svg viewBox="0 0 240 300" className="w-[70%]" aria-hidden>
                <rect x="6" y="6" width="228" height="288" fill="#0a1117" stroke="#2c4252" strokeWidth="10" />
                {o.letter ? (
                  <>
                    <rect x="16" y="16" width="104" height="272" fill="#16232d" stroke="#3f6f88" strokeWidth="4" />
                    <rect x="120" y="16" width="104" height="272" fill="#16232d" stroke="#3f6f88" strokeWidth="4" />
                    <text x="108" y="170" textAnchor="end" fontFamily="var(--scn-font-vt)" fontSize="72" fill="#7fd8ff">
                      {o.letter}
                    </text>
                    <circle cx="136" cy="160" r="9" fill="#0a1117" stroke="#5fe39a" strokeWidth="3" />
                  </>
                ) : (
                  <>
                    <rect x="16" y="16" width="208" height="272" fill="#0c1820" />
                    <circle cx="112" cy="140" r="40" fill="none" stroke="#7fd8ff" strokeWidth="8" />
                    <line x1="140" y1="168" x2="182" y2="210" stroke="#7fd8ff" strokeWidth="12" strokeLinecap="round" />
                  </>
                )}
              </svg>
              <p className="text-[2.4cqw] leading-tight tracking-[0.08em] text-[var(--scn-txt)]">{o.name.toUpperCase()}</p>
              {o.sentence && <p className="text-[1.4cqw] text-[var(--scn-muted)]">{o.sentence}</p>}
            </div>
          ))}
        </div>
        {left !== null && (
          <p className="text-[4.5cqw] leading-none tabular-nums text-[var(--scn-amber)]">
            {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, "0")}
            {paused && <span className="ml-[0.4em] text-[2cqw]">PAUSE</span>}
          </p>
        )}
      </div>
    );
  return (
    <div className="pj-full" style={{ zIndex: 11, background: "rgba(3,6,10,.9)", flexDirection: "column", gap: "3%" }}>
      <p className="text-[2.2cqw] tracking-[0.3em] text-[var(--scn-ice)]">{title}</p>
      <div className={`flex w-[88%] justify-center ${options.length > 3 ? "flex-wrap gap-[1.2cqw]" : "gap-[4cqw]"}`}>
        {options.map((o, i) => (
          <div
            key={o.id}
            className={`flex flex-col items-center border-2 border-[var(--scn-ice-dim)] bg-[rgba(10,20,30,.85)] text-center ${options.length > 3 ? "w-[17%] p-[0.8%]" : "min-h-[22cqw] w-[30%] justify-between p-[2%]"}`}
            style={{ boxShadow: "inset 0 0 2cqw rgba(127,216,255,.12)" }}
          >
            {options.length <= 3 && <p className="text-[1.4cqw] tracking-[0.3em] text-[var(--scn-muted)]">PORTE {"ABC"[i]}</p>}
            <p className={`${options.length > 3 ? "text-[1.6cqw]" : "text-[3cqw]"} tracking-[0.1em] text-[var(--scn-txt)]`}>{o.name.toUpperCase()}</p>
            {o.sentence && <p className="text-[1.5cqw] text-[var(--scn-muted)]">{o.sentence}</p>}
          </div>
        ))}
      </div>
      {left !== null && (
        <p className="text-[5cqw] leading-none tabular-nums text-[var(--scn-amber)]">
          {Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, "0")}
          {paused && <span className="ml-[0.4em] text-[2cqw]">PAUSE</span>}
        </p>
      )}
    </div>
  );
}

/** The torch beam wandering in the dark. */
function Torch() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let k = 0;
    const step = () => {
      k += 0.006;
      const parent = ref.current?.parentElement;
      if (parent) {
        parent.style.setProperty("--tx", `${50 + Math.sin(k * 1.3) * 9 + Math.sin(k * 3.1) * 2.5}%`);
        parent.style.setProperty("--ty", `${70 + Math.cos(k * 1.1) * 8}%`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={ref} />;
}

function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const flakes = Array.from({ length: 420 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, v: Math.random() * 0.6 + 0.4 }));
    let raf = 0;
    const step = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      ctx.fillStyle = "rgba(230,245,255,.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(235,248,255,.75)";
      for (const f of flakes) {
        f.x += 0.006 * f.v;
        f.y += 0.003 * f.v;
        if (f.x > 1) f.x -= 1.1;
        if (f.y > 1) f.y -= 1;
        ctx.lineWidth = f.s;
        ctx.beginPath();
        ctx.moveTo(f.x * canvas.width, f.y * canvas.height);
        ctx.lineTo(f.x * canvas.width - 14 * f.v, f.y * canvas.height - 7 * f.v);
        ctx.stroke();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pj-fx" style={{ zIndex: 5, width: "100%", height: "100%" }} />;
}

/** Words that appear letter by letter (the rebel's intrusion, a text fault). */
function Typed({ text, className }: { text: string; className: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restarts the typing for a new text
    setN(0);
    const timer = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 45);
    return () => clearInterval(timer);
  }, [text]);
  return (
    <div className={className}>
      {text.slice(0, n)}
      <span className="pj-cursor" style={{ background: "var(--scn-cyan)" }} />
    </div>
  );
}

/** A terminal of 1988: it boots, lists its files, and plays one on its tube. */
/** Whole minutes since a moment, at least one (read when the terminal draws its list). */
function minutesSince(at: number): number {
  return Math.max(1, Math.round((Date.now() - at) / 60_000));
}

function Crt({
  term,
  playing,
  faults,
  bootKey,
  urlOf,
  recording,
  recordedAt,
  files: shown,
  registryLines,
  subtitlesOf,
  simulated,
  onMedia,
}: {
  term: Terminal;
  playing: string | null;
  faults: string[];
  bootKey: number;
  urlOf: (slot: string | undefined) => string | null;
  recording: React.RefObject<string | null>;
  recordedAt: React.RefObject<number | null>;
  files: ProjectionView["files"];
  registryLines: string[];
  subtitlesOf: (slot: string | undefined) => string | null;
  simulated: boolean;
  onMedia: (el: HTMLMediaElement | null) => void;
}) {
  // What the preparation says the files are called and dated (the lore isn't fixed yet).
  // The room's own recording carries the real time it was made, and how long ago.
  const at = recordedAt.current;
  const recTime = at ? new Date(at).toLocaleTimeString("fr-FR") : null;
  const recAgo = at ? `00:30   IL Y A ${minutesSince(at)} MIN` : null;
  const files = term.files
    .filter((f) => !f.fault || faults.includes(f.fault))
    .map((f) => ({ ...f, name: shown[f.id]?.name || f.name, date: shown[f.id]?.date || f.date, ...(f.kind === "recording" && recTime && recAgo ? { time: recTime, meta: recAgo } : {}) }));
  const list = files.map((f) => `${f.id === playing ? "> " : "  "}${f.name.padEnd(18)} ${shown[f.id]?.date ? shown[f.id]?.date : f.meta}`).join("\n");
  const [typed, setTyped] = useState(bootKey ? 0 : term.boot.length);
  useEffect(() => {
    if (!bootKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the boot text types itself again on a new session
    setTyped(0);
    const timer = setInterval(() => setTyped((x) => (x >= term.boot.length ? x : x + 2)), 18);
    return () => clearInterval(timer);
  }, [bootKey, term.boot.length]);
  const file = files.find((f) => f.id === playing) ?? null;
  return (
    <div className="pj-crt">
      <div className="pj-bezel">
        <div className="pj-tube">
          {!file && (
            <div className="pj-txt">
              {term.boot.slice(0, typed)}
              {typed >= term.boot.length && (
                <>
                  {list}
                  {"\n\n"}
                  <span style={{ opacity: 0.7 }}>EN ATTENTE…</span>
                </>
              )}
            </div>
          )}
          {file && (file.kind === "text" || file.kind === "registry") && (
            <TypedFile key={`${term.id}-${file.id}`} lines={file.kind === "registry" ? registryLines : (shown[file.id]?.text || "[Rapport du protocole Alpha — à écrire]").split("\n")} byLine={file.kind === "registry"} />
          )}
          {file && file.kind !== "text" && file.kind !== "registry" && (
            <Tape
              key={`${term.id}-${file.id}`}
              file={file}
              url={file.kind === "recording" ? (recording.current ?? urlOf(file.media) ?? (simulated ? silence() : null)) : urlOf(file.media)}
              cassetteFilter={file.kind === "recording" && !!recording.current}
              cues={parseCues(shown[file.id]?.subs ?? subtitlesOf(file.media) ?? "")}
              simulated={simulated}
              onMedia={onMedia}
            />
          )}
        </div>
        <div className="pj-brand">NORDATA · MODÈLE 286</div>
        <div className="pj-led" />
      </div>
    </div>
  );
}

function Tape({
  file,
  url,
  cassetteFilter,
  cues,
  simulated,
  onMedia,
}: {
  file: Terminal["files"][number];
  url: string | null;
  cassetteFilter: boolean;
  cues: Cue[];
  simulated: boolean;
  onMedia: (el: HTMLMediaElement | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const [line, setLine] = useState("");
  // The end of a tape, like a real VCR: a second of snow and its hiss, then the stopped tape's black
  // screen (« ■ STOP », « FIN DE BANDE »), instead of a frozen last frame. Playing again brings it back.
  const [end, setEnd] = useState<"no" | "snow" | "stop">("no");
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (endTimer.current && clearTimeout(endTimer.current)), []);
  const onEnded = () => {
    setEnd("snow");
    SFX.snow();
    endTimer.current = setTimeout(() => setEnd("stop"), 1000);
  };
  const onPlay = () => {
    if (endTimer.current) clearTimeout(endTimer.current);
    setEnd("no");
  };
  // A video that stalls (the decoder chokes now and then on a long file): when the picture hasn't moved
  // for about 1.5 s while it should play, step back a quarter of a second and play on — the meneur's
  // « −10 s » trick, done for them, without a visible jump.
  useEffect(() => {
    if (!url || file.kind !== "video") return;
    let last = -1;
    let still = 0;
    const watch = setInterval(() => {
      const el = videoEl.current;
      if (!el || el.paused || el.ended || el.seeking) {
        still = 0;
        last = el?.currentTime ?? -1;
        return;
      }
      if (el.currentTime === last) {
        still += 1;
        if (still >= 2) {
          el.currentTime = Math.max(0, el.currentTime - 0.25);
          void el.play().catch(() => undefined);
          still = 0;
        }
      } else still = 0;
      last = el.currentTime;
    }, 750);
    return () => clearInterval(watch);
  }, [url, file.kind]);
  const follow = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const t = e.currentTarget.currentTime;
    setLine(cues.find((c) => t >= c.start && t < c.end)?.text ?? "");
  };
  useEffect(() => {
    if (!url || (file.kind !== "audio" && file.kind !== "recording")) return;
    const el = audioEl.current;
    if (!el) return;
    const chain = cassetteFilter ? cassette(el) : null;
    const analyser = chain?.analyser ?? null;
    void el.play().catch(() => undefined);
    const data = new Uint8Array(analyser?.fftSize ?? 512);
    let raf = 0;
    let k = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        c.width = 640;
        c.height = 480;
        ctx.fillStyle = "#0b0700";
        ctx.fillRect(0, 0, 640, 480);
        ctx.strokeStyle = "#ffb23e";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ffb23e";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        if (analyser) analyser.getByteTimeDomainData(data);
        k += 0.2;
        for (let x = 0; x < 640; x += 4) {
          const v = analyser ? ((data[Math.floor((x / 640) * data.length)] ?? 128) - 128) * 1.6 : Math.sin(x * 0.05 + k) * Math.sin(x * 0.013 + k / 4) * (el.paused ? 4 : 60);
          ctx.lineTo(x, 240 + v);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      el.pause();
      chain?.stop();
    };
  }, [url, file.kind, cassetteFilter]);

  if (!url)
    return simulated ? (
      <div className="pj-txt">{`${file.name}\n${file.date}  ${file.time}\n\n[ MÉDIA ABSENT ]\nSimulation : le fichier n'est pas sur cet ordinateur.`}</div>
    ) : (
      <div className="pj-txt">{`${file.name}\n\nERREUR DE LECTURE\nBANDE ENDOMMAGÉE`}</div>
    );
  return (
    <>
      {file.kind === "video" && (
        <video
          ref={(el) => {
            videoEl.current = el;
            onMedia(el);
          }}
          src={url}
          autoPlay
          playsInline
          preload="auto"
          onTimeUpdate={follow}
          onEnded={onEnded}
          onPlay={onPlay}
        />
      )}
      {file.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- a local file of the projection computer
        <img src={url} alt="" />
      )}
      {(file.kind === "audio" || file.kind === "recording") && (
        <>
          <canvas ref={canvas} />
          <audio
            ref={(el) => {
              audioEl.current = el;
              onMedia(el);
            }}
            src={url}
            onTimeUpdate={follow}
            onEnded={onEnded}
            onPlay={onPlay}
          />
        </>
      )}
      {end === "snow" && <Snowfield />}
      {end === "stop" && (
        <div className="pj-tapestop">
          <span>FIN DE BANDE</span>
        </div>
      )}
      {file.kind !== "image" && (
        <div className="pj-vhs">
          <div className="tl">{end !== "no" ? "■ STOP" : file.kind === "video" ? "▶ PLAY" : "▶ LECTURE AUDIO"}</div>
          <div className="tr">{file.date}</div>
          <div className="bl">{file.time}</div>
          {end === "no" && (line || (!cues.length && file.subs[0])) && <div className="sub">{line || file.subs[0]}</div>}
          {end === "no" && <div className="track" />}
        </div>
      )}
    </>
  );
}

/** The panic room's box: the switches the players dictate, the current that reaches (or not) the lock. */
function CircuitBox({ switches, ready, sparks }: { switches: [boolean, boolean, boolean, boolean]; ready: boolean; sparks: number }) {
  const [a, b, c, d] = switches;
  const live = new Set<string>(["w0"]);
  if (a) {
    live.add("wA2").add("w1");
    if (c) {
      live.add("w2").add("wC2");
      if (d) live.add("w3");
    }
  }
  if (b) live.add("wB");
  const cls = (id: string) => `wire ${ready && id !== "wB" ? "done" : live.has(id) ? "live" : ""}`;
  return (
    <div className="pj-circ">
      <div className="pj-plate">
        <div className="hd">
          <span>BOÎTIER D&apos;ACCÈS · PANIC ROOM</span>
          <span style={{ color: ready ? "var(--scn-ok)" : "var(--scn-bad)" }}>{ready ? "SOUS TENSION" : "HORS TENSION"}</span>
        </div>
        <svg viewBox="0 0 1000 420" style={{ width: "100%", display: "block" }}>
          <g fontFamily="var(--scn-font-vt)">
            <text x="40" y="40" fill="#7f93a3" fontSize="24" letterSpacing="3">
              ALIM. GÉNÉRATEUR B · 220 V
            </text>
            <text x="960" y="40" fill="#7f93a3" fontSize="24" letterSpacing="3" textAnchor="end">
              SERRURE MAGNÉTIQUE
            </text>
          </g>
          <rect x="40" y="170" width="80" height="80" rx="8" fill="#1d252c" stroke="#ffb23e" strokeWidth="3" />
          <text x="80" y="220" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="34" fill="#ffb23e">
            ⚡
          </text>
          <circle cx="900" cy="210" r="44" fill={ready ? "#5fe39a" : "#2a1214"} stroke="#5b6873" strokeWidth="3" />
          <text x="900" y="290" textAnchor="middle" fontFamily="var(--scn-font-vt)" fontSize="24" fill="#7f93a3" letterSpacing="2">
            VERROU
          </text>
          <path className={cls("w0")} d="M120 210 H220" />
          <path className={cls("w1")} d="M300 110 H400 V310 H460" />
          <path className={cls("w2")} d="M540 310 H600" />
          <path className={cls("w3")} d="M680 210 H760" />
          <path className={ready ? "wire done" : "wire"} d="M760 210 H856" />
          <path className={cls("wB")} d="M300 310 H340 V110" strokeDasharray="6 8" />
          {(["A", "B", "C", "D"] as const).map((k, i) => {
            const [x, y] = [
              [220, 210],
              [220, 310],
              [460, 310],
              [600, 210],
            ][i]!;
            return (
              <g key={k} transform={`translate(${x},${y})`}>
                <rect className="swbody" x="0" y="-40" width="80" height="80" rx="8" />
                <line className="swlever" x1="40" y1="0" x2="40" y2={switches[i] ? -34 : 34} />
                <text className="swlab" x="40" y="70" textAnchor="middle">
                  {k}
                </text>
              </g>
            );
          })}
          <path className={cls("wA2")} d="M300 210 H300 V110" />
          <path className={cls("wC2")} d="M600 310 V210" />
          <g key={sparks} className={sparks ? "sparks" : ""}>
            {[
              [-40, -50, 5],
              [50, -30, 4],
              [20, -70, 3],
              [-60, 10, 4],
              [60, 20, 3],
            ].map(([dx, dy, r], i) => (
              <circle key={i} className="sp" cx="500" cy="270" r={r} opacity={0} style={{ "--dx": `${dx}px`, "--dy": `${dy}px` } as React.CSSProperties} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** « Fin de session »: then every clue they missed scrolls by, so everyone understands the story. */
function BadEnd({ text, clues }: { text: string; clues: { at: string; text: string }[] }) {
  return (
    <div className="pj-full overflow-hidden" style={{ zIndex: 12, background: "#000" }}>
      <p className="text-[4cqw] tracking-[0.2em] text-[var(--scn-blood-hi)]">{text}</p>
      <div className="relative mt-[3%] h-[60%] w-[70%] overflow-hidden">
        <div className="pj-scroll absolute inset-x-0" style={{ animationDuration: `${Math.max(20, clues.length * 7)}s`, animationDelay: "4s", transform: "translateY(60%)" }}>
          <p className="mb-[3%] text-[2cqw] tracking-[0.2em] text-[var(--scn-muted)]">CE QUE VOUS AVEZ MANQUÉ</p>
          {clues.map((c, i) => (
            <p key={i} className="mb-[2.5%] text-[2.2cqw] text-[var(--scn-ice)]">
              <span className="text-[var(--scn-magenta)]">{c.at}</span> — {c.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The projection computer's own settings: its folder of media, its microphone, full screen. */
function OperatorPanel({
  def,
  wanted,
  files,
  subtitles,
  mic,
  onPick,
  onForget,
  onMic,
  onStart,
}: {
  def: PublicScenario;
  wanted: string[];
  files: Map<string, string>;
  subtitles: string[];
  mic: boolean;
  onPick: (files: File[]) => Promise<void>;
  onForget: () => Promise<void>;
  onMic: () => Promise<void>;
  onStart: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  /** The folder's media files that match nothing the scenario asks for: shown with their real name, to spot a typo or a hidden extension. */
  const [unknown, setUnknown] = useState<string[]>([]);
  const ready = wanted.filter((f) => files.has(keyOf(f))).length;
  // Whether this browser can pick a folder; the server assumes it can, so nothing flashes.
  const folders = useSyncExternalStore(
    () => () => undefined,
    () => "webkitdirectory" in document.createElement("input"),
    () => true,
  );
  // The scenario's own files say whether they're needed (the sounds aren't); an organizer's fault media always are.
  const required = (f: string) => {
    const slot = def.media.find((m) => m.file === f);
    return slot ? !!slot.required : true;
  };
  return (
    <div className="scn-veil fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="scn-sec max-h-[92dvh] w-full max-w-xl overflow-y-auto p-5">
        <p className="scn-vt text-3xl text-[var(--scn-ice)]">PROJECTION · {def.title.toUpperCase()}</p>
        <p className="mt-1 text-sm text-[var(--scn-muted)]">
          À faire une fois sur cet ordinateur, avant la soirée. Les médias restent ici : rien n&apos;est envoyé au CLHUB.
        </p>
        <p className="scn-head mt-4">
          MÉDIAS · {ready} / {wanted.length}
        </p>
        {!folders && <p className="mt-2 rounded-lg border border-[var(--scn-bad)] p-2 text-sm text-[var(--scn-bad)]">Ce navigateur ne peut pas lire le dossier des médias : utilisez Chrome ou Edge.</p>}
        <label className="scn-btn scn-btn-primary mt-2 flex cursor-pointer items-center justify-center">
          {busy ? "Lecture du dossier…" : "Choisir le dossier des médias"}
          <input
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error -- non-standard but supported everywhere: pick a whole folder
            webkitdirectory=""
            onChange={async (e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = "";
              const keys = new Set(wanted.map(keyOf));
              setUnknown(list.filter((f) => MEDIA_FORMATS.test(f.name) && !keys.has(keyOf(f.name))).map((f) => f.name));
              setBusy(true);
              await onPick(list).catch(() => undefined);
              setBusy(false);
            }}
          />
        </label>
        <ul className="mt-2 grid grid-cols-1 gap-0.5 text-xs sm:grid-cols-2">
          {wanted.map((f) => (
            <li key={f} className={files.has(keyOf(f)) ? "text-[var(--scn-ok)]" : required(f) ? "text-[var(--scn-amber)]" : "text-[var(--scn-muted)]"}>
              {files.has(keyOf(f)) ? "✓" : "·"} {keyOf(f)} <span className="opacity-60">{required(f) ? "obligatoire" : "facultatif"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-[var(--scn-muted)]">Seul le nom compte, pas le format : les sons peuvent être en .mp3, .aac, .m4a, .ogg ou .wav, les vidéos en .mp4, .webm ou .mov, les images en .jpg ou .png.</p>
        {subtitles.length > 0 && <p className="mt-1 text-xs text-[var(--scn-ok)]">Sous-titres : {subtitles.join(", ")}</p>}
        {unknown.length > 0 && (
          <p className="mt-1 text-xs text-[var(--scn-amber)]">
            Dans le dossier mais pas reconnus (vérifiez le nom) : {unknown.slice(0, 12).join(", ")}
            {unknown.length > 12 ? `… et ${unknown.length - 12} autres` : ""}
          </p>
        )}
        {files.size > 0 && (
          <button type="button" className="mt-1 py-1 text-xs text-[var(--scn-muted)] underline" onClick={() => void onForget()}>
            Oublier les médias de cet ordinateur
          </button>
        )}
        <p className="scn-head mt-4">MICRO</p>
        <button type="button" className={`scn-btn mt-2 w-full ${mic ? "scn-btn-on" : ""}`} onClick={() => void onMic()}>
          {mic ? "Micro autorisé ✓" : "Autoriser le micro"}
          <small>pour « Enregistrer 30 s » : l&apos;enregistrement reste dans cette page et disparaît à sa fermeture</small>
        </button>
        <button type="button" className="scn-btn scn-btn-primary mt-5 min-h-14 w-full text-base" onClick={() => void onStart()}>
          Lancer la projection
          <small>plein écran et son ; ⚙ en bas à droite pour revenir ici</small>
        </button>
      </div>
    </div>
  );
}

let silent: string | null = null;
/** For a simulation with no microphone: 30 seconds of silence stand in for the room's recording. */
function silence(): string {
  if (silent) return silent;
  const rate = 8000;
  const samples = rate * 30;
  const buffer = new ArrayBuffer(44 + samples);
  const v = new DataView(buffer);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  w(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  silent = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silent;
}

/** A text file or the subjects' registry, typed on the tube (letter by letter, or line by line), scrolling. */
function TypedFile({ lines, byLine }: { lines: string[]; byLine: boolean }) {
  const all = lines.join("\n");
  const [n, setN] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setN((x) => {
          if (x >= all.length) return x;
          if (!byLine) return x + 2;
          const next = all.indexOf("\n", x + 1);
          return next === -1 ? all.length : next + 1;
        }),
      byLine ? 220 : 28,
    );
    return () => clearInterval(timer);
  }, [all, byLine]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [n]);
  return (
    <div ref={box} className="pj-txt overflow-hidden" style={{ fontSize: byLine ? "1.05cqw" : undefined }}>
      {all.slice(0, n)}
      <span className="pj-cursor" style={{ background: "var(--scn-amber)" }} />
    </div>
  );
}

/**
 * « En attente de connexion »: the screen the meneur keeps in reserve (it used to be plain black). Dark,
 * quiet, but alive: the base is trying to reach someone.
 */
function Waiting() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pj-full flex-col gap-[1.6cqw] text-center" style={{ zIndex: 20, background: "#020304" }}>
      <p className="scn-vt text-[1.6cqw] tracking-[0.4em] text-[#3f6f88]">NORDATA · LIAISON SATELLITE</p>
      <p className="scn-vt text-[4.2cqw] tracking-[0.18em] text-[var(--scn-ice)] drop-shadow-[0_0_18px_rgba(127,216,255,.35)]">
        EN ATTENTE DE CONNEXION{".".repeat(tick % 4)}
        <span className="invisible">{".".repeat(3 - (tick % 4))}</span>
      </p>
      <p className="scn-vt text-[1.5cqw] tracking-[0.3em] text-[#3f6f88]">
        TENTATIVE {String(1 + Math.floor(tick / 8)).padStart(2, "0")} <span className="pj-cursor" />
      </p>
    </div>
  );
}

/** The snow of a tape that has run out: grey noise, redrawn every frame on a small canvas, scaled up. */
function Snowfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = 160;
    c.height = 120;
    const img = ctx.createImageData(160, 120);
    let raf = 0;
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pj-snowfield" aria-hidden />;
}
