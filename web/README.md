# Webhook Server

This directory contains the webhook server that handles automatic inventory adjustments when bundles are ordered.

## Setup

1. **Install dependencies:**
   ```bash
   cd web
   npm install
   ```

2. **Configure environment:**

   Create `.env` file:
   ```bash
   SHOPIFY_ACCESS_TOKEN=your_admin_api_access_token
   SHOPIFY_LOCATION_ID=gid://shopify/Location/YOUR_LOCATION_ID
   PORT=3000
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_ACCESS_TOKEN` | Yes | Admin API access token from Shopify |
| `SHOPIFY_LOCATION_ID` | Yes | Location ID in GID format |
| `SHOPIFY_WEBHOOK_SECRET` | No | Webhook verification secret (for production) |
| `PORT` | No | Server port (default: 3000) |

## API Endpoints

### `GET /`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "Bundle Manager Webhooks",
  "version": "1.0.0",
  "endpoints": ["POST /webhooks/orders/create"]
}
```

### `POST /webhooks/orders/create`
Handles order creation webhooks from Shopify

**Headers:**
- `X-Shopify-Shop-Domain`: Shop domain
- `X-Shopify-Topic`: Webhook topic
- `X-Shopify-Hmac-Sha256`: Webhook signature (verified if secret is set)

**Response:**
- `200 OK` - Webhook processed successfully
- `500 Internal Server Error` - Processing failed

## How It Works

1. Receives order creation webhook from Shopify
2. Checks each line item to see if it's a bundle
3. Queries the product's `custom.bundle_config` metafield
4. For each component in the bundle:
   - Gets the inventory item ID
   - Calculates inventory delta (component_qty × order_qty)
   - Adjusts inventory via GraphQL mutation

## Files

- `index.ts` - Main server and webhook handler
- `graphql.ts` - Shopify GraphQL client and queries
- `types.ts` - TypeScript type definitions
- `package.json` - Dependencies and scripts

## Production Deployment

Deploy this directory to a hosting service that supports Node.js:

- **Vercel**: `vercel deploy`
- **Railway**: `railway up`
- **Heroku**: `git push heroku main`
- **Cloudflare Workers**: Convert to worker format

After deployment, update webhook URLs in Shopify Admin.
