import { useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { placeholderData } from "./data.js";
import { AppDataProvider, useAppData } from "./context/AppDataContext.jsx";
import InsightChat from "./components/InsightChat.jsx";
import LocationRecap from "./components/LocationRecap.jsx";
import AIAnalysisCard from "./components/AIAnalysisCard.jsx";
import LocationSearch from "./components/LocationSearch.jsx";
import LocationMap from "./components/LocationMap.jsx";
import { fetchAIInsights } from "./lib/ai.js";
import AccessibilityWidget from "./components/AccessibilityWidget.jsx";

import {
  calculateEnvironmentalRisk,
  simulateTreeCoverage,
} from "./riskEngine.js";

/* =====================================================
   ICONS
   Minimal stroke icons, 24x24, no external icon library.
===================================================== */

const iconBase = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

const LeafIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M5 19C5 10 12 6 19 6c0 8-4 13-13 13-1 0-2-.1-2.6-.3" />
    <path d="M5 19c1-3 3.5-5.5 7-7.5" />
  </svg>
);

const PinIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.25" />
  </svg>
);

const WindIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M3 8h11a3 3 0 1 0-3-3" />
    <path d="M3 13h15a3 3 0 1 1-3 3" />
    <path d="M3 18h8a2.5 2.5 0 1 1-2.5 2.5" />
  </svg>
);

const ThermometerIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0z" />
    <path d="M10 8h1" />
  </svg>
);

const DropletIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 3s6 6.4 6 10.5a6 6 0 1 1-12 0C6 9.4 12 3 12 3z" />
  </svg>
);

const TreeIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 3l4 6h-2.5l3.5 5h-3l3 5H7l3-5H7l3.5-5H8l4-6z" />
    <path d="M12 19v2" />
  </svg>
);

const ShieldIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z" />
  </svg>
);

const SparkleIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
    <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
  </svg>
);

const SettingsIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.4-2.2.7a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.6 7.6 0 0 0 0 3L2.7 15l2 3.4 2.2-.7c.75.65 1.63 1.16 2.6 1.5L10 22h4l.5-2.3a7.6 7.6 0 0 0 2.6-1.5l2.2.7 2-3.4-1.9-1.5z" />
  </svg>
);

const ArrowRightIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const InfoIcon = (props) => (
  <svg viewBox="0 0 24 24" {...iconBase} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 8v.01" />
  </svg>
);

/* =====================================================
   UI PRIMITIVES
===================================================== */

// Base card surface: white background, rounded corners,
// hairline border, soft shadow. Pass `bezel` to add the
// instrument-corner signature (reserve for live-data cards).
function Card({ children, className = "", bezel = false, as: Tag = "div" }) {
  return (
    <Tag
      className={[
        "rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]",
        "shadow-[0_1px_2px_rgba(22,33,29,0.04),0_8px_24px_-16px_rgba(22,33,29,0.18)]",
        bezel ? "bezel" : "",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

const BADGE_TONES = {
  neutral: "bg-[var(--color-line)]/70 text-[var(--color-muted)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-primary)]",
  amber: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
};

function Badge({ children, tone = "neutral" }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        BADGE_TONES[tone] ?? BADGE_TONES.neutral,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SectionHeading({ eyebrow, title, hint }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-primary)]">
          {title}
        </h2>
      </div>
      {hint && <p className="hidden text-sm text-[var(--color-muted)] sm:block">{hint}</p>}
    </div>
  );
}

// One metric, rendered as a small instrument reading.
// `value == null` renders as "--" so the dashboard works
// before any real data exists.
function ReadoutCard({ icon, label, value, unit = "", sublabel, isLoading = false }) {
  const isEmpty = value === null || value === undefined;

  return (
    <Card bezel className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>

      {isEmpty && isLoading ? (
        <div className="h-9 w-20 animate-pulse rounded-md bg-[var(--color-line)] sm:h-10" aria-hidden="true" />
      ) : (
        <div className="readout text-3xl font-semibold text-[var(--color-ink)] sm:text-[2.25rem]">
          {isEmpty ? "--" : value}
          {!isEmpty && unit && <span className="ml-1 text-lg text-[var(--color-muted)]">{unit}</span>}
        </div>
      )}

      <p className="text-xs text-[var(--color-muted-2)]">{isLoading && isEmpty ? "Loading…" : (sublabel ?? "Awaiting data")}</p>
    </Card>
  );
}

/* =====================================================
   LAYOUT — Header / Footer
===================================================== */

// Top header. Deliberately minimal: no login, no account
// menu, no multi-page nav — just the brand and a single
// settings affordance for later (theme, units, etc).
function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={isActive ? "text-[var(--color-primary)]" : "transition-colors hover:text-[var(--color-primary)]"}
    >
      {children}
    </Link>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-accent)]">
            <LeafIcon className="h-5 w-5" />
          </span>
          <div className="flex items-baseline gap-1.5 font-[var(--font-display)]">
            <span className="text-lg font-semibold leading-none text-[var(--color-primary)]">
              EcoRisk
            </span>
            <span className="inline-flex items-center gap-1.5 text-lg font-semibold leading-none text-[var(--color-accent)]">
              Live
              <span className="pulse-dot" aria-hidden="true" />
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--color-muted)] sm:flex">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/action">Action Plan</NavLink>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-[var(--color-muted-2)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Environmental data from USDA Forest Service, Open-Meteo, and OpenStreetMap.</p>
        <p>© {new Date().getFullYear()} EcoRisk Live.</p>
      </div>
    </footer>
  );
}

