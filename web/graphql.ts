/**
 * GraphQL queries and mutations for bundle inventory management
 */

import type { BundleConfig, ProductQueryResponse, InventoryAdjustmentResponse } from './types.js';

/**
 * Query to get bundle configuration from product metafield
 */
export const GET_BUNDLE_CONFIG = `
  query GetBundleConfig($productId: ID!) {
    product(id: $productId) {
      id
      title
      metafield(namespace: "custom", key: "bundle_config") {
        id
        namespace
        key
        value
        type
      }
    }
  }
`;

/**
 * Query to get inventory item ID for a product variant
 */
export const GET_INVENTORY_ITEM = `
  query GetInventoryItem($productId: ID!) {
    product(id: $productId) {
      id
      title
      variants(first: 1) {
        edges {
          node {
            id
            inventoryItem {
              id
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get current inventory level
 */
export const GET_INVENTORY_LEVEL = `
  query GetInventoryLevel($inventoryItemId: ID!, $locationId: ID!) {
    inventoryItem(id: $inventoryItemId) {
      id
      inventoryLevel(locationId: $locationId) {
        id
        available
      }
    }
  }
`;

/**
 * Mutation to set inventory quantity (absolute value)
 */
export const SET_INVENTORY = `
  mutation SetInventory($inventoryItemId: ID!, $locationId: ID!, $quantity: Int!) {
    inventorySetQuantities(
      input: {
        reason: "correction"
        name: "available"
        quantities: [{
          inventoryItemId: $inventoryItemId
          locationId: $locationId
          quantity: $quantity
        }]
      }
    ) {
      inventoryAdjustmentGroup {
        reason
        changes {
          name
          delta
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Mutation to adjust inventory quantity
 */
export const ADJUST_INVENTORY = `
  mutation AdjustInventory($inventoryItemId: ID!, $locationId: ID!, $delta: Int!) {
    inventoryAdjustQuantities(
      input: {
        reason: "correction"
        name: "available"
        changes: [
          {
            inventoryItemId: $inventoryItemId
            locationId: $locationId
            delta: $delta
          }
        ]
      }
    ) {
      inventoryAdjustmentGroup {
        reason
        changes {
          name
          delta
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL client for Shopify Admin API
 */
export class ShopifyGraphQL {
  private accessToken: string;
  private shop: string;
  private apiVersion: string;

  constructor(shop: string, accessToken: string, apiVersion: string = '2025-07') {
    this.shop = shop;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  /**
   * Execute a GraphQL query
   */
  async query<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const url = `https://${this.shop}/admin/api/${this.apiVersion}/graphql.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get bundle configuration for a product
   */
  async getBundleConfig(productId: string): Promise<BundleConfig | null> {
    try {
      const result = await this.query<ProductQueryResponse>(GET_BUNDLE_CONFIG, {
        productId,
      });

      if (!result.data?.product?.metafield) {
        return null;
      }

      const bundleConfig: BundleConfig = JSON.parse(result.data.product.metafield.value);
      return bundleConfig;
    } catch (error) {
      console.error(`[GraphQL] Error fetching bundle config:`, error);
      return null;
    }
  }

  /**
   * Get inventory item ID for a product
   */
  async getInventoryItemId(productId: string): Promise<string | null> {
    try {
      const result: any = await this.query(GET_INVENTORY_ITEM, { productId });

      const variant = result.data?.product?.variants?.edges?.[0]?.node;
      return variant?.inventoryItem?.id || null;
    } catch (error) {
      console.error(`[GraphQL] Error fetching inventory item:`, error);
      return null;
    }
  }

  /**
   * Get current inventory level for a product at a location
   */
  async getInventoryLevel(inventoryItemId: string, locationId: string): Promise<number | null> {
    try {
      const result: any = await this.query(GET_INVENTORY_LEVEL, {
        inventoryItemId,
        locationId,
      });

      const available = result.data?.inventoryItem?.inventoryLevel?.available;
      return available !== undefined ? available : null;
    } catch (error) {
      console.error(`[GraphQL] Error fetching inventory level:`, error);
      return null;
    }
  }

  /**
   * Set inventory to an absolute quantity
   */
  async setInventory(inventoryItemId: string, locationId: string, quantity: number): Promise<boolean> {
    try {
      const result: any = await this.query(SET_INVENTORY, {
        inventoryItemId,
        locationId,
        quantity,
      });

      if (result.data?.inventorySetQuantities?.userErrors?.length) {
        const errors = result.data.inventorySetQuantities.userErrors;
        console.error(`[GraphQL] Set inventory errors:`, errors);
        return false;
      }

      console.log(`[GraphQL] ✓ Inventory set to: ${quantity}`);
      return true;
    } catch (error) {
      console.error(`[GraphQL] Error setting inventory:`, error);
      return false;
    }
  }

  /**
   * Adjust inventory for a product
   * @param inventoryItemId - Inventory item GID
   * @param locationId - Location GID
   * @param delta - Change in inventory (negative to reduce, positive to increase)
   */
  async adjustInventory(
    inventoryItemId: string,
    locationId: string,
    delta: number
  ): Promise<boolean> {
    try {
      const result = await this.query<InventoryAdjustmentResponse>(ADJUST_INVENTORY, {
        inventoryItemId,
        locationId,
        delta,
      });

      if (result.data?.inventoryAdjustQuantities?.userErrors?.length) {
        const errors = result.data.inventoryAdjustQuantities.userErrors;
        console.error(`[GraphQL] Inventory adjustment errors:`, errors);
        return false;
      }

      console.log(`[GraphQL] ✓ Inventory adjusted: ${delta}`);
      return true;
    } catch (error) {
      console.error(`[GraphQL] Error adjusting inventory:`, error);
      return false;
    }
  }
}
