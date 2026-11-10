# Meetflow

Meetflow is a MERN meeting app with password and Google sign-in, email verification, password reset, and a passwordless email-code option for existing accounts. After signing in, people can create meetings, share an invite, and use the existing browser-based video meeting tools.

## Requirements

- Node.js 20 or newer
- A MongoDB database (local or MongoDB Atlas)
- An SMTP account for email codes

## Configure and run on Windows

1. Install Node.js from https://nodejs.org/.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB connection string.
4. Generate two different random secrets and put them in `JWT_SECRET` and `OTP_SECRET`:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Add your SMTP host, port, username, password, and verified sender address to the `SMTP_*` variables.
6. To enable Google sign-in, create an OAuth 2.0 Web application client in Google Cloud, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and add `http://127.0.0.1:5173/api/auth/google/callback` as an authorized redirect URI. For another frontend origin, set `GOOGLE_REDIRECT_URI` to that origin plus `/api/auth/google/callback`; it must match the Google Cloud configuration exactly.
7. Double-click `start.bat`, or run `npm install` and `npm run dev`.
8. Open the local frontend URL printed by Vite (usually http://127.0.0.1:5173 unless that port is already in use).

The development server serves the React authentication pages on the Vite port and the Express API on the port defined by `PORT` (default 8000). If a port is already occupied, set `PORT` and `VITE_PORT` in `.env` before starting the app. For a production build, run `npm run build`, then `npm start`; Express serves the built React app and meeting UI on the configured port.

For email, port 465 uses TLS and port 587 uses STARTTLS. OTP sending returns a configuration error when SMTP settings are missing; verification codes are never printed to logs or returned by the API.

## Authentication and account safety

- New password accounts are only created after a one-time email verification code is confirmed. Passwords are stored as salted scrypt hashes, never as plain text.
- Existing passwordless accounts can continue signing in with a one-time 6-digit email code. They can set a password using the emailed reset flow.
- Google sign-in uses Google's OpenID Connect ID token verification and requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Password reset links are single-use, expire after 30 minutes, and are delivered through the configured SMTP provider.
- Codes expire after 5 minutes, are stored as keyed hashes, and allow at most 5 verification attempts.
- Requests have resend cooldowns, contact-level send limits, and IP-based rate limits.
- Sessions use a signed, HTTP-only, same-site cookie that expires after 7 days, or 24 hours when “Remember me” is unchecked.
- Email addresses are unique and must be verified before an account is created.

## Video meetings

The app retains the browser-based Meetflow meeting experience, including WebRTC audio/video, screen sharing, notes, chat, and browser-side recording. Meeting REST endpoints and WebSocket signaling run in Express; meeting and account data are stored in MongoDB.

WebRTC needs HTTPS or localhost for camera and microphone access. STUN alone cannot traverse every firewall; reliable public calls may require a TURN service. The mesh-style demo is not designed for production rooms with 100 active video streams. Use a Selective Forwarding Unit (SFU), TURN infrastructure, and a persistent Node host for larger deployments. Serverless platforms that do not support long-lived WebSockets cannot run all meeting features.

Invite links can be shared with other registered Meetflow users. Opening an invite asks users to sign in or register before entering the room.

## Tests and checks

```powershell
npm test
npm run build
```

The existing Python test suite for the original FastAPI backend remains available with `python -m pytest`, but the MERN application is started with Node.js. The Python backend is no longer the app entry point.

## Deploying on Vercel

The repository includes a Vercel configuration that builds the Vite client from `client/dist`, routes API, static meeting assets, and `/meetings` requests to the Node.js function, and sends client-side routes such as `/forgot-password` to the React app. Configure these Vercel environment variables for the Production, Preview, and Development environments as needed:

- `MONGODB_URI`
- `JWT_SECRET` and `OTP_SECRET` (each at least 32 characters and different)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for email verification
- `CLIENT_ORIGIN` set to the public HTTPS production URL, especially when using a custom domain. If unset, the app uses Vercel's production URL.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in; register `<CLIENT_ORIGIN>/api/auth/google/callback` as an authorized redirect URI in Google Cloud and set the same value in `GOOGLE_REDIRECT_URI` if needed.

SMTP must be configured for email registration, email-code sign-in, and password reset. Google sign-in is optional. After changing Vercel environment variables, redeploy so the function receives them. Users can then create accounts from the public registration page; meeting and account data still require authentication.

Vercel can host the frontend and HTTP API, but its serverless functions cannot keep the app's WebSocket signaling connections alive. Video-call signaling and other real-time meeting features therefore need a persistent Node.js host; for the complete app, deploy the frontend/API and WebSocket server on a platform that supports long-lived connections.

## Deploying on Render

The repository includes a Render Blueprint in `render.yaml`. In Render, create a new Blueprint from this repository and provide `MONGODB_URI`, `CLIENT_ORIGIN`, and the SMTP settings when prompted. Render generates separate `JWT_SECRET` and `OTP_SECRET` values. Allow connections from the Render service to your MongoDB Atlas cluster.

After Render creates the service, set `CLIENT_ORIGIN` to its public HTTPS URL and set `GOOGLE_REDIRECT_URI` to `<CLIENT_ORIGIN>/api/auth/google/callback`, then redeploy. Add that exact redirect URI to the Google OAuth client's authorized redirect URIs. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render to enable Google sign-in. These values must come from your Google Cloud OAuth client; the app cannot complete Google sign-in without them.

The service builds the Vite client and serves it with the Express API and WebSocket signaling on the same persistent Node.js host. The `/api/health` endpoint is configured as its deployment health check.

## Troubleshooting

- **MongoDB connection fails on Render (`ReplicaSetNoPrimary`):** confirm the Atlas cluster is running and the URI uses a MongoDB **database user** (not your Atlas website login). In Atlas, allow the Render service's outbound IP addresses in **Network Access**; if the service has changing outbound IPs, use a fixed-egress option or allow `0.0.0.0/0` only with a strong, unique database password. Update `MONGODB_URI` in Render with the current Atlas driver URI and password (URL-encode special characters), then redeploy. Do not put the URI in source control or share it in logs.
- **Email code is not sent:** verify the SMTP server, TLS port, credentials, and sender address.
- **Camera/microphone unavailable:** use a supported browser, allow device permissions, and close other apps using the camera.
- **Remote video cannot connect:** confirm both accounts are using the same invite, check the browser console, and configure TURN if needed.
- **Node cannot find a dependency:** run `npm install`.