/* =====================================================
   FEATURE 1 — search, location, map, environmental data
   Search bar + dropdown live in components/LocationSearch.jsx,
   the map lives in components/LocationMap.jsx, and the data
   fetching lives in lib/api.js. LocationCard and
   EnvironmentalCards below just render whatever Dashboard
   hands them, same as before.
===================================================== */
function formatCoordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}
function LocationCard({ location }) {
  const hasCoords = location?.lat != null && location?.lng != null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
          <PinIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)] sm:text-xl">
              {location?.name ?? "No location selected"}
            </h2>
            <Badge>Selected location</Badge>
          </div>
          <p className="readout mt-0.5 text-xs text-[var(--color-muted)]">
            {hasCoords
                ? `${formatCoordinate(location.lat, "N", "S")}, ${formatCoordinate(location.lng, "E", "W")}`
                : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Renders whatever `data.environmental` currently holds (see
// data.js), showing an animated skeleton in place of "--" while
// isLoading is true (a search is in flight).
function EnvironmentalCards({ data, isLoading }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <ReadoutCard
        icon={<WindIcon className="h-4 w-4" />}
        label="AQI"
        value={data.aqi}
        sublabel={data.aqiLabel ?? "US AQI"}
        isLoading={isLoading}
      />
      <ReadoutCard
        icon={<ThermometerIcon className="h-4 w-4" />}
        label="Temperature"
        value={data.temperature}
        unit="°F"
        sublabel={data.feelsLike != null ? `Feels like ${data.feelsLike}°F` : "Weather API"}
        isLoading={isLoading}
      />
      <ReadoutCard icon={<DropletIcon className="h-4 w-4" />} label="PM2.5" value={data.pm25} sublabel="µg/m³" isLoading={isLoading} />
            <ReadoutCard
        icon={<TreeIcon className="h-4 w-4" />}
        label="Tree Coverage"
        value={data.treeCoverage}
        unit="%"
        isLoading={isLoading}
        sublabel={
          data.treeCoverage == null
            ? "USDA Forest Service"
            : data.treeCoverageIsEstimated
              ? "Estimated (outside US coverage)"
              : "USDA Forest Service"
        }
      />
    </div>
  );
}

/* =====================================================
   FEATURE 2 — risk calculations + tree simulation
===================================================== */

function RiskScore({ icon, label, value }) {
  return (
    <div className="flex-1 rounded-xl border border-[var(--color-line)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--color-muted)]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="readout text-2xl font-semibold text-[var(--color-ink)]">
        {value ?? "--"}
        <span className="text-base font-normal text-[var(--color-muted)]"> /100</span>
      </p>
    </div>
  );
}

// Circular gauge for the overall safety score — plain SVG
// (stroke-dasharray trick), no chart library needed. Color band
// follows the score: red under 40, amber 40-70, green above 70.
// The fill animation automatically respects the "Reduce motion"
// accessibility toggle, since that toggle forces all CSS
// transition durations to ~0 globally (see index.css).
function SafetyGauge({ value }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;

  const color =
    value == null ? "var(--color-muted-2)" : value < 40 ? "#dc2626" : value < 70 ? "#d97706" : "#16a34a";

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="10" opacity="0.5" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="readout text-3xl font-bold text-[var(--color-ink)]">{value ?? "--"}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">/ 100</span>
      </div>
    </div>
  );
}

