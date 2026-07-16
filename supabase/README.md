# Project One — Connect & Collab · Supabase setup

The app (`public/collab.html`) talks to Supabase directly from the browser using
the anon key in `public/collab-config.js`.

## First-time setup
1. **Schema** — In the Supabase SQL editor, run `schema.sql` (tables + seed roster).
2. **v2 migration** — Then run `migrations/002_geolocation_auth.sql`
   (adds `profiles.lat/lng` for proximity + `profiles.user_id` for auth linkage).

## Enabling real auth (email one-time code)
The app now signs users in with a 6-digit email code (`signInWithOtp` →
`verifyOtp`), then links their profile to the Supabase Auth user.

- **Auth → Providers → Email**: make sure Email is enabled (it is by default).
- Email confirmation is **not** required for the OTP flow.
- Supabase's built-in email is rate-limited — fine for a demo. For real volume,
  configure SMTP under **Auth → Emails**.

## Verify it works (in a browser — this can't be checked server-side)
1. Open `/collab.html`. You should get the **Sign in** sheet.
2. Enter your email → receive a code → verify → complete the profile form.
3. Refresh: you should stay signed in (real session, not localStorage).
4. Allow location: the header should show your neighborhood and the Connect tab
   should rank people by distance. Deny it: everything still works, falling back
   to the event name.

## Tightening security (do this only AFTER the above works)
The demo uses permissive RLS (anyone with the anon key can write). The stricter,
`auth.uid()`-scoped policies are ready but commented at the bottom of
`migrations/002_geolocation_auth.sql`. Apply them once sign-in is confirmed —
applying them while auth is misconfigured will lock everyone out.
