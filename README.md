This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Working on the match UI without a database

The queue, lobby, round, and results pages can run against an in-browser fake
instead of Postgres. Put this in `.env.local`:

```
NEXT_PUBLIC_MOCK_API=1
AUTH_SECRET=<run: openssl rand -base64 32>
```

Then `npm run dev`, with no Docker and no database.

The fake lives in `src/lib/mock-api.ts`. It is a state machine on a clock rather
than a set of fixtures, so it produces the same transitions the real backend
does. The lobby resolves after 5 seconds. Rounds run a 90-second timer. The
opponent submits 8 seconds after you do. Round one is scripted as a win, round
two a loss, round three a win, so a single run reaches every branch.

Two things it does on purpose. It shifts every timestamp it returns 40 seconds
into the future, so a component reading the local clock instead of the
server-corrected one is off by a visible amount rather than a plausible one. It
also keeps its state in `sessionStorage`, so refreshing the page continues the
same match. That is how you check that a saved draft comes back.

Set `NEXT_PUBLIC_MOCK_API=0`, or drop the line, to talk to the real routes. The
bundler reads the flag at build time and drops the half you are not using, so no
mock code ships to production.

Every network call goes through `src/lib/api-client.ts`. Nothing else in the
browser calls `fetch`, which is what makes the flag a single switch.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
