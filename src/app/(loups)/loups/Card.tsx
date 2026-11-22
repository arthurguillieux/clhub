"use client";

import { useEffect, useState } from "react";
import { roleName, roleOf } from "@/modules/loups/domain/roles";

const CAMP: Record<string, string> = { village: "Village", loups: "Loups-garous", solo: "Seul contre tous" };
const isWolfCard = (role: string | null) => role === "loup" || role === "infect" || role === "loupblanc";

/** The front of a card: the meneur's own picture of it when they uploaded one, else ours in the poster's colours. */
export function CardFace({ role, art, className = "" }: { role: string | null; art: Record<string, string>; className?: string }) {
  const picture = role ? art[role] : undefined;
  if (picture)
    return (
      <div className={`lg-card-art ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the meneur's own upload, already sized */}
        <img src={picture} alt={roleName(role)} />
      </div>
    );
  return (
    <div className={`lg-card-art lg-card-face ${isWolfCard(role) ? "is-wolf" : ""} ${className}`} role="img" aria-label={roleName(role)}>
      <span className="lg-card-camp text-[0.62em]">{role ? (CAMP[roleOf(role)?.camp ?? "village"] ?? "") : ""}</span>
      <span className="text-[2.6em] leading-none" aria-hidden>
        {isWolfCard(role) ? "🐺" : role === "cupidon" ? "💘" : role === "sorciere" ? "⚗️" : role === "salvateur" ? "🛡️" : role === "ancien" ? "🧓" : role === "enfant" ? "🌿" : role === "barbier" ? "✂️" : "🏡"}
      </span>
      <span className="lg-card-name text-[1.5em]">{roleName(role)}</span>
    </div>
  );
}

/** The back, the same for every card: the meneur's picture of it, else a rust moon. */
export function CardBack({ art, className = "" }: { art: Record<string, string>; className?: string }) {
  if (art.verso)
    return (
      <div className={`lg-card-art ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the meneur's own upload, already sized */}
        <img src={art.verso} alt="Dos de carte" />
      </div>
    );
  return <div className={`lg-card-art lg-card-back ${className}`} role="img" aria-label="Dos de carte" />;
}

/** A card that turns over: back first, then the face once `face` is true. Sized by its parent's width. */
export function FlipCard({ role, art, face }: { role: string | null; art: Record<string, string>; face: boolean }) {
  return (
    <div className={`lg-flip aspect-[5/7] w-full ${face ? "is-face" : ""}`}>
      <div className="lg-flip-inner">
        <div className="lg-flip-side">
          <CardBack art={art} className="h-full w-full" />
        </div>
        <div className="lg-flip-side is-front">
          <CardFace role={role} art={art} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * The reveal: a player's card, face down, turns over after a beat, with their name. Full screen; on the
 * phone the meneur closes it, on the room's screen it goes away by itself.
 */
export function Reveal({ name, role, art, onClose, big = false }: { name: string; role: string; art: Record<string, string>; onClose?: () => void; big?: boolean }) {
  const [face, setFace] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFace(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`La carte de ${name}`}
      className={big ? "lg-screen-veil" : "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[rgba(8,5,4,0.96)] p-6"}
      onClick={onClose}
    >
      <p className={big ? "lg-screen-caps text-[2cqw] text-[#d0552d]" : "loups-label"}>La carte de</p>
      <p className={big ? "lg-screen-title lg-rise text-[4.6cqw]" : "loups-title lg-rise text-4xl text-[#efe6cf]"}>{name}</p>
      <div className={big ? "w-[18cqw]" : "w-[min(62vw,280px)]"}>
        <FlipCard role={role} art={art} face={face} />
      </div>
      <p className={`${big ? "lg-screen-title text-[3.4cqw]" : "loups-title text-3xl text-[#efe6cf]"} transition-opacity duration-700 ${face ? "opacity-100" : "opacity-0"}`}>{roleName(role)}</p>
      {onClose && (
        <button type="button" className="loups-btn min-h-12 px-6" onClick={onClose}>
          Fermer
        </button>
      )}
    </div>
  );
}
