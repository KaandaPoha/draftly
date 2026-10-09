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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Production deployment — read before shipping

### SQLite does not survive on ephemeral hosts (current limitation)

Draftly stores all data in a single SQLite file (`DATABASE_URL="file:./dev.db"`,
see `prisma/schema.prisma`). Many hosting platforms (Vercel, Fly.io without a
persistent volume, most container platforms) rebuild or reset their filesystem
between deploys or restarts — **everything in that file (users, profiles,
drafts, campaigns) is lost**.

The schema is provider-agnostic: switching to PostgreSQL is a one-line change in
`prisma/schema.prisma` (set `provider = "postgresql"`, point `DATABASE_URL` at a
real database, run `prisma migrate deploy`) plus a migration. Until that
happens, only deploy to an environment where the SQLite file persists — a
host with a mounted persistent volume, or a long-lived single server.

### AI provider keys

`AI_API_KEY` is read server-side only and is never sent to the browser. Copy
`.env.example` to `.env` and set values there — never commit a real `.env`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
