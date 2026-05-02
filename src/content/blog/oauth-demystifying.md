---
title: "OAuth Demystified"
description: "A practical walk through OAuth 2.0 — components, flow, scopes, OIDC, and why the Authorization Code grant is the one to reach for."
pubDate: 2026-05-02T12:00
tags: ["oauth", "auth", "general"]
---

> OAuth stands for **Open Authorization**. It's an open standard focused on *delegated authorization*.
>
> **What is delegated auth?** Letting a website or app access *your* data — email, name, profile — without you handing over your password.
>
> *Example:* you use your Gmail account to log in to MongoDB Atlas. You never give Atlas your Google password, but Atlas still gets your email and name.

## The flow at a glance

Before getting into the parts, here's the whole dance in one picture:

<figure class="diagram" role="img" aria-label="OAuth 2.0 Authorization Code flow diagram"><svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="oauth-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker><marker id="oauth-arrow-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#4ade80"/></marker><marker id="oauth-arrow-fg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#e9e9ec"/></marker></defs><rect x="20" y="20" width="140" height="36" rx="6" fill="#16161a" stroke="#2a2a31"/><rect x="220" y="20" width="140" height="36" rx="6" fill="#16161a" stroke="#2a2a31"/><rect x="420" y="20" width="140" height="36" rx="6" fill="#16161a" stroke="#2a2a31"/><rect x="600" y="20" width="140" height="36" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="90" y="44" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">User</text><text x="290" y="44" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">Client (App)</text><text x="490" y="44" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">Auth Server</text><text x="670" y="44" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">Resource Server</text><line x1="90" y1="56" x2="90" y2="345" stroke="#2a2a31" stroke-dasharray="4 4"/><line x1="290" y1="56" x2="290" y2="345" stroke="#2a2a31" stroke-dasharray="4 4"/><line x1="490" y1="56" x2="490" y2="345" stroke="#2a2a31" stroke-dasharray="4 4"/><line x1="670" y1="56" x2="670" y2="345" stroke="#2a2a31" stroke-dasharray="4 4"/><text x="40" y="92" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">1</text><line x1="90" y1="92" x2="286" y2="92" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#oauth-arrow)"/><text x="100" y="84" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">"Login with Google"</text><text x="40" y="132" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">2</text><line x1="290" y1="132" x2="486" y2="132" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#oauth-arrow)"/><text x="300" y="124" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">redirect: client_id, scope, redirect_uri</text><text x="300" y="146" fill="#7c7c85" font-size="10" font-style="italic" font-family="Inter, sans-serif">front channel (browser)</text><text x="40" y="182" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">3</text><line x1="90" y1="182" x2="486" y2="182" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#oauth-arrow)"/><text x="100" y="174" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">log in &amp; consent to scopes</text><text x="40" y="222" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">4</text><line x1="490" y1="222" x2="294" y2="222" stroke="#4ade80" stroke-width="1.5" marker-end="url(#oauth-arrow-back)"/><text x="300" y="214" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">redirect back with ?code=…</text><text x="40" y="262" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">5</text><line x1="290" y1="262" x2="486" y2="262" stroke="#e9e9ec" stroke-width="1.5" marker-end="url(#oauth-arrow-fg)"/><text x="300" y="254" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">exchange: code + client_secret</text><text x="300" y="276" fill="#7c7c85" font-size="10" font-style="italic" font-family="Inter, sans-serif">back channel (server-to-server)</text><text x="40" y="302" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">6</text><line x1="490" y1="302" x2="294" y2="302" stroke="#4ade80" stroke-width="1.5" marker-end="url(#oauth-arrow-back)"/><text x="300" y="294" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">access_token (+ id_token)</text><text x="40" y="338" fill="#8b9eff" font-size="12" font-weight="600" font-family="JetBrains Mono, monospace">7</text><line x1="290" y1="336" x2="666" y2="336" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#oauth-arrow)"/><text x="300" y="328" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">GET /userinfo  Authorization: Bearer …</text></svg><figcaption>Authorization Code flow. Steps 1–4 happen in the user's browser; 5–7 happen on your server.</figcaption></figure>

The rest of this post unpacks each lane and each arrow.

---

## What it looks like to a user

1. User visits an app or website.
2. Clicks **"Login with Google"**.
3. If not already signed into Google, they sign in there first.
4. Google shows a consent screen — *this app wants your email and profile*.
5. User confirms.
6. Browser redirects back to the app (whether the user approved or denied).
7. Behind the scenes, the app talks to Google's APIs for the data the user agreed to share.

That's the whole user-visible part. Everything else is plumbing.

---

## OAuth components

| Term            | What it really is                                                       |
| --------------- | ----------------------------------------------------------------------- |
| Resource Owner  | The user                                                                |
| Client          | Your app or website                                                     |
| Auth Server     | Google's authorization server (`accounts.google.com`)                   |
| Resource Server | Google's APIs — the things you'll call once you have a token            |
| Auth Grant      | The "flavor" of OAuth flow (Authorization Code, PKCE, Client Creds, …)  |
| Redirect URI    | Your app's callback URL, registered in the Google Cloud Console         |
| Access Token    | The bearer token your app uses to call Google APIs on the user's behalf |

### The workflow, in words

1. Your app (Client) sends the user to Google (Auth Server).
2. The user logs in and consents.
3. Google redirects back with an **authorization code**.
4. Your app exchanges that code (plus a client secret) for an **access token**.
5. Your app calls Google APIs (Resource Server) using the token.

---

## Scope and consent

### Scope

It would be a terrible idea if every token was all-or-nothing — *here's a key, do whatever you want*. Scopes are how OAuth says "this token can read your email, but not edit your calendar." Think of them as fine-grained permissions, similar to roles in RBAC.

