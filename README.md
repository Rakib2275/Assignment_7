# Rakib frontend

Next.js App Router frontend for Rakib's load-shedding and service-area service.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`, set `BACKEND_URL` to the backend server URL (including its port), and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same Google OAuth client ID configured as `GOOGLE_CLIENT_ID` in the backend when enabling Google sign-in.
3. Start the backend, then run `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000).

Next.js proxies `/api/v1/*` requests to `BACKEND_URL`; the backend does not need frontend-side API changes. The customer registration flow follows the backend's email OTP verification contract. The signed-in home dashboard loads the authenticated profile, schedules, and service areas from the existing API.

The signed-in workspace exposes customer outage reports and payment history, customer service-area/schedule browsing, operator incident and schedule tools, and admin network management for zones, substations, feeders, areas, and schedules. These screens use only existing backend endpoints. The current payment API requires an outage ID when starting checkout but does not associate the payment with that report; the payment screen calls this out rather than implying the transaction is linked.

The signed-in workspace is also available as dedicated routes: `/areas`, `/schedules`, `/incidents`, and `/payments`. Administrators can open `/management` for user access management and `/analytics` for platform and outage analytics. These routes require an active login and open the corresponding role-appropriate page. Profile images are uploaded through the backend's profile-image endpoint, and expired access tokens are refreshed using the HttpOnly refresh-token cookie.