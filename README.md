# Device Source of Truth

Internal tool for managing partner device data.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4
- **Build:** Vite 7
- **Backend:** Firebase (Auth, Firestore, Hosting, Analytics)

## Getting Started

```bash
npm install
cp .env.example .env   # fill in your Firebase keys
npm run dev
```

## Firebase

Project: `device-source-of-truth`

```bash
npx firebase deploy --only hosting
npx firebase deploy --only firestore:rules
```
