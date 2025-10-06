/**
 * GraphQL response types
 */

export interface MetafieldResponse {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ProductMetafieldsQueryResponse {
  data?: {
    product?: {
      id: string;
      title: string;
      metafield: MetafieldResponse | null;
    };
  };
}

export interface MetafieldsSetResponse {
  data?: {
    metafieldsSet?: {
      metafields?: MetafieldResponse[];
      userErrors?: Array<{
        field?: string[];
        message: string;
      }>;
    };
  };
}
