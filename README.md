# QuitRX Dashboard

Staff-only operations dashboard for QuitRX. It manages products, collections, customers, orders, and inventory through the QuitHero Retail API.

## Environment

Create `.env.local` with:

```env
QUITHERO_API_BASE_URL=https://retail-api.quithero.com.au
QUITHERO_API_KEY=your_quithero_api_key
AUTH_SECRET=use_a_random_value_of_at_least_32_characters
```

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`; the root route redirects to `/dashboard`.

Catalog lists use a server-side cache with a 30-second revalidation interval.
Dashboard saves and deletes expire it immediately. Changes made outside this
dashboard appear after cache revalidation; the first request after expiry may
receive the previous data while it refreshes in the background. Product edit
records, inventory, orders, and customer requests remain uncached. Paginated
catalog reads are sent sequentially and rate-limited reads honor QuitHero's
`Retry-After` response before retrying.

Run cache behavior checks with `node --test tests/retail-cache.test.mjs`.