// Powered by riskEngine.js via Dashboard's handleLocationData.
// Scores are SAFETY scores: 100 = best/safest conditions, 0 =
// worst — higher is always better, matching riskEngine.js's own
// convention directly (no inversion happens anywhere in this app).
function RiskOverview({ data }) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading eyebrow="Live score" title="Safety overview" />

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch">
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[var(--color-accent-soft)] px-6 py-5">
          <SafetyGauge value={data.overallSafety} />
          <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)]">
            <ShieldIcon className="h-3.5 w-3.5" />
            Overall safety
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <RiskScore icon={<WindIcon className="h-3.5 w-3.5" />} label="Air safety" value={data.airSafety} />
          <RiskScore icon={<ThermometerIcon className="h-3.5 w-3.5" />} label="Heat safety" value={data.heatSafety} />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-[var(--color-line)] p-3.5 text-sm text-[var(--color-muted)]">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {data.topReasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4">
            {data.topReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>Top reasons for the score will appear here once a location is searched.</p>
        )}
      </div>
    </Card>
  );
}

function SimulatorColumn({ title, coverage, safety }) {
  return (
    <div className="flex-1 rounded-xl border border-[var(--color-line)] p-4 text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</p>
      <p className="readout text-2xl font-semibold text-[var(--color-ink)]">
        {coverage ?? "--"}
        <span className="text-sm font-normal text-[var(--color-muted)]">% trees</span>
      </p>
      <div className="my-3 h-px bg-[var(--color-line)]" />
      <p className="text-xs text-[var(--color-muted)]">Overall safety</p>
      <p className="readout text-lg font-semibold text-[var(--color-ink)]">
        {safety ?? "--"} <span className="text-sm font-normal text-[var(--color-muted)]">/100</span>
      </p>
    </div>
  );
}

// FEATURE 2 DEVELOPER:
// Connect this button to the tree-coverage simulation.
// When clicked: 1) increase tree coverage by 10%,
// 2) recalculate the risk, 3) show the new risk, 4) show
// the difference between before and after. Write the
// result into `appData.simulation`, then swap the
// `disabled` button below for a real onClick handler.
function TreeSimulator({ data, onSimulate, disabled }) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading eyebrow="What-if" title="Tree coverage simulator" />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <SimulatorColumn title="Current" coverage={data.currentTreeCoverage} safety={data.currentSafety} />
        <ArrowRightIcon className="mx-auto h-5 w-5 shrink-0 rotate-90 text-[var(--color-muted-2)] sm:rotate-0" />
        <SimulatorColumn title="After +10% trees" coverage={data.simulatedTreeCoverage} safety={data.simulatedSafety} />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onSimulate}
        title={
          disabled
            ? "Waiting for environmental data."
            : "Simulate adding 10% tree coverage"
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >

        <TreeIcon className="h-4 w-4" />
        Simulate +10% Trees
      </button>
    </Card>
  );
}

// `barHeight` turns a 0-100 SAFETY score into a bar height
// percentage — taller bar = safer, matching the score directly.
function barHeight(score) {
  if (score == null) return 6; // a sliver, so the empty state still reads as a bar
  return Math.max(6, Math.min(100, score));
}

