import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { ShopifyGraphQL } from './graphql.js';
import type {
  ShopifyOrder,
  ShopifyLineItem,
  BundleConfig,
} from './types.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify configuration (from environment)
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_LOCATION_ID = process.env.SHOPIFY_LOCATION_ID || '';

// Validate required configuration
if (!SHOPIFY_ACCESS_TOKEN) {
  console.error('ERROR: SHOPIFY_ACCESS_TOKEN is not set');
  process.exit(1);
}

if (!SHOPIFY_LOCATION_ID) {
  console.error('ERROR: SHOPIFY_LOCATION_ID is not set');
  process.exit(1);
}

function verifyWebhook(req: Request, res: Response, buf: Buffer): void {
  const hmac = req.get('X-Shopify-Hmac-Sha256');

  if (!hmac) {
    console.log('[Webhook] No HMAC header found');
    return;
  }

  const hash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(buf)
    .digest('base64');

  if (hash !== hmac) {
    console.error('[Webhook] HMAC verification failed');
    throw new Error('Invalid webhook signature');
  }

  console.log('[Webhook] HMAC verified');
}

// Parse JSON with raw body for signature verification
app.use('/webhooks', express.json({
  verify: (req: Request, res: Response, buf: Buffer) => {
    if (SHOPIFY_WEBHOOK_SECRET) {
      verifyWebhook(req, res, buf);
    }
  }
}));

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Bundle Manager Webhooks',
    version: '1.0.0',
    endpoints: [
      'POST /webhooks/orders/create'
    ]
  });
});

app.post('/webhooks/orders/create', async (req: Request, res: Response) => {
  try {
    const shop = req.get('X-Shopify-Shop-Domain') || '';
    const topic = req.get('X-Shopify-Topic') || '';
    const order: ShopifyOrder = req.body;

    console.log(`Order ${order.name} from ${shop} - ${order.line_items.length} items`);

    // TODO: check for race conditions when multiple orders come in simultaneously
    // for the same products - inventory adjustments might conflict

    // Process each line item
    for (const lineItem of order.line_items) {
      await processLineItem(lineItem, shop, order.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing order:', error);
    res.status(500).send('Error processing webhook');
  }
});

async function processLineItem(lineItem: ShopifyLineItem, shop: string, orderId: number): Promise<void> {
  try {
    const productId = `gid://shopify/Product/${lineItem.product_id}`;
    const client = new ShopifyGraphQL(shop, SHOPIFY_ACCESS_TOKEN);

    console.log(`Processing: ${lineItem.title} (qty: ${lineItem.quantity})`);

    const bundleConfig = await client.getBundleConfig(productId);

    if (!bundleConfig) {
      // TODO: add reverse index lookup - if this product is a component of any bundles,
      // we need to update those bundle inventories when it's sold individually
      return;
    }

    if (!bundleConfig.isBundle || !bundleConfig.products || bundleConfig.products.length === 0) {
      return;
    }

    console.log(`Bundle detected with ${bundleConfig.products.length} components`);

    for (const bundleProduct of bundleConfig.products) {
      try {
        const inventoryItemId = await client.getInventoryItemId(bundleProduct.productId);
        if (!inventoryItemId) {
          console.log(`Warning: no inventory item for ${bundleProduct.title || bundleProduct.productId}`);
          continue;
        }

        const delta = -1 * (bundleProduct.quantity * lineItem.quantity);
        console.log(`  Adjusting ${bundleProduct.title}: ${delta}`);

        await client.adjustInventory(inventoryItemId, SHOPIFY_LOCATION_ID, delta);
      } catch (error) {
        console.error(`Error adjusting ${bundleProduct.title}:`, error);
      }
    }

    // Sync bundle inventory to match lowest component stock
    await syncBundleInventory(productId, bundleConfig, shop);
  } catch (error) {
    console.error(`Error processing item:`, error);
  }
}

async function syncBundleInventory(bundleProductId: string, bundleConfig: BundleConfig, shop: string): Promise<void> {
  try {
    const client = new ShopifyGraphQL(shop, SHOPIFY_ACCESS_TOKEN);

    const bundleInventoryItemId = await client.getInventoryItemId(bundleProductId);
    if (!bundleInventoryItemId) return;

    const availablePerComponent: number[] = [];

    for (const component of bundleConfig.products) {
      const inventoryItemId = await client.getInventoryItemId(component.productId);
      if (!inventoryItemId) continue;

      const currentLevel = await client.getInventoryLevel(inventoryItemId, SHOPIFY_LOCATION_ID);
      if (currentLevel === null) continue;

      const bundlesAvailable = Math.floor(currentLevel / component.quantity);
      availablePerComponent.push(bundlesAvailable);

      console.log(`  ${component.title}: ${currentLevel} units -> ${bundlesAvailable} bundles available`);
    }

    if (availablePerComponent.length === 0) return;

    const bundleInventory = Math.min(...availablePerComponent);
    console.log(`Setting bundle inventory: ${bundleInventory}`);

    await client.setInventory(bundleInventoryItemId, SHOPIFY_LOCATION_ID, bundleInventory);
  } catch (error) {
    console.error(`Sync error:`, error);
  }
}


app.listen(PORT, () => {
  console.log(`Bundle Manager Webhook Server running on port ${PORT}`);
});
