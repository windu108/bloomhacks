# BloomKnights - Solar Analysis Platform

An AI-powered solar installation analysis tool that evaluates residential properties for solar compatibility using satellite imagery, Google Solar API, and Gemini AI vision analysis.

**Built by 
Ethan
Akshay
Bill
Gabe
During Bloom Hacks**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installing Dependencies](#installing-dependencies)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)

---

## Architecture Overview

The application runs **three servers** simultaneously:

| Server | Command | Port | Purpose |
|--------|---------|------|---------|
| **Node.js API** | `npm run api` | `3001` | Google Maps geocoding, satellite imagery, Solar API, roof tracing (Claude) |
| **Flask Backend** | `python app_server.py` | `5001` | Gemini AI image analysis, solar compatibility scoring, energy price estimation |
| **Vite Dev Server** | `npm run dev` | `5173` | React frontend (auto-proxies API calls to the correct backends) |

### Request Flow

```
React (Vite :5173)
  │
  ├── /api/describe-image  ──proxy──▶  Flask (:5001)  ──▶  Gemini API
  │
  └── /api/* (all others)  ──proxy──▶  Node.js (:3001)
        ├── /api/geocode    ──▶  Google Geocoding API
        ├── /api/satellite  ──▶  Google Static Maps API
        ├── /api/solar      ──▶  Google Solar API
        ├── /api/trace      ──▶  Anthropic Claude (roof tracing)
        └── /api/recommend  ──▶  (recommendation logic)
```

---

## Prerequisites

- **Node.js** v18+ and `npm`
- **Python** 3.10+
- API keys (see [Environment Setup](#environment-setup))

---

## Environment Setup

### 1. Create the `.env` file

All environment variables go in a single file at `backend/.env`:

```bash
touch backend/.env
```

### 2. Add your API keys

Edit `backend/.env` with the following content:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 3. Where to get the keys

| Key | Required By | How to Get |
|-----|------------|------------|
| `GEMINI_API_KEY` | Flask backend (`gemini.py`) | [Google AI Studio](https://aistudio.google.com/app/apikey) - Get a free API key |
| `GOOGLE_MAPS_API_KEY` | Node.js server (geocode, satellite, solar routes) | [Google Cloud Console](https://console.cloud.google.com/) - Enable **Geocoding API**, **Maps Static API**, and **Solar API** |
| `ANTHROPIC_API_KEY` | Node.js server (`trace.cjs`) | [Anthropic Console](https://console.anthropic.com/) - Used for roof outline tracing with Claude |

> **⚠️ Important:** The `.env` file is listed in `.gitignore` (both root and `backend/.gitignore`), so your keys will never be committed to version control.

---

## Installing Dependencies

### Step 1: Install Node.js dependencies

```bash
npm install
```

### Step 2: Set up Python virtual environment

```bash
cd backend
python3 -m venv venv
```

### Step 3: Install Python dependencies

```bash
cd backend
./venv/bin/pip install -r requirements.txt
```

**Python packages installed:**
- `flask` - Web server
- `flask-cors` - Cross-origin requests from React
- `google-genai` - Google Gemini AI SDK
- `python-dotenv` - Load `.env` variables

---

## Running the Application

You need **three terminal windows** to run all services.

### Terminal 1: Node.js API Server

```bash
npm run api
```

> Starts the Express server on `http://localhost:3001`.
> Handles Google Maps geocoding, satellite imagery, Solar API, and roof tracing via Claude.

### Terminal 2: Flask Backend (Gemini AI)

```bash
cd backend
./venv/bin/python app_server.py
```

> Starts the Flask server on `http://localhost:5001`.
> Handles Gemini AI image analysis for roof assessment, solar compatibility scoring, and energy price estimation.

### Terminal 3: React Frontend

```bash
npm run dev
```

> Starts the Vite dev server on `http://localhost:5173` (or `5174` if `5173` is busy).
> Open this URL in your browser to use the application.

---

## What Each Service Does

### 🔵 Node.js API (`:3001`)

| Route | Description |
|-------|-------------|
| `GET /api/geocode?address=...` | Convert an address to latitude/longitude coordinates |
| `GET /api/satellite?lat=&lon=` | Get bounding box for satellite imagery |
| `GET /api/satellite/image?lat=&lon=` | Proxy satellite images (hides API key from client) |
| `GET /api/solar?lat=&lon=` | Fetch solar potential data (panel slots, roof segments, building data) |
| `GET /api/trace?lat=&lon=` | Use Claude to trace roof outlines from satellite imagery |
| `GET /api/recommend?lat=&lon=&bill=` | Get solar recommendations |

### 🟢 Flask Backend (`:5001`)

| Route | Description |
|-------|-------------|
| `GET /health` | Health check - returns `{"ok": true}` |
| `POST /api/describe-image` | Main AI endpoint - accepts base64 image + context, returns roof analysis, compatibility score, energy price, and next steps |

### 🟣 React Frontend (`:5173`)

The Vite config proxies requests automatically:
- `/api/describe-image` → `http://localhost:5001` (Flask)
- All other `/api/*` → `http://localhost:3001` (Node.js)

---

## Testing

### Quick API connectivity test

```bash
cd backend
./venv/bin/python test_api.py
```

This sends a simple prompt to Gemini to verify your API key and model are working.

### Stress test (solar evaluation scenarios)

```bash
cd backend
./venv/bin/python test_case.py
```

This runs 5 different property scenarios through the AI evaluator to test scoring logic.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Port 5001 is in use` | Kill the existing process: `lsof -ti:5001 | xargs kill -9` |
| `Port 5173 is in use` | Vite auto-selects `5174`. Look at terminal output for the correct URL. |
| `ModuleNotFoundError: No module named 'dotenv'` | Make sure you're using the venv Python: `./venv/bin/python app_server.py` |
| `Gemini API quota exceeded` | Free tier limits have been hit. Wait for reset or enable billing in Google AI Studio. |
| `Google Maps API error` | Verify `GOOGLE_MAPS_API_KEY` is correct and the required APIs are enabled in Google Cloud Console. |
| `Cannot find module '@anthropic-ai/sdk'` | Run `npm install` from the project root. |

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Three.js (3D roof viewer), Recharts (charts)
- **Backend (Node):** Express 5, Google Maps APIs, Anthropic Claude
- **Backend (Python):** Flask, Google Gemini AI SDK
- **APIs:** Google Geocoding, Google Static Maps, Google Solar API, Gemini 2.0 Flash Lite, Anthropic Claude