function RiskChart({ current, after }) {
  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <SectionHeading eyebrow="What-if" title="Safety before vs. after" />

      <div className="flex flex-1 items-end justify-center gap-10 pt-4">
        <div className="flex flex-col items-center gap-2">
          <span className="readout text-lg font-semibold text-[var(--color-ink)]">{current ?? "--"}</span>
          <div className="flex h-32 w-14 items-end rounded-lg bg-[var(--color-line)]/60">
            <div
              className="w-full rounded-lg bg-[var(--color-primary)] transition-[height]"
              style={{ height: `${barHeight(current)}%` }}
            />
          </div>
          <span className="text-xs text-[var(--color-muted)]">Current</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="readout text-lg font-semibold text-[var(--color-ink)]">{after ?? "--"}</span>
          <div className="flex h-32 w-14 items-end rounded-lg bg-[var(--color-line)]/60">
            <div
              className="w-full rounded-lg bg-[var(--color-accent)] transition-[height]"
              style={{ height: `${barHeight(after)}%` }}
            />
          </div>
          <span className="text-xs text-[var(--color-muted)]">After +10% trees</span>
        </div>
      </div>
    </Card>
  );
}

/* =====================================================
   FEATURE 3 — AI insights now live entirely on the Action
   Plan page (see ActionPlanPage below, and
   components/AIAnalysisCard.jsx + components/InsightChat.jsx).
===================================================== */

// AI insights now live on the Action Plan page (/action), not
// here — see ActionPlanPage below. That page owns the "Generate"
// button, the analysis display, and the follow-up chat, all in
// one place instead of splitting analysis (Dashboard) from
// discussion (Action Plan).

/* =====================================================
   DASHBOARD
   `appData` is the single object all three features read
   from and write into. It starts as placeholderData (see
   data.js) so the UI renders cleanly with "--" everywhere
   before any feature is wired up.
===================================================== */

// riskEngine.js only returns numeric scores, not explanations.
// RiskOverview already renders a `topReasons` list — this builds
// it from whichever specific readings are actually elevated,
// matching the plain-English style used elsewhere in the app.
function buildTopReasons(environmental) {
  const reasons = [];
  if (environmental.aqi != null && environmental.aqi > 100) {
    reasons.push(`Air Quality Index is elevated (${environmental.aqi})`);
  }
  if (environmental.pm25 != null && environmental.pm25 > 35) {
    reasons.push(`PM2.5 is elevated (${environmental.pm25} µg/m³)`);
  }
  if (environmental.temperature != null && environmental.temperature > 85) {
    reasons.push(`Temperature is well above the comfortable range (${environmental.temperature}°F)`);
  }
  if (environmental.treeCoverage != null && environmental.treeCoverage < 30) {
    reasons.push(`Low tree coverage (${environmental.treeCoverage}%) offers little shade or air filtering`);
  }
  if (reasons.length === 0) {
    reasons.push("Conditions are within a comfortable range across all factors");
  }
  return reasons;
}

// riskEngine.js's validateNumber() throws on null/undefined, so
// this must be checked before calling it — a location can be
// selected before all four environmental readings have arrived.
function hasCompleteEnvironmentalData(environmental) {
  return (
    typeof environmental?.aqi === "number" &&
    typeof environmental?.pm25 === "number" &&
    typeof environmental?.temperature === "number" &&
    typeof environmental?.treeCoverage === "number"
  );
}

// Blank environmental readings, used while a new location's
// data is loading so stale numbers from the previous search
// don't linger on screen.
const EMPTY_ENVIRONMENTAL = {
  aqi: null,
  aqiLabel: null,
  temperature: null,
  feelsLike: null,
  pm25: null,
  treeCoverage: null,
};

