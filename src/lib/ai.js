const AI_API_URL = import.meta.env.VITE_AI_API_URL; // e.g. http://localhost:5001/api/ai-insights
const FETCH_TIMEOUT_MS = 4000;
const CHAT_FETCH_TIMEOUT_MS = 15000;

// ---- Layer 1: rule-based generator (always available) ----

function describeAqi(environmental) {
  const { aqi, pm25, aqiLabel } = environmental;
  if (aqi == null) return null;
  if (aqi > 150) return `AQI is ${aqi} (${aqiLabel ?? "unhealthy"}), driven by PM2.5 at ${pm25} µg/m³`;
  if (aqi > 100) return `AQI is ${aqi} (${aqiLabel ?? "moderate"}) — sensitive groups should take note`;
  if (aqi > 50) return `AQI is ${aqi} (${aqiLabel ?? "moderate"})`;
  return `AQI is ${aqi} (${aqiLabel ?? "good"}) — air quality isn't a major concern right now`;
}

function describeHeat(environmental) {
  const { temperature, feelsLike } = environmental;
  if (temperature == null) return null;
  if (feelsLike != null && feelsLike >= 90) return `It feels like ${feelsLike}°F — heat risk is elevated`;
  if (temperature >= 85) return `Temperature is ${temperature}°F, warm enough to factor into outdoor plans`;
  return `Temperature is ${temperature}°F — not a significant heat concern`;
}

function describeTrees(environmental) {
  const { treeCoverage } = environmental;
  if (treeCoverage == null) return null;
  if (treeCoverage < 20) return `Tree coverage is low (${treeCoverage}%), offering little shade or air filtering`;
  if (treeCoverage < 45) return `Tree coverage is moderate (${treeCoverage}%)`;
  return `Tree coverage is strong (${treeCoverage}%), which helps moderate both heat and air quality`;
}

function getUrgency(environmental, safety) {
  if (safety.overallSafety != null && safety.overallSafety < 40) return "Take extra care today";
  if (environmental.aqi > 100 || environmental.feelsLike >= 90) return "Worth adjusting plans today";
  return "Conditions are manageable";
}

function getNextBestAction(environmental, safety) {
  const airSafety = safety.airSafety ?? (environmental.aqi == null ? null : 100 - (environmental.aqi / 200) * 100);
  if (airSafety != null && (safety.heatSafety == null || airSafety <= safety.heatSafety) && environmental.aqi > 50) {
    return "Reduce long, strenuous outdoor activity and check the AQI again before heading out.";
  }
  if (environmental.feelsLike >= 85) return "Move demanding outdoor plans away from the hottest hours, and bring water.";
  return "Normal outdoor plans are reasonable; recheck conditions before unusually strenuous activity.";
}

function normalizeInsights(data, fallback) {
  if (!data || typeof data !== "object" || typeof data.mainConcern !== "string") return fallback;
  return {
    ...fallback,
    ...data,
    contributingFactors: Array.isArray(data.contributingFactors) ? data.contributingFactors.filter(Boolean).slice(0, 4) : fallback.contributingFactors,
    recommendations: Array.isArray(data.recommendations) ? data.recommendations.filter(Boolean).slice(0, 4) : fallback.recommendations,
    environmentalActions: Array.isArray(data.environmentalActions) ? data.environmentalActions.filter(Boolean).slice(0, 4) : fallback.environmentalActions,
  };
}

