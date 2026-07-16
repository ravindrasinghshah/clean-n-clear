# clean-n-clear

Devpost Hackathon - OpenAI build week - Skin care routine: Clean and Clear.

## MVP

Clean n Clear is a responsive skincare routine curator for the US market. Users upload a selfie, add routine preferences, and receive a cosmetic skincare routine generated from OpenAI vision analysis plus rule-based safety constraints.

## Features

- Mobile-first landing page with a dismissible US-market banner.
- Selfie upload/capture flow for MVP face analysis.
- OpenAI vision API endpoint returning structured skin type, face type, concerns, confidence, notes, and safety flags.
- Hybrid routine generation: deterministic safety rules plus plain-language explanations.
- Guest and email-link Firebase Authentication setup.
- Morning, evening, and optional weekly routine steps.
- Cosmetic safety disclaimer and no-diagnosis positioning.

## Local setup

```bash
npm install
npm run dev
```

Create `.env.local` with:

```bash
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o-mini
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add the environment variables above.
3. Deploy the default Next.js build.

## Safety scope

This app provides cosmetic routine guidance only. It does not diagnose medical conditions or replace a dermatologist. Users should seek professional care for severe, painful, rapidly changing, or persistent symptoms.