function Dashboard() {
  const { appData, setAppData } = useAppData();
  const [isLoadingEnvironmental, setIsLoadingEnvironmental] = useState(false);

  // Passed to LocationSearch. It calls this twice per
  // selection: once with `environmental: null` (so the UI can
  // clear old readings and show the new pin right away), then
  // again once the AQI/temperature/PM2.5/tree-coverage fetch
  // resolves. As soon as all four readings are in, this also
  // runs riskEngine.js to populate appData.safety — Feature 3
  // (AI insights) then picks up those numbers automatically.
  function handleLocationData(location, environmental) {
    const nextEnvironmental = environmental ?? EMPTY_ENVIRONMENTAL;

    let safety = placeholderData.safety;
    if (hasCompleteEnvironmentalData(nextEnvironmental)) {
      const result = calculateEnvironmentalRisk(nextEnvironmental);
      safety = {
        airSafety: result.airScore,
        heatSafety: result.heatScore,
        overallSafety: result.overallScore,
        topReasons: buildTopReasons(nextEnvironmental),
      };
    }

    setAppData((prev) => ({
      ...prev,
      location,
      environmental: nextEnvironmental,
      safety,
      // A new location invalidates any AI insights and tree
      // simulation generated for the previous one.
      ai: placeholderData.ai,
      simulation: placeholderData.simulation,
    }));
  }

  // Passed to TreeSimulator's "Simulate +10% Trees" button.
  function handleTreeSimulation() {
    if (!hasCompleteEnvironmentalData(appData.environmental)) return;

    const simulation = simulateTreeCoverage(appData.environmental, 10);

    setAppData((prev) => ({
      ...prev,
      simulation: {
        currentTreeCoverage: simulation.before.treeCoverage,
        currentSafety: simulation.before.overallScore,
        simulatedTreeCoverage: simulation.after.treeCoverage,
        simulatedSafety: simulation.after.overallScore,
        // riskEngine's `change` is already a safety-score
        // improvement (positive = better) — same convention this
        // app now uses everywhere, so no conversion needed.
        change: simulation.change,
      },
    }));
  }

  return (
    <div id="dashboard" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <div className="pt-2 text-center sm:pt-4">
        <h1 className="font-[var(--font-display)] text-3xl font-bold leading-tight text-[var(--color-ink)] sm:text-4xl">
          Know your air. Know your risk.
          <br className="hidden sm:block" /> Know what actually helps.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-muted)] sm:text-base">
          Search any US address for live air quality, heat, and real satellite
          tree-canopy data — then see exactly how much safer more trees would
          make it.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1">
            <ShieldIcon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            USDA &amp; EPA data
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1">
            <SparkleIcon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            AI-powered insights
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1">
            <LeafIcon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            Free, no sign-up
          </span>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4 sm:p-5">
        <LocationSearch onLocationData={handleLocationData} onLoadingChange={setIsLoadingEnvironmental} />
      </Card>

      {/* Location + map */}
      <Card className="overflow-hidden p-0">
        <div className="p-5 sm:p-6">
          <LocationCard location={appData.location} />
        </div>
        <div className="h-56 border-t border-[var(--color-line)] sm:h-72">
          <LocationMap lat={appData.location.lat} lng={appData.location.lng} label={appData.location.name} />
        </div>
      </Card>

      {/* Environmental snapshot */}
      <div>
        <SectionHeading
          eyebrow="Live data"
          title="Environmental snapshot"
          hint="Populated once a location is searched"
        />
        <EnvironmentalCards data={appData.environmental} isLoading={isLoadingEnvironmental} />
      </div>

      {/* Safety — Feature 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RiskOverview data={appData.safety} />
        <TreeSimulator
         data={appData.simulation}
         onSimulate={handleTreeSimulation}
         disabled={appData.environmental.treeCoverage == null}
         />
      </div>

      {/* Tree simulation chart */}
      <RiskChart current={appData.simulation.currentSafety} after={appData.simulation.simulatedSafety} />

      {/* Next steps — Compare and Action Plan */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">What's next?</p>
          <p className="text-sm text-[var(--color-muted)]">
            See how this compares to another location, or turn your results into a plan you can act on.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <Link
            to="/compare"
            className="rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)]"
          >
            Compare locations
          </Link>
          <Link
            to="/action"
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-soft)]"
          >
            View action plan
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* =====================================================
   ACTION PLAN PAGE — reads AND writes the shared appData
   context (see context/AppDataContext.jsx). This is now the
   ONLY place the AI analysis is generated (the Dashboard no
   longer has its own AI card) — generate here, then the same
   analysis flows into a follow-up chat below it. FAQ,
   Methodology, and Data Sources are static reference sections
   at the bottom, always visible regardless of search state.
===================================================== */

