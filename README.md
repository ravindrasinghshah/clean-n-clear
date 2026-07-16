# clean-n-clear

Devpost Hackathon - Skin care routine: Clean and Clear.

## MVP

Clean n Clear is a responsive skincare routine curator for the US market. Users upload a selfie, add routine preferences, and receive a cosmetic skincare routine generated from Gemini image analysis plus rule-based safety constraints.

## Features

- Mobile-first landing page with a dismissible US-market banner.
- Selfie upload/capture flow for MVP face analysis.
- Gemini image-analysis endpoint returning structured skin type, face type, concerns, confidence, notes, and safety flags.
- Hybrid routine generation: deterministic safety rules plus plain-language explanations.
- Browser-local routine saving with no account or database required.
- Morning, evening, and optional weekly routine steps.
- Cosmetic safety disclaimer and no-diagnosis positioning.

## Local setup

```bash
npm install
npm run dev
```

Create `.env.local` with:

```bash
GEMINI_API_KEY=...
GEMINI_VISION_MODEL=gemini-2.0-flash
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add the environment variables above.
3. Deploy the default Next.js build.

## Safety scope

This app provides cosmetic routine guidance only. It does not diagnose medical conditions or replace a dermatologist. Users should seek professional care for severe, painful, rapidly changing, or persistent symptoms.
