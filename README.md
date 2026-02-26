# Device Source of Truth (DST)

Internal platform consolidating Disney Streaming's NCP/ADK device ecosystem data into a single, authoritative system of record.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Vite 7
- **Backend:** Firebase Cloud Functions (Node.js/Express REST API)
- **Database:** Firestore
- **Auth:** Firebase Auth (Google OAuth, domain-restricted)
- **Analytics:** Google Analytics via Firebase
- **Hosting:** Firebase Hosting

## Getting Started

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd functions && npm install && cd ..

# Configure environment
cp .env.example .env   # fill in your Firebase keys

# Run frontend dev server
npm run dev

# In a separate terminal, run functions emulator (optional)
cd functions && npm run dev
```

## Project Structure

```
src/                    React frontend (pages, components, hooks, lib)
functions/src/          Firebase Cloud Functions backend (routes, services, middleware)
specs/                  Product specification document
```

## Deployment

```bash
# Build everything
npm run build && cd functions && npm run build && cd ..

# Deploy to Firebase (hosting + functions + rules)
npx firebase deploy

# Deploy individual services
npx firebase deploy --only hosting
npx firebase deploy --only functions
npx firebase deploy --only firestore:rules
```

## Key Features

- Partner & Device Registry with full-text search
- 90-field hardware spec ingestion from partner questionnaires
- Configurable hardware tier scoring engine
- Datadog telemetry CSV upload and version tracking
- Spec coverage and partner reports with CSV/PDF export
- Role-based access (Viewer, Editor, Admin)
- Full audit log of all data changes
