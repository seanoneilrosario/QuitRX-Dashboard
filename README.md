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

## Bundle creation and API fields

The Bundles tab's Add bundle form creates a product with the `bundle` tag and a
group (product variant) with a name, SKU and price. Each selection has a name,
zero-based position and one or more allowed variant IDs. The same variant can
be allowed in multiple selections.

Selections are sent to
`PATCH /products/{productId}/variants/{variantId}/bundle` as a JSON array:

```json
[
  {
    "position": 0,
    "name": "Bottle 1",
    "options": [{ "componentVariantId": "allowed-variant-id" }]
  }
]
```

The dashboard reads the same endpoint after saving and verifies the returned
configuration (including the API's `bundleDropdowns` response shape) before
reporting success. API credentials stay on the server. If saving selections
fails after the product and group were created, retrying the form reuses their
returned IDs. Run bundle validation and save-flow checks with
`node --test tests/product-bundles.test.mjs`.