const FAQ_ITEMS = [
  {
    question: "Why does a higher score mean safer, not riskier?",
    answer:
      "Every score on this site (Air, Heat, Overall) runs 0–100 with 100 as the best/safest conditions and 0 as the worst — the same convention the underlying scoring engine uses natively.",
  },
  {
    question: "Is my search history saved anywhere?",
    answer: "No. Everything runs client-side against public APIs — nothing you search is logged or stored on a server.",
  },
  {
    question: "Does the chat always work?",
    answer:
      "The AI explanation and action plan above always work. Live follow-up chat additionally needs an optional local AI server running on the developer's machine — if it isn't reachable, the chat box says so plainly instead of pretending to work.",
  },
  {
    question: "Does this work outside the United States?",
    answer:
      "Search, AQI, and weather work globally. Tree-canopy data is US-only (continental US); outside that area, tree coverage shows as an estimate instead of a satellite reading.",
  },
];

function ActionPlanPage() {
  const { appData, setAppData } = useAppData();
  const [isGenerating, setIsGenerating] = useState(false);

  const hasLocation = appData.environmental.aqi != null;
  const hasAnalysis = appData.ai.mainConcern != null;

  // Now lives here instead of on the Dashboard — this is the
  // only place in the app that calls fetchAIInsights.
  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const ai = await fetchAIInsights(appData.environmental, appData.safety, appData.simulation);
      setAppData((prev) => ({ ...prev, ai }));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <SectionHeading
          eyebrow={hasLocation ? "Personalized" : "Get started"}
          title="Your action plan"
          hint={hasLocation ? undefined : "Search a location on the Dashboard first"}
        />
        <p className="max-w-2xl text-sm text-[var(--color-muted)]">
          {hasLocation
            ? `Live readings, an AI explanation, and a plan for ${appData.location.name}.`
            : "Search a location on the Dashboard, then come back here for an AI-generated explanation and a personalized plan."}
        </p>
      </div>

      {!hasLocation ? (
        <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">No location yet</p>
            <p className="text-sm text-[var(--color-muted)]">Head to the Dashboard and search an address to get started.</p>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-soft)]"
          >
            Go to Dashboard
          </Link>
        </Card>
      ) : (
        <>
          {/* Recap — location, safety gauge, quick readouts. Gives
              the AI text below something concrete to point at. */}
          {/* Recap — location, safety gauge, quick readouts. Gives
              the AI text below something concrete to point at.
              Purely presentational — see LocationRecap.jsx. */}
          <LocationRecap location={appData.location} environmental={appData.environmental} safety={appData.safety} />

          {/* AI explanation + plan — generate button lives here now.
              Purely presentational — see AIAnalysisCard.jsx. */}
          <AIAnalysisCard
            data={appData.ai}
            locationName={appData.location.name}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />

          {/* Chat — appears once there's an analysis to discuss.
              This is the "turns into a chat" step. */}
          {hasAnalysis && (
            <Card className="p-5 sm:p-6">
              <SectionHeading eyebrow="AI-powered" title="Ask a follow-up question" />
              <InsightChat
                context={{
                  location: appData.location,
                  environmental: appData.environmental,
                  safety: appData.safety,
                  simulation: appData.simulation,
                }}
              />
            </Card>
          )}

          <p className="text-center text-sm text-[var(--color-muted)]">
            Want to see how this compares to another neighborhood?{" "}
            <Link to="/compare" className="font-medium text-[var(--color-primary)] hover:underline">
              Compare locations
            </Link>
          </p>
        </>
      )}

      {/* FAQ — static, always visible */}
      <div className="mt-4">
        <SectionHeading eyebrow="Reference" title="Frequently asked questions" />
        <Card className="divide-y divide-[var(--color-line)] p-0">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="p-5 sm:p-6">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{item.question}</p>
              <p className="mt-1.5 text-sm text-[var(--color-muted)]">{item.answer}</p>
            </div>
          ))}
        </Card>
      </div>

      {/* Methodology — accurate to riskEngine.js's real weights */}
      <div>
        <SectionHeading eyebrow="Reference" title="Methodology" hint="How the safety score is calculated" />
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Air safety</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                60% from AQI (100 at AQI 0, down to 0 at AQI 200), 40% from PM2.5 (100 at 0 µg/m³, down to 0 at 50
                µg/m³).
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Heat safety</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                70% from temperature (100 at or below 72°F, decreasing to 0 at 112°F), 30% from tree coverage — more
                canopy directly raises the score.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Overall safety</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                A straight 50/50 average of air safety and heat safety, rounded to a whole number, 0–100. Higher is
                always safer.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Data sources — static, always visible */}
      <div>
        <SectionHeading eyebrow="Reference" title="Data sources" />
        <Card className="p-5 sm:p-6">
          <ul className="space-y-3 text-sm text-[var(--color-muted)]">
            <li>
              <span className="font-semibold text-[var(--color-ink)]">Location search:</span> Photon, an open geocoder
              built on OpenStreetMap data.
            </li>
            <li>
              <span className="font-semibold text-[var(--color-ink)]">Temperature:</span> Open-Meteo Forecast API.
            </li>
            <li>
              <span className="font-semibold text-[var(--color-ink)]">AQI &amp; PM2.5:</span> Open-Meteo Air Quality
              API.
            </li>
            <li>
              <span className="font-semibold text-[var(--color-ink)]">Tree coverage:</span> USDA Forest Service
              satellite-derived Tree Canopy Cover data (continental US only — other locations show an estimate).
            </li>
            <li>
              <span className="font-semibold text-[var(--color-ink)]">Map tiles:</span> OpenStreetMap contributors,
              via Leaflet.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================
   ABOUT PAGE
   Placeholder content — replace the [bracketed] parts with
   your own name, bio, and links before sharing/deploying.
