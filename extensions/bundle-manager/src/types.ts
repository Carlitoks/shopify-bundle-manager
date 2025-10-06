/**
 * Bundle product component - represents a product included in the bundle
 */
export interface BundleProduct {
  productId: string; // GID format: gid://shopify/Product/123
  quantity: number;
  title?: string; // Product title (optional, for display)
  inventory?: number; // Available inventory (optional, for validation)
  tracksInventory?: boolean; // Whether inventory is tracked
}

/**
 * Bundle configuration stored in product metafields
 */
export interface BundleConfig {
  isBundle: boolean;
  products: BundleProduct[];
}

/**
 * Product data from Shopify Admin API
 */
export interface Product {
  id: string;
  title: string;
  handle: string;
  totalInventory: number;
  featuredImage?: {
    url: string;
    altText?: string;
  };
}
