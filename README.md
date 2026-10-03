# Rakib frontend

Next.js App Router frontend for Rakib's load-shedding and service-area service.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `BACKEND_URL` to the backend server URL (including its port).
3. Start the backend, then run `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000).

Next.js proxies `/api/v1/*` requests to `BACKEND_URL`; the backend does not need frontend-side API changes. The customer registration flow follows the backend's email OTP verification contract. The signed-in home dashboard loads the authenticated profile, schedules, and service areas from the existing API.