// Exported so App.jsx (or a future Feature 2 module) can call it
// directly without going through fetchAIInsights, e.g. for an
// instant first pass before the Ollama layer resolves.
//
// `safety` scores follow riskEngine.js's convention: 100 = best/
// safest conditions, 0 = worst. Higher is always better, so the
// "bigger concern" is whichever score is LOWER, not higher.
export function generateRuleBasedInsights(environmental = {}, safety = {}, simulation = {}) {
  const factors = [describeAqi(environmental), describeHeat(environmental), describeTrees(environmental)].filter(
    Boolean,
  );

  // Fallback proxy (used before Feature 2 has run): approximate
  // air safety directly from AQI using the same 0-200 scale
  // riskEngine.js's calculateAQIScore() uses, so it's on the same
  // footing as the real score once one exists.
  const airSafety =
    safety.airSafety ?? (environmental.aqi != null ? Math.max(0, Math.round(100 - (environmental.aqi / 200) * 100)) : null);
  const heatSafety = safety.heatSafety;

  let mainConcern;
  if (airSafety != null && heatSafety != null) {
    mainConcern =
      airSafety <= heatSafety
        ? `Air quality is the bigger factor here — ${describeAqi(environmental) ?? "current readings are elevated"}.`
        : `Heat is the bigger factor here — ${describeHeat(environmental) ?? "current readings are elevated"}.`;
  } else if (environmental.aqi != null) {
    mainConcern = `${describeAqi(environmental)}.`;
  } else {
    mainConcern = "Search for a location to see a safety summary.";
  }

  // "Protect yourself" — personal, immediate, protective actions.
  // Each one names WHO it matters most for and WHY, not just what.
  const recommendations = [];
  if (environmental.aqi != null && environmental.aqi > 100) {
    recommendations.push(
      "Skip prolonged or intense outdoor exertion today, especially if you have asthma or a heart or lung condition.",
    );
  }
  if (environmental.pm25 != null && environmental.pm25 > 35) {
    recommendations.push(
      "For extended time outside, use a well-fitting N95 or KN95 and keep indoor air filtered if possible.",
    );
  }
  if (environmental.feelsLike != null && environmental.feelsLike > 90) {
    recommendations.push(
      "Carry water, move outdoor plans away from the hottest hours, and check on anyone without reliable cooling.",
    );
  }
  if (recommendations.length === 0 && environmental.aqi != null) {
    recommendations.push("No major personal-safety concern is showing; normal outdoor activity is reasonable.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Search for a location to see personal safety recommendations");
  }

  // "Help the environment" — realistic, concrete community actions
  // tied to what's actually driving the numbers here, each with
  // enough detail to actually act on (who to contact, what to ask
  // for, why it works) rather than a generic one-liner.
  const environmentalActions = [];
  if (environmental.treeCoverage != null && environmental.treeCoverage < 30) {
    environmentalActions.push(
      "Ask your city or county urban-forestry program about free or low-cost street-tree planting for your block.",
    );
  }
  if (environmental.aqi != null && environmental.aqi > 100) {
    environmentalActions.push(
      "Combine errands, carpool, or replace short car trips with transit or biking where practical.",
    );
  }
  if (environmental.pm25 != null && environmental.pm25 > 35) {
    environmentalActions.push(
      "Avoid burning yard waste, wood, or trash while PM2.5 is elevated.",
    );
  }
  if (environmental.treeCoverage != null && environmental.treeCoverage >= 30) {
    environmentalActions.push(
      "Protect the existing canopy by reporting damaged trees and watering young street trees during dry spells.",
    );
  }
  if (environmentalActions.length === 0 && environmental.aqi != null) {
    environmentalActions.push(
      "Use the good conditions to join a local tree-planting, park-cleanup, or community-garden effort.",
    );
  }
  const simulationExplanation =
    simulation?.simulatedSafety != null && simulation?.currentSafety != null
      ? `Adding 10% tree coverage moves the overall safety score from ${simulation.currentSafety} to ${simulation.simulatedSafety}, mainly by adding shade and filtering particulates.`
      : null;

    return {
    mainConcern,
    contributingFactors: factors.length > 0 ? factors : ["Search for a location to see contributing factors"],
    recommendations,
    environmentalActions,
    simulationExplanation,
    urgency: getUrgency(environmental, safety),
    nextBestAction: getNextBestAction(environmental, safety),
  };
}

// ---- Layer 2: optional local LLM (Ollama via server/app.py) ----

