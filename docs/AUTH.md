# Authentication model

## Access rules

- **Guest:** may use solo practice only. Guest progress stays in the browser until sign-in.
- **Google or GitHub account:** may create a handle, retain solo progress, complete placements, and join ranked queues.
- **Ranked access:** is granted only after a verified OAuth account creates/claims a handle and accepts the fair-play rule (no AI assistance in ranked games).

## Handle rules

OAuth identities are never shown as the player's in-game identity. Each ranked account claims one unique handle.

- 3–24 characters; letters, numbers, and underscores only.
- Case-insensitive uniqueness (for example, `ArrayNinja` and `arrayninja` conflict).
- No leading or trailing underscore, and no consecutive underscores.
- Reserved words and moderation-blocked handles cannot be claimed.
- A server-side unique index is authoritative; client validation is only for fast feedback.

## Provider setup required before launch

Create OAuth applications for Google and GitHub using the production domain. Store the credentials only in the deployment secret manager:

```text
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

Use callback URLs from the selected auth library; do not put provider secrets in browser code or commit them to the repository.

## Launch gate

Authentication is not launch-ready until the production `AUTH_SECRET`, Google credentials, GitHub credentials, production callback URLs, and approved production domain are configured and tested with both providers. All state-changing application APIs reject cross-site origins; the Auth.js callback route is intentionally excluded because it receives provider redirects.

## Guest-to-account conversion

On successful sign-in, offer the user a one-time transfer of locally stored practice history. Never create an MMR, rank, placement result, or ranked-match record for a guest session.
