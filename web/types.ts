/**
 * Type definitions for Shopify webhooks and bundle system
 */

export interface BundleProduct {
  productId: string;
  quantity: number;
  title?: string;
}

export interface BundleConfig {
  isBundle: boolean;
  products: BundleProduct[];
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  requires_shipping: boolean;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  shop_url?: string;
  shop_domain?: string;
}

export interface ShopifyRefundLineItem {
  id: number;
  line_item_id: number;
  quantity: number;
  restock_type: string;
  subtotal: string;
  total_tax: string;
}

export interface ShopifyRefund {
  id: number;
  order_id: number;
  created_at: string;
  note: string;
  refund_line_items: ShopifyRefundLineItem[];
}

export interface MetafieldResponse {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ProductQueryResponse {
  data?: {
    product?: {
      id: string;
      title: string;
      metafield: MetafieldResponse | null;
    };
  };
}

export interface InventoryAdjustmentResponse {
  data?: {
    inventoryAdjustQuantities?: {
      inventoryAdjustmentGroup?: {
        changes: Array<{
          name: string;
          delta: number;
        }>;
      };
      userErrors?: Array<{
        field: string[];
        message: string;
      }>;
    };
  };
}