export async function fetchAIInsights(environmental, safety, simulation) {
  if (!AI_API_URL) {
    return generateRuleBasedInsights(environmental, safety, simulation);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environmental, safety, simulation }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`AI backend responded ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return normalizeInsights(data, generateRuleBasedInsights(environmental, safety, simulation));
  } catch {
    // Backend not configured, not running, timed out, or returned
    // something unusable — fall back to the always-available
    // rule-based version instead of showing an error.
    return generateRuleBasedInsights(environmental, safety, simulation);
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Layer 3: follow-up chat ----
//
// Unlike fetchAIInsights, there is deliberately NO rule-based
// fallback here — a canned template can't hold a real conversation,
// and pretending to would be dishonest. Two REAL paths instead,
// tried in order:
//
//   1. Your own Flask backend (server/app.py), if VITE_AI_API_URL
//      is set and that server is actually reachable. Preferred —
//      the API key never touches the browser.
//   2. A direct browser -> Anthropic (Claude) call, if
//      VITE_ANTHROPIC_API_KEY is set. Works with ZERO backend
//      server running (so it works on a plain deployed GitHub
//      Pages site too) — Anthropic's API explicitly supports this
//      via an opt-in header, unlike OpenAI's API, which blocks
//      direct browser calls with CORS entirely. The tradeoff is
//      still that this key ships inside your built JS and is
//      technically visible to anyone who looks — use a key with a
//      strict spending cap set in your Anthropic Console for this
//      reason.
//
// isChatConfigured() lets the UI decide upfront whether to even
// offer a chat box; fetchChatReply throws only if BOTH paths fail,
// so the UI can show a clear "unavailable" state instead of
// hanging or faking a response.
const CHAT_API_URL = AI_API_URL ? AI_API_URL.replace(/\/api\/ai-insights\/?$/, "/api/chat") : null;
const CLIENT_SIDE_ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const CLIENT_SIDE_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

// Runs once when this file loads. Check your browser DevTools
// console (F12) for this line to see, at a glance, whether your
// env vars were actually picked up -- no more guessing.
console.log(
  "[ai.js] chat config — backend URL:",
  CHAT_API_URL ?? "(not set)",
  "| client-side Anthropic key:",
  CLIENT_SIDE_ANTHROPIC_KEY ? `set (${CLIENT_SIDE_ANTHROPIC_KEY.slice(0, 7)}...)` : "(not set)",
);

export function isChatConfigured() {
  return CHAT_API_URL != null || CLIENT_SIDE_ANTHROPIC_KEY != null;
}

// Same strict-grounding instructions as server/app.py's /api/chat
// route — kept in sync by hand since this is the client-side
// mirror of that same behavior, not a shared import (this file
// runs in the browser; app.py runs in Python).
const KNOWN_RESOURCES = [
  "KNOWN RESOURCES (United States, verified national numbers you may share directly when relevant — these are not specific to the person's searched location beyond what's in DATA below):",
  "- Immediate danger to life, health, or property: call 911.",
  "- Report an oil/chemical spill or other hazardous-material release, 24/7: National Response Center, 1-800-424-8802.",
  "- Report a non-emergency environmental violation (industrial smoke or odors, illegal dumping, improper hazardous-waste handling): EPA's online tip form at epa.gov/tips (anonymous is fine), or EPA's Community Hotline, 1-800-962-6215 (Mon–Fri 9am–5pm ET).",
  "- Poisoning or toxic exposure: Poison Control, 1-800-222-1222, 24/7.",
  "- Current air quality conditions and alerts for any US location: airnow.gov.",
].join("\n");

function buildChatSystemPrompt(context) {
  return (
    "You are a friendly environmental health assistant. You must ground " +
    "every answer STRICTLY in the DATA below or in KNOWN RESOURCES below " +
    "— never invent numbers, locations, health claims, or facts that " +
    "aren't in one of the two.\n\n" +
    "DATA (this is the only data you have for the person's searched " +
    "location, JSON): " +
    JSON.stringify(context) +
    "\n\n" +
    KNOWN_RESOURCES +
    "\n\n" +
    "If a question genuinely cannot be answered from DATA or KNOWN " +
    "RESOURCES (e.g. they ask about a different city's real-time " +
    "conditions, a personal health diagnosis, or something this " +
    "dashboard doesn't track), say plainly that you don't have that " +
    "information here, and point to the closest resource above or their " +
    "local health department. Never guess to fill the gap. Answer " +
    "directly and concisely (2-4 sentences unless they ask for more " +
    "detail). Don't restate the raw JSON back at them."
  );
}

async function fetchChatReplyFromBackend(messages, context) {
  if (!CHAT_API_URL) throw new Error("Backend not configured");

  const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Chat backend responded ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data.reply;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchChatReplyDirectFromAnthropic(messages, context) {
  if (!CLIENT_SIDE_ANTHROPIC_KEY) throw new Error("Client-side Anthropic key not configured");

  const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLIENT_SIDE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        // Anthropic's explicit, documented opt-in for calling their API
        // directly from browser JS — without this header, they
        // deliberately block the request with CORS (see their API docs).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLIENT_SIDE_ANTHROPIC_MODEL,
        max_tokens: 400,
        system: buildChatSystemPrompt(context),
        messages, // Anthropic takes the system prompt separately, not as a message
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Anthropic responded ${response.status}`);

    return data.content[0].text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// `messages` is the running conversation: [{ role: "user"|"assistant", content }, ...]
// `context` is whatever appData the caller wants the model aware of
// (environmental/safety/simulation) — sent fresh with every message
// since neither path keeps conversation state on its own.
export async function fetchChatReply(messages, context) {
  if (CHAT_API_URL) {
    try {
      return await fetchChatReplyFromBackend(messages, context);
    } catch {
      // Backend configured but not reachable right now — fall
      // through to the direct path below rather than giving up.
    }
  }

  if (CLIENT_SIDE_ANTHROPIC_KEY) {
    return fetchChatReplyDirectFromAnthropic(messages, context);
  }

  throw new Error("No chat backend or client-side API key configured");
}