===================================================== */
function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading eyebrow="About" title="About this project" />

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
            <LeafIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              [Your Name]
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              [Your role — e.g. "Student developer building EcoRisk Live"]
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[var(--color-ink)]">
          [Write a couple of sentences about why you built EcoRisk Live, what
          problem it solves, and anything you're proud of in how it works.]
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="#"
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)]"
          >
            GitHub
          </a>
          <a
            href="#"
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)]"
          >
            LinkedIn
          </a>
          <a
            href="#"
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)]"
          >
            Email
          </a>
        </div>
      </Card>
    </div>
  );
}

/* =====================================================
   COMPARE PAGE — an environmental-equity feature: search
   two locations side by side and see exactly where — and
   why — one is safer than the other. Air quality and tree
   canopy can vary block by block; this makes that gap
   visible and quantified instead of anecdotal.

   Reuses everything already built: LocationSearch and
   lib/api.js for the data, riskEngine.js for the scoring,
   and the same SafetyGauge/ReadoutCard components the
   Dashboard uses — no new data sources or scoring logic.
===================================================== */

// One independent location "slot" — its own search, its own
// environmental data, its own computed safety score. Two of
// these run side by side in ComparePage, completely isolated
// from each other and from the Dashboard's own state.
function useCompareSlot() {
  const [location, setLocation] = useState(null);
  const [environmental, setEnvironmental] = useState(EMPTY_ENVIRONMENTAL);
  const [safety, setSafety] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleLocationData(nextLocation, nextEnvironmental) {
    setLocation(nextLocation);

    if (nextEnvironmental == null) {
      setEnvironmental(EMPTY_ENVIRONMENTAL);
      setSafety(null);
      return;
    }

    setEnvironmental(nextEnvironmental);
    setSafety(hasCompleteEnvironmentalData(nextEnvironmental) ? calculateEnvironmentalRisk(nextEnvironmental) : null);
  }

  return { location, environmental, safety, isLoading, setIsLoading, handleLocationData };
}

