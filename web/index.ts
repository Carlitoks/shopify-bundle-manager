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
  console.error('❌ ERROR: SHOPIFY_ACCESS_TOKEN is not set');
  process.exit(1);
}

if (!SHOPIFY_LOCATION_ID) {
  console.error('❌ ERROR: SHOPIFY_LOCATION_ID is not set');
  process.exit(1);
}

/**
 * Verify Shopify webhook signature
 */
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

  console.log('[Webhook] ✓ HMAC verified successfully');
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

/**
 * Orders Create Webhook
 * Triggered when an order is created - reduce component inventory
 */
app.post('/webhooks/orders/create', async (req: Request, res: Response) => {
  try {
    const shop = req.get('X-Shopify-Shop-Domain') || '';
    const topic = req.get('X-Shopify-Topic') || '';
    const order: ShopifyOrder = req.body;

    console.log(`[Order] Shop: ${shop}`);
    console.log(`[Order] Topic: ${topic}`);
    console.log(`[Order] ID: ${order.id}`);
    console.log(`[Order] Name: ${order.name}`);
    console.log(`[Order] Line Items: ${order.line_items.length}`);

    // Process each line item
    for (const lineItem of order.line_items) {
      await processLineItem(lineItem, shop, order.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] ❌ Error processing order:', error);
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Process a line item - check if it's a bundle and adjust component inventory
 */
async function processLineItem(
  lineItem: ShopifyLineItem,
  shop: string,
  orderId: number
): Promise<void> {
  try {
    const productId = `gid://shopify/Product/${lineItem.product_id}`;

    console.log(`[Item] ${lineItem.title}`);
    console.log(`[Item] Product ID: ${lineItem.product_id}`);
    console.log(`[Item] Quantity Ordered: ${lineItem.quantity}`);

    // Initialize GraphQL client
    const client = new ShopifyGraphQL(shop, SHOPIFY_ACCESS_TOKEN);

    // Query bundle configuration
    console.log(`[Bundle] → Checking metafield: custom.bundle_config`);
    const bundleConfig = await client.getBundleConfig(productId);

    if (!bundleConfig) {
      console.log(`[Bundle] ℹ No bundle config found - regular product`);
      console.log('');
      return;
    }

    if (!bundleConfig.isBundle || !bundleConfig.products || bundleConfig.products.length === 0) {
      console.log(`[Bundle] ℹ Not marked as bundle - no action needed`);
      console.log('');
      return;
    }

    // Process bundle components
    console.log(`[Bundle] ✓ This is a bundle with ${bundleConfig.products.length} components`);
    console.log('');

    for (const bundleProduct of bundleConfig.products) {
      try {
        // Get inventory item ID
        const inventoryItemId = await client.getInventoryItemId(bundleProduct.productId);

        if (!inventoryItemId) {
          console.log(`[Inventory] ⚠ No inventory item found for ${bundleProduct.title || bundleProduct.productId}`);
          continue;
        }

        // Calculate delta (negative to reduce inventory)
        const delta = -1 * (bundleProduct.quantity * lineItem.quantity);

        console.log(`[Inventory] Adjusting ${bundleProduct.title || bundleProduct.productId}:`);
        console.log(`[Inventory]   Component qty: ${bundleProduct.quantity}`);
        console.log(`[Inventory]   Order qty: ${lineItem.quantity}`);
        console.log(`[Inventory]   Delta: ${delta}`);

        // Adjust inventory
        const success = await client.adjustInventory(inventoryItemId, SHOPIFY_LOCATION_ID, delta);

        if (success) {
          console.log(`[Inventory] ✓ Successfully adjusted inventory`);
        } else {
          console.log(`[Inventory] ❌ Failed to adjust inventory`);
        }
        console.log('');

      } catch (error) {
        console.error(`[Inventory] ❌ Error adjusting ${bundleProduct.title}:`, error);
      }
    }

    // Sync bundle inventory to match lowest component stock
    await syncBundleInventory(productId, bundleConfig, shop);

  } catch (error) {
    console.error(`[Item] ❌ Error processing:`, error);
  }
}

/**
 * Sync bundle inventory = min(component_inventory / component_quantity)
 */
async function syncBundleInventory(bundleProductId: string, bundleConfig: BundleConfig, shop: string): Promise<void> {
  try {
    console.log(`\n[Sync] → Calculating bundle inventory...`);
    const client = new ShopifyGraphQL(shop, SHOPIFY_ACCESS_TOKEN);

    const bundleInventoryItemId = await client.getInventoryItemId(bundleProductId);
    if (!bundleInventoryItemId) {
      console.log(`[Sync] ⚠ Could not get bundle inventory item ID`);
      return;
    }

    const availablePerComponent: number[] = [];

    for (const component of bundleConfig.products) {
      const inventoryItemId = await client.getInventoryItemId(component.productId);
      if (!inventoryItemId) continue;

      const currentLevel = await client.getInventoryLevel(inventoryItemId, SHOPIFY_LOCATION_ID);
      if (currentLevel === null) continue;

      const bundlesAvailable = Math.floor(currentLevel / component.quantity);
      availablePerComponent.push(bundlesAvailable);

      console.log(`[Sync]   ${component.title}: ${currentLevel} units = ${bundlesAvailable} bundles`);
    }

    if (availablePerComponent.length === 0) {
      console.log(`[Sync] ⚠ No component inventory data available`);
      return;
    }

    const bundleInventory = Math.min(...availablePerComponent);
    console.log(`[Sync] → Setting bundle inventory to: ${bundleInventory}`);

    const success = await client.setInventory(bundleInventoryItemId, SHOPIFY_LOCATION_ID, bundleInventory);
    if (success) {
      console.log(`[Sync] ✓ Bundle inventory synced: ${bundleInventory}\n`);
    }
  } catch (error) {
    console.error(`[Sync] ❌ Error:`, error);
  }
}


// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🚀 Bundle Manager Webhook Server        ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`📡 Port: ${PORT}`);
  console.log(`Ready to receive webhooks!\n`);
});
