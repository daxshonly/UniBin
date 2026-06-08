import { useEffect, useState, useCallback } from "react";
import { detectPlatform, cleanHostname } from "./utils/platform";
import { saveTab, parseTags } from "./utils/saveTab";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SaveState = "idle" | "loading" | "success" | "error";

interface ActiveTab {
  title: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small icon components (inline SVG — no extra deps)
// ─────────────────────────────────────────────────────────────────────────────
function UniBinLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7" fill="#1e40af" />
      {/* Grid of dots representing "bin" */}
      <rect x="7" y="7" width="5" height="5" rx="1.5" fill="#60a5fa" />
      <rect x="16" y="7" width="5" height="5" rx="1.5" fill="#93c5fd" />
      <rect x="7" y="16" width="5" height="5" rx="1.5" fill="#93c5fd" />
      <rect x="16" y="16" width="5" height="5" rx="1.5" fill="#bfdbfe" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin-slow"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton shimmer while tab info loads
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 bg-slate-700/80 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-slate-700/70 rounded-md" />
        <div className="h-3.5 w-3/4 bg-slate-700/70 rounded-md" />
      </div>
      <div className="h-3 w-1/2 bg-slate-700/50 rounded-md" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [tabLoading, setTabLoading] = useState(true);
  const [tabError, setTabError] = useState<string | null>(null);

  const [tags, setTags] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Fetch the active tab on mount ─────────────────────────────────────────
  useEffect(() => {
    // Guard: chrome.tabs is only available inside the actual extension context.
    // In Vite dev mode (browser tab) we fall back to a mock.
    const api = typeof chrome !== "undefined" && chrome.tabs;

    if (api) {
      api.query({ active: true, currentWindow: true }, (tabs) => {
        const current = tabs[0];
        if (current?.url && current?.title) {
          setTab({ title: current.title, url: current.url });
        } else {
          setTabError("Could not read the current tab.");
        }
        setTabLoading(false);
      });
    } else {
      // Dev fallback — remove before production or keep for local testing.
      setTab({
        title: "Build a Chrome Extension with React & Vite – YouTube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });
      setTabLoading(false);
    }
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!tab || saveState !== "idle") return;

    setSaveState("loading");
    setErrorMessage(null);

    const platform = detectPlatform(tab.url);

    try {
      await saveTab({
        url: tab.url,
        title: tab.title,
        platform: platform.name,
        tags: parseTags(tags),
        savedAt: new Date().toISOString(),
      });

      setSaveState("success");

      // Auto-close the popup after a brief success moment
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (err: unknown) {
      setSaveState("error");
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);

      // Reset back to idle after 3 s so the user can retry
      setTimeout(() => {
        setSaveState("idle");
        setErrorMessage(null);
      }, 3000);
    }
  }, [tab, tags, saveState]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const platform = tab ? detectPlatform(tab.url) : null;
  const hostname = tab ? cleanHostname(tab.url) : "";

  const buttonContent = {
    idle: (
      <span className="flex items-center justify-center gap-2 font-medium tracking-wide">
        Save to Dashboard
      </span>
    ),
    loading: (
      <span className="flex items-center justify-center gap-2 font-medium">
        <SpinnerIcon />
        Saving…
      </span>
    ),
    success: (
      <span className="flex items-center justify-center gap-2 font-medium">
        <CheckIcon />
        Saved!
      </span>
    ),
    error: (
      <span className="flex items-center justify-center gap-2 font-medium">
        Retry
      </span>
    ),
  }[saveState];

  const buttonClasses = {
    idle: "bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
    loading: "bg-blue-700 cursor-not-allowed",
    success: "bg-emerald-600 cursor-default",
    error: "bg-rose-600 hover:bg-rose-500",
  }[saveState];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-[380px] h-[450px] bg-slate-900 font-sans flex flex-col overflow-hidden animate-fade-in">
      {/* ── Subtle grid texture overlay ─────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      {/* ── Top accent line ──────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col h-full px-5 pt-5 pb-5 gap-4 z-10">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UniBinLogo />
            <div>
              <h1 className="text-slate-100 font-semibold text-base leading-none tracking-tight">
                UniBin
              </h1>
              <p className="text-slate-500 text-[10px] mt-0.5 leading-none tracking-wide uppercase">
                Tab Saver
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Settings"
            title="Settings (coming soon)"
          >
            <SettingsIcon />
          </button>
        </header>

        {/* ── Active Tab Card ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
              Active Tab
            </p>
          </div>

          {tabLoading && <SkeletonCard />}

          {tabError && !tabLoading && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-400 text-sm">
              {tabError}
            </div>
          )}

          {tab && !tabLoading && platform && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-2.5 animate-slide-up">
              {/* Platform badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide ${platform.badgeClasses}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${platform.dotClass}`}
                  />
                  {platform.name}
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-slate-100 leading-snug line-clamp-2">
                {tab.title}
              </p>

              {/* URL */}
              <div className="flex items-center gap-1.5 text-slate-500">
                <LinkIcon />
                <span className="text-xs truncate selectable">{hostname}</span>
              </div>
            </div>
          )}

          {/* ── Tags Input ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="tags-input"
              className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"
            >
              Add Tags
            </label>
            <input
              id="tags-input"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="e.g., dev, video, tutorial"
              disabled={saveState === "loading" || saveState === "success"}
              className="
                w-full px-3.5 py-2.5 rounded-xl text-sm
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-600
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
              "
            />
            <p className="text-[10px] text-slate-600 pl-0.5">
              Comma-separated. Tags will be lowercased and de-duped.
            </p>
          </div>
        </div>

        {/* ── Error message ────────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs text-rose-400 animate-slide-up">
            <span className="font-semibold">Error: </span>
            {errorMessage}
          </div>
        )}

        {/* ── Save Button ──────────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={
            !tab ||
            tabLoading ||
            saveState === "loading" ||
            saveState === "success"
          }
          className={`
            w-full py-2.5 rounded-xl text-white text-sm
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            ${buttonClasses}
          `}
          aria-label="Save current tab to UniBin dashboard"
        >
          {buttonContent}
        </button>
      </div>
    </div>
  );
}
