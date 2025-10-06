import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  AdminBlock,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Banner,
  TextField,
  useApi,
} from '@shopify/ui-extensions-react/admin';
import type { BundleConfig, BundleProduct } from './types';
import { GET_PRODUCT_METAFIELDS, GET_PRODUCTS_INVENTORY } from './graphql/queries';
import { SAVE_BUNDLE_CONFIG } from './graphql/mutations';
import type { ProductMetafieldsQueryResponse, MetafieldsSetResponse } from './graphql/types';

/**
 * Admin Block Extension - appears on product detail pages
 * Allows merchants to configure a product as a bundle
 */
function BundleManagerBlock() {
  const api = useApi<'admin.product-details.block.render'>();
  const { data, query } = api;

  const [isBundle, setIsBundle] = useState<boolean>(false);
  const [bundleProducts, setBundleProducts] = useState<BundleProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [metafieldId, setMetafieldId] = useState<string | null>(null);
  const [refreshingInventory, setRefreshingInventory] = useState<boolean>(false);

  const productId = data.selected[0]?.id;

  /**
   * Load existing bundle configuration from metafields
   */
  useEffect(() => {
    if (productId) {
      loadBundleConfig();
    }
  }, [productId]);

  const loadBundleConfig = async () => {
    if (!productId) return;

    try {
      setLoading(true);

      console.log('[Bundle Manager] Loading config for product:', productId);

      const result = (await query(GET_PRODUCT_METAFIELDS, {
        variables: { productId },
      })) as ProductMetafieldsQueryResponse;

      console.log('[Bundle Manager] Query result:', result);

      if (result?.data?.product?.metafield) {
        const metafield = result.data.product.metafield;
        setMetafieldId(metafield.id);

        console.log('[Bundle Manager] Found metafield:', metafield);

        // Parse the JSON value
        const config: BundleConfig = JSON.parse(metafield.value);
        console.log('[Bundle Manager] Parsed config:', config);

        setIsBundle(config.isBundle);
        setBundleProducts(config.products || []);

        // Fetch inventory for all products in bundle
        if (config.products && config.products.length > 0) {
          await fetchInventory(config.products);
        }

        setMessage('Bundle configuration loaded');
      } else {
        console.log('[Bundle Manager] No existing bundle config found');
      }
    } catch (error) {
      console.error('[Bundle Manager] Failed to load bundle config:', error);
      setMessage('Failed to load bundle configuration');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch inventory for bundle products
   */
  const fetchInventory = async (products: BundleProduct[]) => {
    try {
      const productIds = products.map(p => p.productId);

      const result: any = await query(GET_PRODUCTS_INVENTORY, {
        variables: { ids: productIds },
      });

      console.log('[Bundle Manager] Inventory result:', result);

      if (result?.data?.nodes) {
        const updatedProducts = products.map(product => {
          const inventoryData = result.data.nodes.find((n: any) => n?.id === product.productId);
          if (inventoryData) {
            return {
              ...product,
              inventory: inventoryData.totalInventory || 0,
              tracksInventory: inventoryData.tracksInventory || false,
            };
          }
          return product;
        });

        setBundleProducts(updatedProducts);
      }
    } catch (error) {
      console.error('[Bundle Manager] Failed to fetch inventory:', error);
    }
  };

  /**
   * Manually refresh inventory data
   */
  const handleRefreshInventory = async () => {
    if (bundleProducts.length === 0) return;

    try {
      setRefreshingInventory(true);
      await fetchInventory(bundleProducts);
      setMessage('Inventory refreshed successfully');
    } catch (error) {
      console.error('[Bundle Manager] Failed to refresh inventory:', error);
      setMessage('Failed to refresh inventory');
    } finally {
      setRefreshingInventory(false);
    }
  };

  /**
   * Save bundle configuration to metafields
   */
  const handleSave = async () => {
    if (!productId) return;

    try {
      setSaving(true);

      const bundleConfig: BundleConfig = {
        isBundle,
        products: bundleProducts,
      };

      console.log('[Bundle Manager] Saving config:', bundleConfig);

      // Prepare metafield input
      const metafields = [
        {
          ownerId: productId,
          namespace: 'custom',
          key: 'bundle_config',
          value: JSON.stringify(bundleConfig),
          type: 'json',
        },
      ];

      console.log('[Bundle Manager] Metafield input:', metafields);

      const result = (await query(SAVE_BUNDLE_CONFIG, {
        variables: { metafields },
      })) as MetafieldsSetResponse;

      console.log('[Bundle Manager] Save result:', result);

      if (result?.data?.metafieldsSet?.userErrors && result.data.metafieldsSet.userErrors.length > 0) {
        const errors = result.data.metafieldsSet.userErrors
          .map((e: any) => e.message)
          .join(', ');
        throw new Error(errors);
      }

      // Update metafield ID for future updates
      if (result?.data?.metafieldsSet?.metafields?.[0]?.id) {
        setMetafieldId(result.data.metafieldsSet.metafields[0].id);
      }

      setMessage('Bundle configuration saved successfully!');
    } catch (error) {
      console.error('[Bundle Manager] Failed to save bundle config:', error);
      setMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle adding products to bundle using Shopify's resource picker
   */
  const handleAddProduct = async () => {
    try {
      // Check if resourcePicker is available in the API
      if (!('resourcePicker' in api)) {
        setMessage('Resource picker not available. Please enter product ID manually.');
        // Fallback: add a demo product
        const demoProduct: BundleProduct = {
          productId: `gid://shopify/Product/${Date.now()}`,
          quantity: 1,
        };
        setBundleProducts([...bundleProducts, demoProduct]);
        return;
      }

      // Use Shopify's built-in resource picker
      const selected = await (api as any).resourcePicker({
        type: 'product',
        multiple: true, // Allow selecting multiple products
      });

      if (selected && selected.length > 0) {
        const newProducts: BundleProduct[] = selected.map((product: any) => ({
          productId: product.id,
          quantity: 1,
          title: product.title || product.id, // Use title if available
        }));

        // Merge with existing products, avoiding duplicates
        const existingIds = bundleProducts.map(p => p.productId);
        const uniqueNewProducts = newProducts.filter(
          p => !existingIds.includes(p.productId)
        );

        const combinedProducts = [...bundleProducts, ...uniqueNewProducts];
        setBundleProducts(combinedProducts);

        // Fetch inventory for newly added products
        await fetchInventory(combinedProducts);

        setMessage(`Added ${uniqueNewProducts.length} product(s) to bundle`);
      }
    } catch (error) {
      console.error('[Bundle Manager] Error selecting products:', error);
      setMessage('Failed to select products');
    }
  };

  const handleRemoveProduct = (index: number) => {
    const updated = bundleProducts.filter((_, i) => i !== index);
    setBundleProducts(updated);
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const updated = [...bundleProducts];
    updated[index] = {
      ...updated[index],
      quantity: Math.max(1, newQuantity), // Ensure minimum quantity of 1
    };
    setBundleProducts(updated);
  };

  /**
   * Calculate how many bundles can be created based on current inventory
   */
  const calculateBundleAvailability = (): number => {
    if (bundleProducts.length === 0) return 0;

    const availabilities = bundleProducts.map(product => {
      // If inventory is not tracked, consider it unlimited
      if (!product.tracksInventory) return Infinity;

      // If inventory data is not available, assume 0
      if (product.inventory === undefined) return 0;

      // Calculate how many bundles this product can support
      return Math.floor(product.inventory / product.quantity);
    });

    // The limiting factor is the product with the lowest availability
    return Math.min(...availabilities);
  };

  if (loading) {
    return (
      <AdminBlock title="Bundle Manager">
        <BlockStack>
          <Text>Loading bundle configuration...</Text>
        </BlockStack>
      </AdminBlock>
    );
  }

  return (
    <AdminBlock title="Bundle Manager">
      <BlockStack>
        {message && (
          <Banner tone={message.includes('success') ? 'success' : 'critical'}>
            {message}
          </Banner>
        )}

        <Banner title="Configure Product Bundle">
          Mark this product as a bundle and select which products it contains.
          The bundle will only be available when all component products are in stock.
        </Banner>

        <BlockStack>
          <Button
            onPress={() => setIsBundle(!isBundle)}
            variant={isBundle ? 'primary' : 'secondary'}
          >
            {isBundle ? '✓ This is a bundle' : 'Mark as bundle'}
          </Button>

          {isBundle && (
            <BlockStack>
              <Text fontWeight="bold">Bundle Contents</Text>

              <InlineStack>
                <Button onPress={handleAddProduct}>
                  Add Product to Bundle
                </Button>
                {bundleProducts.length > 0 && (
                  <Button
                    onPress={handleRefreshInventory}
                    disabled={refreshingInventory}
                    variant="secondary"
                  >
                    {refreshingInventory ? 'Refreshing...' : 'Refresh Inventory'}
                  </Button>
                )}
              </InlineStack>

              {bundleProducts.length > 0 && (
                <BlockStack>
                  <Text fontWeight="bold">Products in Bundle:</Text>
                  {bundleProducts.map((product, index) => {
                    const hasInventory = product.tracksInventory
                      ? (product.inventory || 0) >= product.quantity
                      : true;
                    const availableBundles = product.tracksInventory && product.inventory !== undefined
                      ? Math.floor(product.inventory / product.quantity)
                      : Infinity;

                    return (
                      <BlockStack key={index}>
                        <InlineStack>
                          <Text>
                            {product.title || product.productId}
                          </Text>
                          {product.tracksInventory && (
                            <Text>
                              {hasInventory
                                ? `✓ ${product.inventory} in stock`
                                : `⚠ Out of stock (${product.inventory || 0} available)`
                              }
                            </Text>
                          )}
                        </InlineStack>
                        <InlineStack>
                          <TextField
                            label="Quantity"
                            value={String(product.quantity)}
                            onChange={(value) => handleQuantityChange(index, parseInt(value) || 1)}
                          />
                          <Button onPress={() => handleRemoveProduct(index)} variant="tertiary">
                            Remove
                          </Button>
                        </InlineStack>
                        {product.tracksInventory && availableBundles < Infinity && (
                          <Text>
                            Max bundles available with this product: {availableBundles}
                          </Text>
                        )}
                      </BlockStack>
                    );
                  })}

                  {/* Show total bundle availability */}
                  <Banner tone={calculateBundleAvailability() > 0 ? 'success' : 'warning'}>
                    <Text fontWeight="bold">
                      {calculateBundleAvailability() > 0
                        ? `✓ Can create ${calculateBundleAvailability()} bundle(s) with current inventory`
                        : '⚠ Cannot create bundles - one or more products out of stock'
                      }
                    </Text>
                  </Banner>
                </BlockStack>
              )}

              <Button
                onPress={handleSave}
                disabled={saving}
                variant="primary"
              >
                {saving ? 'Saving...' : 'Save Bundle Configuration'}
              </Button>
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}

export default reactExtension(
  'admin.product-details.block.render',
  () => <BundleManagerBlock />
);
