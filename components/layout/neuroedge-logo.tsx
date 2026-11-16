// components/layout/neuroedge-logo.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "ne_theme_mode";
const THEME_EVENT = "ne-theme-change";

export function resolveEffectiveTheme(mode: ThemeMode): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return mode;
}

export function applyThemeToDom(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const resolved = resolveEffectiveTheme(mode);

  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

export function getSavedTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "dark";
}

export function setSavedTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyThemeToDom(mode);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

export function useThemeMode() {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const initial = getSavedTheme();
    setThemeState(initial);
    setResolvedTheme(resolveEffectiveTheme(initial));
    applyThemeToDom(initial);

    const onCustomChange = (e: Event) => {
      const next = (e as CustomEvent<ThemeMode>).detail;
      if (next) {
        setThemeState(next);
        setResolvedTheme(resolveEffectiveTheme(next));
      }
    };

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      const current = getSavedTheme();
      if (current === "system") {
        applyThemeToDom("system");
        setResolvedTheme(resolveEffectiveTheme("system"));
      }
    };

    window.addEventListener(THEME_EVENT, onCustomChange);
    mq.addEventListener("change", onSystemChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onCustomChange);
      mq.removeEventListener("change", onSystemChange);
    };
  }, []);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    setResolvedTheme(resolveEffectiveTheme(next));
    setSavedTheme(next);
  };

  return { theme, resolvedTheme, setTheme };
}

/**
 * High-precision transparent vector recreation of the NeuroEdge logo:
 * - Left hemisphere: deep navy shell with smooth organic indigo/blue gyri folds
 * - Right hemisphere: geometric polygon network with glowing electric cyan nodes
 * - Center: sharp electric cyan EEG spike waveform cutting across the cortex
 */
export function NeuroEdgeEmblem({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ne-shell-grad" x1="12" y1="10" x2="96" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1B1F4B" />
          <stop offset="55%" stopColor="#111C44" />
          <stop offset="100%" stopColor="#0A132E" />
        </linearGradient>
        <linearGradient id="ne-gyri-grad" x1="14" y1="16" x2="60" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="ne-edge-grad" x1="56" y1="12" x2="108" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2CF0A8" />
          <stop offset="50%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="ne-pulse-grad" x1="14" y1="54" x2="102" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="35%" stopColor="#00E5FF" />
          <stop offset="70%" stopColor="#2CF0A8" />
          <stop offset="100%" stopColor="#00E5FF" />
        </linearGradient>
      </defs>

      {/* Base Brain Silhouette + Brainstem Tail */}
      <path
        d="M58 12C35 12 16 26 14 47C12 58 17 69 26 74C29 83 38 89 49 89H55L64 103H71L66 87C83 85 98 73 101 56C104 36 90 16 67 12.5C64 12.2 61 12 58 12Z"
        fill="url(#ne-shell-grad)"
        stroke="#1E295B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Left Hemisphere: Smooth Organic Cerebral Gyri Folds */}
      <path
        d="M55 18C41 18 29 26 24 38C22 43 27 46 33 44C38 42 41 35 47 35C52 35 55 39 55 44"
        stroke="url(#ne-gyri-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M35 25C42 23 50 25 53 31"
        stroke="#3B82F6"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M21 51C21 44 29 41 35 45C40 48 37 56 43 58"
        stroke="url(#ne-gyri-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M27 66C24 61 28 55 34 56C40 57 42 64 38 70C34 75 41 81 49 79C54 78 56 73 55 68"
        stroke="url(#ne-gyri-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Right Hemisphere: Geometric Polygonal facets & Edge Network */}
      <polygon
        points="61,17 75,20 65,33"
        fill="#00E5FF"
        fillOpacity="0.85"
      />
      <polygon
        points="77,23 91,33 73,41"
        fill="#06B6D4"
        fillOpacity="0.45"
      />
      <polygon
        points="66,36 82,44 68,52"
        fill="#2CF0A8"
        fillOpacity="0.75"
      />
      <polygon
        points="84,46 97,55 81,62"
        fill="#00E5FF"
        fillOpacity="0.55"
      />
      <polygon
        points="66,64 81,66 72,78"
        fill="#0284C7"
        fillOpacity="0.7"
      />
      <polygon
        points="83,67 94,69 86,79"
        fill="#00E5FF"
        fillOpacity="0.75"
      />

      {/* Right Hemisphere: Sharp Geometric Edge Mesh Lines */}
      <path
        d="M59 15L76 19L64 34L84 42L66 53L95 54L79 65L94 68L84 81L64 85L68 101"
        stroke="url(#ne-edge-grad)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M64 34L92 26M84 42L103 37M66 53L81 65L63 75M76 19L86 12"
        stroke="#2CF0A8"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Protruding Edge Tech Circuit Nodes (Top-Right Perimeter) */}
      <circle cx="86" cy="12" r="4.2" fill="#2CF0A8" />
      <circle cx="98" cy="24" r="4.2" fill="#2CF0A8" />
      <line x1="76" y1="28" x2="98" y2="24" stroke="#2CF0A8" strokeWidth="2.4" />
      <circle cx="105" cy="36" r="4.2" fill="#00E5FF" />
      <circle cx="109" cy="47" r="3.8" fill="#00E5FF" />
      <line x1="88" y1="53" x2="109" y2="47" stroke="#00E5FF" strokeWidth="2.2" />
      <circle cx="75" cy="40" r="3.2" fill="#2CF0A8" />
      <circle cx="77" cy="70" r="3.2" fill="#00E5FF" />

      {/* Center Intersecting EEG Spike Waveform */}
      <path
        d="M16 55H41L46 42L51 67L57 25L63 78L69 44L74 58L95 57"
        stroke="#0A132E"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 55H41L46 42L51 67L57 25L63 78L69 44L74 58L95 57"
        stroke="url(#ne-pulse-grad)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders the clean vector NeuroEdge emblem + wordmark with zero background box.
 */
export function NeuroEdgeWordmark({
  collapsed = false,
}: {
  collapsed?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <NeuroEdgeEmblem className={collapsed ? "h-9 w-9" : "h-10 w-10"} />
      {!collapsed && (
        <span className="select-none text-[19px] font-extrabold tracking-tight text-ne-fg">
          Neuro
          <span className="bg-gradient-to-r from-[#06B6D4] to-[#10B981] bg-clip-text italic text-transparent">
            Edge
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Reusable "?" educational popover button explaining clinical EEG & DSP concepts.
 */
export function InfoHelp({
  title,
  children,
  align = "right",
}: {
  title: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Learn about ${title}`}
        title={`What is ${title}?`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-ne-line bg-ne-bg2 text-[11px] font-semibold text-ne-fg-2 transition-colors hover:border-ne-cyan hover:text-ne-cyan"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-7 z-50 w-72 rounded-xl border border-ne-line bg-ne-card p-3.5 text-left text-xs shadow-xl backdrop-blur-xl",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-semibold text-ne-fg">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-ne-fg-3 hover:text-ne-fg"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1.5 leading-relaxed text-ne-fg-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}