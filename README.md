# Shopify Bundle Manager

A Shopify app for creating and managing product bundles with automatic inventory tracking.

## Features

- **Bundle Creation**: Configure product bundles through the Shopify admin interface
- **Storefront Display**: Automatically show bundle contents to customers
- **Automatic Inventory Sync**:
  - Bundle inventory = lowest component stock
  - Component inventory reduces when bundle is ordered
  - Bundle inventory recalculates automatically

## Installation

### Prerequisites

- Node.js 18+ installed
- Shopify Partner account
- Shopify development store

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Create `web/.env` with:
   ```bash
   SHOPIFY_ACCESS_TOKEN=your_admin_api_token
   SHOPIFY_LOCATION_ID=gid://shopify/Location/YOUR_LOCATION_ID
   PORT=3000
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

## Usage

### Creating a Bundle

1. Go to Shopify Admin → Products
2. Select a product to turn into a bundle
3. Click "Bundle Manager" in the product actions
4. Add component products and set quantities
5. Save the bundle configuration

### Storefront Display

The bundle contents will automatically display on product pages when the theme app extension is enabled.

### Webhook Server (for inventory management)

**Development:**
```bash
# Terminal 1: Start webhook server
npm run dev:webhooks

# Terminal 2: Start Shopify CLI
npm run dev
```

**Production:**
Deploy the `web/` directory to your hosting provider and update webhook URLs in Shopify admin.

## Project Structure

```
├── extensions/
│   ├── bundle-manager/        # Admin UI extension
│   └── bundle-display/         # Storefront theme extension
├── web/                        # Webhook server
│   ├── index.ts               # Main webhook handler
│   ├── graphql.ts             # Shopify API integration
│   └── types.ts               # TypeScript definitions
├── package.json
└── shopify.app.toml           # App configuration
```

## Configuration

### Required Scopes

The app requires these Shopify API scopes:
- `read_products`
- `write_products`
- `read_inventory`
- `write_inventory`
- `read_orders`

### Webhooks

Configure these webhooks in Shopify Admin (Settings → Notifications):

- **orders/create** → `https://your-domain.com/webhooks/orders/create`

## Development

### Available Scripts

- `npm run dev` - Start Shopify CLI development server
- `npm run dev:webhooks` - Start webhook server only
- `npm run build` - Build the app
- `npm run deploy` - Deploy to Shopify

### Technology Stack

- **Framework**: Shopify App Extensions
- **Admin UI**: React + Shopify Polaris
- **Storefront**: Liquid templates
- **Backend**: Node.js + Express + TypeScript
- **API**: Shopify GraphQL Admin API

## Support

For issues or questions, contact your development team.

## License

Proprietary - All rights reserved