> **Scope = what the token is allowed to access.**

Common Google scopes:

- `openid` — enables **OpenID Connect** (the identity layer)
- `email` — access to the user's email address
- `profile` — basic profile info (name, picture)

A real example — MongoDB Atlas's "Sign in with Google" URL:

```
https://accounts.google.com/v3/signin/accountchooser
  ?client_id=971390087100-nq1pekkjvhenn2898dr3b7fm7dcl1cjc.apps.googleusercontent.com
  &display=page
  &redirect_uri=https%3A%2F%2Fauth.mongodb.com%2Foauth2%2Fv1%2Fauthorize%2Fcallback
  &response_type=code
  &scope=email+openid+profile
```

Note `response_type=code` and `scope=email+openid+profile`.

### Consent

After the user logs into their Google account, Google shows a **consent screen**: *this app wants permission to do X, Y, Z*. The user can approve or deny each scope.

---

## What you actually get back

When you exchange the authorization code for tokens, Google responds with something like:

```json
{
  "access_token": "ya29.a0AfH6SM...",
  "expires_in": 3599,
  "refresh_token": "1//0gL...",
  "scope": "openid email profile",
  "token_type": "Bearer",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

The `id_token` only appears if you asked for the `openid` scope.

### Why include `openid`?

With `openid` in the scope, you get an `id_token` in the response. The ID token is a signed JWT — your server can verify it locally and extract `email` and `sub` (the user's unique Google ID) without making another network call.

- *No extra round-trip to fetch userinfo* — with only an access token, you'd have to call Google's `/userinfo` endpoint.
- To extract `email` from the ID token, you must include `email` in the scope.
- To extract user metadata (name, picture), you must include `profile` in the scope.

What the ID token looks like as you add scopes:

```jsonc
// scope=openid
{
  "sub": "1234567890",
  "iss": "https://accounts.google.com",
  "aud": "your-client-id"
}
```

```jsonc
// scope=openid email
{
  "sub": "1234567890",
  "aud": "your-client-id",
  "email": "user@gmail.com",
  "email_verified": true
}
```

### When you actually need an access token

The ID token is enough to *identify* the user. You only need an access token when your app needs to *call Google APIs on the user's behalf*:

- Read Gmail → Gmail API
- Access Calendar → Google Calendar API
- Read files → Google Drive API

---

## OAuth vs OpenID Connect

This trips a lot of people up. Short version:

- **OAuth** answers *"Can this app access your data?"* — it's about **authorization**.
- **OpenID Connect (OIDC)** answers *"Who are you?"* — it's about **authentication**.

> OIDC is a thin identity layer **built on top of OAuth**. The `openid` scope is the switch that turns an OAuth flow into an OIDC flow.

| Token | What it tells you |
| --- | --- |
| **Access token** | What this client is allowed to do (authorization) |
| **ID token** | Who the user is (authentication) |

Flow difference, at a glance:

**OAuth (authorization only)**

1. User consents.
2. You get an `access_token`.
3. You call APIs (Gmail, Calendar, etc.).

**OpenID Connect (auth-n + optional auth-z)**

1. User logs in.
2. You get an `id_token` ✓ (who the user is) and optionally an `access_token` (for APIs).
3. You verify identity from the `id_token`.

---

## Why the code-then-token detour?

Why does Google return an authorization *code* first, instead of just handing back the access token?

> Most of the OAuth flow happens in the **front channel** — the user's browser — where you can't trust anyone. Tokens leaked there are tokens stolen.
>
> The code-then-token detour pushes the sensitive step to the **back channel**: your server exchanges the code for the access token using a `client_secret` that never touches the browser.

Even if an attacker intercepts the authorization code, they can't redeem it without the client secret — which you keep on your server. That's the whole reason for the two-step.

### Front channel vs back channel

- **Front channel** *(less secure)* — the user's browser. Anything that travels here can be inspected or hijacked.
- **Back channel** *(more secure)* — your server talking directly to Google. You control both ends.

---

## Setting up OAuth for Google

You'll need a project in the [Google Cloud Console](https://console.cloud.google.com/), where you create an OAuth client. Google gives you two credentials:

- **`client_id`** — public; safe for your frontend.
- **`client_secret`** — private; **only** your API server should ever see it.

The split matters: your backend uses `client_id` + `client_secret` to call Google. Your frontend only ever needs the `client_id`.

---

## Grant types

There's more than one OAuth flow. Pick by where your app lives:

| Grant Type                  | Use Case             | Status          |
| --------------------------- | -------------------- | --------------- |
| Authorization Code          | Server-side login    | ✅ Recommended  |
| Authorization Code + PKCE   | SPA / Mobile         | ✅ Recommended  |
| Client Credentials          | Backend → Backend    | ✅ Recommended  |
| Implicit                    | Old SPA              | ❌ Deprecated   |
| Password (ROPC)             | Legacy only          | ❌ Deprecated   |
| Refresh Token               | Token renewal        | ✅ Essential    |

A note on **Implicit**: it skipped the code-to-token exchange and returned the access token directly to the browser — useful in the days before SPAs could safely make CORS-protected token calls. It's deprecated now; **Authorization Code + PKCE** is the SPA/mobile answer.

---

## What I'd actually internalize

- OAuth is delegated **authorization**. OIDC is the **authentication** layer on top.
- The code-then-token detour exists because the browser is hostile territory.
- Scopes are how you keep tokens least-privilege.
- For a server-rendered app, use **Authorization Code**. For an SPA or mobile app, use **Authorization Code + PKCE**. Anything else, you probably don't want.

That's the 80% that covers most "Sign in with Google" implementations you'll write.
