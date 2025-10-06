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

  useEffect(() => {
    if (productId) {
      loadBundleConfig();
    }
  }, [productId]);

  const loadBundleConfig = async () => {
    if (!productId) return;

    try {
      setLoading(true);

      const result = (await query(GET_PRODUCT_METAFIELDS, {
        variables: { productId },
      })) as ProductMetafieldsQueryResponse;

      if (result?.data?.product?.metafield) {
        const metafield = result.data.product.metafield;
        setMetafieldId(metafield.id);

        const config: BundleConfig = JSON.parse(metafield.value);

        setIsBundle(config.isBundle);
        setBundleProducts(config.products || []);

        if (config.products && config.products.length > 0) {
          await fetchInventory(config.products);
        }

        setMessage('Bundle configuration loaded');
      }
    } catch (error) {
      setMessage('Failed to load bundle configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async (products: BundleProduct[]) => {
    try {
      const productIds = products.map(p => p.productId);

      const result: any = await query(GET_PRODUCTS_INVENTORY, {
        variables: { ids: productIds },
      });

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
      // Silently fail - inventory is optional
    }
  };

  const handleRefreshInventory = async () => {
    if (bundleProducts.length === 0) return;

    try {
      setRefreshingInventory(true);
      await fetchInventory(bundleProducts);
      setMessage('Inventory refreshed successfully');
    } catch (error) {
      setMessage('Failed to refresh inventory');
    } finally {
      setRefreshingInventory(false);
    }
  };

  const handleSave = async () => {
    if (!productId) return;

    try {
      setSaving(true);

      const bundleConfig: BundleConfig = {
        isBundle,
        products: bundleProducts,
      };

      const metafields = [
        {
          ownerId: productId,
          namespace: 'custom',
          key: 'bundle_config',
          value: JSON.stringify(bundleConfig),
          type: 'json',
        },
      ];

      const result = (await query(SAVE_BUNDLE_CONFIG, {
        variables: { metafields },
      })) as MetafieldsSetResponse;

      if (result?.data?.metafieldsSet?.userErrors && result.data.metafieldsSet.userErrors.length > 0) {
        const errors = result.data.metafieldsSet.userErrors
          .map((e: any) => e.message)
          .join(', ');
        throw new Error(errors);
      }

      if (result?.data?.metafieldsSet?.metafields?.[0]?.id) {
        setMetafieldId(result.data.metafieldsSet.metafields[0].id);
      }

      setMessage('Bundle configuration saved successfully!');
    } catch (error) {
      setMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

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

      const selected = await (api as any).resourcePicker({
        type: 'product',
        multiple: true,
      });

      if (selected && selected.length > 0) {
        const newProducts: BundleProduct[] = selected.map((product: any) => ({
          productId: product.id,
          quantity: 1,
          title: product.title || product.id,
        }));

        const existingIds = bundleProducts.map(p => p.productId);
        const uniqueNewProducts = newProducts.filter(
          p => !existingIds.includes(p.productId)
        );

        const combinedProducts = [...bundleProducts, ...uniqueNewProducts];
        setBundleProducts(combinedProducts);

        await fetchInventory(combinedProducts);

        setMessage(`Added ${uniqueNewProducts.length} product(s) to bundle`);
      }
    } catch (error) {
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
      quantity: Math.max(1, newQuantity),
    };
    setBundleProducts(updated);
  };

  const calculateBundleAvailability = (): number => {
    if (bundleProducts.length === 0) return 0;

    const availabilities = bundleProducts.map(product => {
      if (!product.tracksInventory) return Infinity;
      if (product.inventory === undefined) return 0;
      return Math.floor(product.inventory / product.quantity);
    });

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