function CompareColumn({ label, slot }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <LocationSearch onLocationData={slot.handleLocationData} onLoadingChange={slot.setIsLoading} />

      <Card bezel className="flex flex-col items-center gap-2 p-5">
        <SafetyGauge value={slot.safety?.overallScore ?? null} />
        <p className="readout text-center text-sm font-medium text-[var(--color-ink)]">
          {slot.location?.name ?? "No location selected"}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <ReadoutCard
          icon={<WindIcon className="h-4 w-4" />}
          label="AQI"
          value={slot.environmental.aqi}
          sublabel={slot.environmental.aqiLabel ?? "US AQI"}
          isLoading={slot.isLoading}
        />
        <ReadoutCard
          icon={<ThermometerIcon className="h-4 w-4" />}
          label="Temp"
          value={slot.environmental.temperature}
          unit="°F"
          sublabel="Open-Meteo"
          isLoading={slot.isLoading}
        />
        <ReadoutCard
          icon={<DropletIcon className="h-4 w-4" />}
          label="PM2.5"
          value={slot.environmental.pm25}
          sublabel="µg/m³"
          isLoading={slot.isLoading}
        />
        <ReadoutCard
          icon={<TreeIcon className="h-4 w-4" />}
          label="Trees"
          value={slot.environmental.treeCoverage}
          unit="%"
          sublabel="USDA Forest Service"
          isLoading={slot.isLoading}
        />
      </div>
    </div>
  );
}

// Rule-based, not AI-generated (deliberately — a factual gap
// summary should be deterministic, not something an LLM could
// phrase inconsistently). Mirrors the plain-English style used
// throughout lib/ai.js.
function buildComparisonInsight(labelA, slotA, labelB, slotB) {
  if (!slotA.safety || !slotB.safety) {
    return "Search two locations above to compare their safety scores.";
  }

  const scoreDiff = slotA.safety.overallScore - slotB.safety.overallScore;
  const pointDiff = Math.abs(scoreDiff);

  if (pointDiff < 3) {
    return `${labelA} and ${labelB} have nearly identical safety scores (within ${pointDiff} point${pointDiff === 1 ? "" : "s"}) — conditions here are comparable.`;
  }

  const [saferLabel, saferEnvironmental, otherLabel, otherEnvironmental] =
    scoreDiff >= 0
      ? [labelA, slotA.environmental, labelB, slotB.environmental]
      : [labelB, slotB.environmental, labelA, slotA.environmental];

  const treeDiff = (saferEnvironmental.treeCoverage ?? 0) - (otherEnvironmental.treeCoverage ?? 0);
  const treeNote =
    treeDiff >= 10
      ? ` A large part of that gap tracks with tree canopy: ${saferLabel} has ${Math.round(treeDiff)} more percentage points of tree coverage than ${otherLabel}.`
      : "";

  return `${saferLabel} scores ${pointDiff} points safer overall than ${otherLabel}.${treeNote}`;
}

function ComparePage() {
  const slotA = useCompareSlot();
  const slotB = useCompareSlot();

  const labelA = slotA.location?.name ?? "Location A";
  const labelB = slotB.location?.name ?? "Location B";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <SectionHeading
          eyebrow="Environmental equity"
          title="Compare two locations"
          hint="See exactly where — and why — one place is safer than another"
        />
        <p className="max-w-2xl text-sm text-[var(--color-muted)]">
          Air quality and tree canopy can vary block by block, often along
          lines of income and history. Search two addresses below to see the
          gap directly, backed by the same real data as the Dashboard.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <CompareColumn label="Location A" slot={slotA} />
        <CompareColumn label="Location B" slot={slotB} />
      </div>

      <Card className="flex items-start gap-3 p-5 sm:p-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
          <InfoIcon className="h-4 w-4" />
        </span>
        <p className="text-sm text-[var(--color-ink)]">{buildComparisonInsight(labelA, slotA, labelB, slotB)}</p>
      </Card>

      <p className="text-center text-sm text-[var(--color-muted)]">
        Want a plan for one specific location instead?{" "}
        <Link to="/action" className="font-medium text-[var(--color-primary)] hover:underline">
          View your action plan
        </Link>
      </p>
    </div>
  );
}

/* =====================================================
   APP
===================================================== */

export default function App() {
  return (
    <BrowserRouter basename="/nextstep">
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <Header />
      <main id="main-content" className="flex-1">
        <AppDataProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/action" element={<ActionPlanPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </AppDataProvider>
      </main>
      <Footer />
      <AccessibilityWidget />
      </div>
    </BrowserRouter>
  );
}