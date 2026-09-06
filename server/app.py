"""
AI backend for EcoRisk Live -- Feature 3.

Uses Groq's API, which is free (no credit card required) and
OpenAI-compatible, so it works with the same `openai` Python
package -- only the base_url and model name differ from a real
OpenAI setup. (OpenAI's own API is pay-per-use with no ongoing
free tier, which is why this uses Groq instead.)

This still needs to run SOMEWHERE the frontend can reach it over
the network -- your own machine during development/demos, or a
real hosted server if you want it live for the public. A static
site like GitHub Pages cannot run this by itself.

SETUP:
  1. Get a free API key: https://console.groq.com/keys
     (sign up with email, no card needed)
  2. pip install -r requirements.txt
  3. Create a file named .env in this server/ folder containing:
       GROQ_API_KEY=gsk_...your-key-here...
     NEVER commit this file or put the key in any frontend code --
     anyone who saw it could use up your free quota. This
     project's .gitignore already excludes .env, but double-check
     before pushing.
  4. python app.py                        (runs on :5001)
  5. In the project ROOT (not this server folder), create
     .env.local containing:
       VITE_AI_API_URL=http://localhost:5001/api/ai-insights
     src/lib/ai.js automatically falls back to the rule-based
     generator if this isn't set, or if this server isn't
     reachable -- so it's safe to leave off entirely.
"""

import json
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (localhost:5173) to call this

MODEL = "openai/gpt-oss-120b"  # Groq's free-tier model; see console.groq.com/docs/models for the current list

_client = None


def get_client():
    """Created lazily, on the first actual request, instead of at
    import time -- so a missing/blank API key produces a normal
    502 error the frontend already knows how to catch and fall
    back from, instead of crashing the whole Flask process before
    it can even start serving requests."""
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Create server/.env with "
                "GROQ_API_KEY=gsk_... (see the setup notes at the top of this file)."
            )
        # Groq exposes an OpenAI-compatible API, so the same `openai`
        # package works here -- base_url is the only thing that changes.
        _client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    return _client


def build_prompt(environmental, safety, simulation):
    """Turns the app's data objects into one prompt, and asks the
    model to reply with ONLY a JSON object shaped like the `ai`
    section of src/data.js -- so this file can hand the response
    straight back to the frontend with no extra parsing on either
    side."""
    return f"""You are an environmental health assistant. Based on the
    data below, respond with ONLY a JSON object (no markdown, no code
    fences, no extra text) with these exact keys:
     "mainConcern": one sentence naming the single biggest concern
    "contributingFactors": array of 2-3 short strings
    "recommendations": array of 2-3 short, actionable, PERSONAL safety
    steps (things the person can do right now to protect themselves)
    "environmentalActions": array of 2-3 short, actionable, REALISTIC
    community/environmental steps (things that would improve local
    conditions over time, e.g. supporting tree-planting programs,
    reducing vehicle emissions, avoiding burning yard waste)
  "simulationExplanation": one sentence, or null if simulation data is missing

DATA:
  Air Quality Index (AQI): {environmental.get("aqi")}
  AQI category: {environmental.get("aqiLabel")}
  PM2.5: {environmental.get("pm25")} micrograms/m3
  Temperature: {environmental.get("temperature")} F (feels like {environmental.get("feelsLike")} F)
  Tree coverage: {environmental.get("treeCoverage")} percent

  Scores below are SAFETY scores: 100 = best/safest conditions,
  0 = worst. Higher is always better.
  Air safety score: {safety.get("airSafety")} / 100
  Heat safety score: {safety.get("heatSafety")} / 100
  Overall safety score: {safety.get("overallSafety")} / 100
  Simulated safety after +10% tree coverage: {simulation.get("simulatedSafety")} / 100
"""


def generate_insights(environmental, safety, simulation):
    """Calls the model and returns the parsed dict. Raises on any
    failure (no API key, bad JSON, rate limit, etc.) -- the route
    below turns that into an HTTP error, and the frontend turns
    THAT into a fallback to the rule-based generator, so the UI
    never breaks."""
    prompt = build_prompt(environmental, safety, simulation)

    response = get_client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},  # guarantees valid JSON back
    )

    raw = response.choices[0].message.content.strip()
    return json.loads(raw)


@app.route("/api/ai-insights", methods=["POST"])
def ai_insights():
    body = request.get_json(force=True) or {}
    environmental = body.get("environmental") or {}
    safety = body.get("safety") or {}
    simulation = body.get("simulation") or {}

    try:
        insights = generate_insights(environmental, safety, simulation)
        return jsonify(insights)
    except Exception as error:  # no API key, bad JSON, rate limit, etc.
        return jsonify({"error": str(error)}), 502


@app.route("/api/chat", methods=["POST"])
def chat():
    """Free-form follow-up chat about a location's data. Returns
    plain text, not structured JSON -- there is deliberately NO
    rule-based fallback for this route on the frontend (see
    src/lib/ai.js's fetchChatReply): a template can't hold a real
    conversation. If this fails, the chat UI shows a clear
    "unavailable" state instead of a fake reply."""
    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    context = body.get("context") or {}

    # Real, verified national contact points (checked at the time this
    # was written). Handing these to the model directly means it can
    # answer "what number do I call" questions with real information
    # instead of either inventing a number or refusing to answer.
    known_resources = (
        "KNOWN RESOURCES (United States, verified national numbers you may "
        "share directly when relevant -- these are not specific to the "
        "person's searched location beyond what's in DATA below):\n"
        "- Immediate danger to life, health, or property: call 911.\n"
        "- Report an oil/chemical spill or other hazardous-material "
        "release, 24/7: National Response Center, 1-800-424-8802.\n"
        "- Report a non-emergency environmental violation (industrial "
        "smoke or odors, illegal dumping, improper hazardous-waste "
        "handling): EPA's online tip form at epa.gov/tips (anonymous is "
        "fine), or EPA's Community Hotline, 1-800-962-6215 "
        "(Mon-Fri 9am-5pm ET).\n"
        "- Poisoning or toxic exposure: Poison Control, 1-800-222-1222, "
        "24/7.\n"
        "- Current air quality conditions and alerts for any US location: "
        "airnow.gov."
    )

    system_prompt = (
        "You are a friendly environmental health assistant. You must "
        "ground every answer STRICTLY in the DATA below or in KNOWN "
        "RESOURCES below -- never invent numbers, locations, health "
        "claims, or facts that aren't in one of the two.\n\n"
        "DATA (this is the only data you have for the person's searched "
        "location, JSON): " + json.dumps(context) + "\n\n"
        + known_resources + "\n\n"
        "If a question genuinely cannot be answered from DATA or KNOWN "
        "RESOURCES (e.g. they ask about a different city's real-time "
        "conditions, a personal health diagnosis, or something this "
        "dashboard doesn't track), say plainly that you don't have that "
        "information here, and point to the closest resource above or "
        "their local health department. Never guess to fill the gap. "
        "Answer directly and concisely (2-4 sentences unless they ask "
        "for more detail). Don't restate the raw JSON back at them."
    )

    openai_messages = [{"role": "system", "content": system_prompt}] + messages

    try:
        response = get_client().chat.completions.create(model=MODEL, messages=openai_messages)
        return jsonify({"reply": response.choices[0].message.content.strip()})
    except Exception as error:
        return jsonify({"error": str(error)}), 502


if __name__ == "__main__":
    app.run(port=5001, debug=True)