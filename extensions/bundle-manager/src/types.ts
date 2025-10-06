export interface BundleProduct {
  productId: string;
  quantity: number;
  title?: string;
  inventory?: number;
  tracksInventory?: boolean;
}

export interface BundleConfig {
  isBundle: boolean;
  products: BundleProduct[];
}

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
