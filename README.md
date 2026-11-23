# RESPONDA — AI-Assisted Emergency Operations Platform

**Every second matters. Every detail counts.**

RESPONDA is an AI-assisted emergency intake, location intelligence, and human-controlled command dispatch coordination platform designed for private emergency-response organisations in Lagos, Nigeria.

---

## Key Capabilities

- **Command Centre & Incident Triage**: Prioritises unaccepted emergencies, verified incidents, available response units, and active dispatches with explicit human-in-the-loop approval before any unit is dispatched.
- **Stage-Based Emergency Simulation Engine**: End-to-end 10-stage interactive demonstration covering incoming simulated calls, AI intake & voice transcription, Lagos landmark/GPS intelligence, human takeover, location verification, unit assignment, 60-second live tracking countdown, arrival, patient pickup/hospital transport, and incident closure.
- **AI Intake & Gemini Live Bridge**: Server-side `@google/genai` integration with safe offline demonstration fallback when `GEMINI_API_KEY` is not set.
- **Provider-Independent Telephony Adapter**: Clean `VoiceProviderAdapter` abstraction (`LocalSimulationVoiceAdapter` active by default) isolating intake and dispatch workflows from specific telephony vendors.
- **Analytics & Conversation Intelligence**: Operational KPIs, priority/category/geographic breakdowns, talk ratios, and transcript completeness tracking.

---

## LOCAL DEVELOPMENT SETUP

### 1. Required Runtime Versions

RESPONDA targets the **Node.js 26.x Active LTS** release line:

- **Node.js**: `26.13.1` Active LTS (`>=26.13.1 <27.0.0`, pinned in `.nvmrc`)
- **npm**: `11.x` latest stable compatible with Node.js 26 (`>=11.0.0`, bundled with Node.js 26.13.1 LTS)

Verify your installed versions before starting:

```bash
node -v
npm -v
```

### 2. Installing Node.js 26 LTS on Windows 10 / 11

Choose **one** of the following methods on Windows:

- **Option A — Windows Package Manager (`winget`) in PowerShell**:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
  Restart PowerShell after installation, then verify `node -v` and `npm -v`.

- **Option B — Official Windows Installer (`.msi`)**:
  1. Download the **Node.js 26.13.1 LTS (64-bit Windows `.msi`)** installer from [https://nodejs.org/](https://nodejs.org/).
  2. Run the installer with default options (ensuring **npm package manager** and **Add to PATH** remain enabled).
  3. Open a new **PowerShell** or **Command Prompt** window and confirm `node -v` reports `v26.13.1` (or newer `26.x` LTS) and `npm -v` reports `11.x`.

- **Option C — `nvm-windows` (if managing multiple Node versions)**:
  ```powershell
  nvm install 26.13.1
  nvm use 26.13.1
  ```

### 3. Clone the Repository & Install Dependencies

```bash
git clone <your-repository-url>
cd responda
npm ci
```

> Always use `npm ci` for a clean, deterministic install matching `package-lock.json` (`lockfileVersion: 3`). Do **not** use `--force` or `--legacy-peer-deps`.

### 4. Environment Configuration (`.env`)

Create a local `.env` file from `.env.example` (never commit `.env` to Git):

- **Windows PowerShell**:
  ```powershell
  Copy-Item .env.example .env
  ```
- **Windows Command Prompt (`cmd.exe`)**:
  ```cmd
  copy .env.example .env
  ```
- **macOS / Linux**:
  ```bash
  cp .env.example .env
  ```

Available environment variables in `.env.example`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional | Enables live `@google/genai` intake extraction and Gemini Live audio bridge. Without it, RESPONDA runs safely in Simulated Demo Intake mode. |
| `APP_URL` | Optional | Public URL of the deployed application. |
| `OPENROUTESERVICE_API_KEY` | Optional | Enables live Lagos driving routes and ETAs via OpenRouteService. Without it, OpenStreetMap tiles and simulated demo corridor overlays remain active. |
| `FIREBASE_PROJECT_ID` | Optional | Configures Firebase project identification metadata; local atomic JSON persistence (`data/responda-db.json`) is active by default. |
| `CARRIER_LOCATION_ENDPOINT` | Optional | Endpoint for authorised telecom/AML network location lookup. Never fabricated when unconfigured. |

### 5. Running, Testing & Building Locally

Start the full-stack development server (Express API + WebSocket bridges + Vite middleware on **port `3000`**):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Additional cross-platform commands (tested for Windows PowerShell, Command Prompt, macOS, and Linux):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development server (`tsx server.ts`) on port `3000` |
| `npm test` | Run all 22 automated domain & simulation tests (`src/utils/*.test.ts`) |
| `npm run lint` | Run strict TypeScript type-checking (`tsc --noEmit`) |
| `npm run build` | Build production client bundle into `dist/` (`vite build`) |
| `npm start` | Start production server (`node server.ts` using native Node TypeScript support) |
| `npm run clean` | Remove build artifacts (`dist/`, `server.js`) cross-platform |

To run a production preview locally on Windows PowerShell:

```powershell
npm run build
$env:NODE_ENV="production"
npm start
```

Or in Windows Command Prompt (`cmd.exe`):

```cmd
npm run build
set NODE_ENV=production&& npm start
```

### 6. Troubleshooting (Windows & Local Environments)

- **PowerShell script execution policy error (`npm.ps1 cannot be loaded because running scripts is disabled`)**:
  Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in PowerShell, or run commands from Windows Command Prompt (`cmd.exe`).
- **Port `3000` already in use (`EADDRINUSE`)**:
  Find and stop the process holding port 3000 in PowerShell:
  ```powershell
  Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
  Stop-Process -Id <PID> -Force
  ```
  Or temporarily start on another port in PowerShell: `$env:PORT="3001"; npm run dev`.
- **Dependency or cache mismatch after pulling updates**:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  npm ci
  ```
- **Missing API keys**:
  If `GEMINI_API_KEY` or `OPENROUTESERVICE_API_KEY` are unset, RESPONDA starts normally and operates in honest, clearly labelled demonstration mode with local persistence in `data/responda-db.json`.
