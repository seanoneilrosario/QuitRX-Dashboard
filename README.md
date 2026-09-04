# QuitRX Dashboard

Staff-only operations dashboard for QuitRX. It manages products, collections, customers, orders, and inventory through the QuitHero Retail API.

## Environment

Create `.env.local` with:

```env
QUITHERO_API_BASE_URL=https://retail-api.quithero.com.au
QUITHERO_API_KEY=your_quithero_api_key
AUTH_SECRET=use_a_random_value_of_at_least_32_characters
NEXT_PUBLIC_SANITY_PROJECT_ID=your_sanity_project_id
NEXT_PUBLIC_SANITY_DATASET=your_sanity_dataset
SANITY_WRITE_TOKEN=your_sanity_write_token
```

The Sanity variables support collection-assignment metadata used by the dashboard; this repository does not include a Sanity Studio or storefront.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`; the root route redirects to `/dashboard`.
