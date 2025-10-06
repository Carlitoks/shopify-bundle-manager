/**
 * GraphQL queries for bundle manager
 */

/**
 * Query to get product metafields for bundle configuration
 */
export const GET_PRODUCT_METAFIELDS = `
  query GetProductMetafields($productId: ID!) {
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
 * Query to search products for bundle selection
 */
export const SEARCH_PRODUCTS = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          totalInventory
          featuredImage {
            url
            altText
          }
        }
      }
    }
  }
`;

/**
 * Query to get inventory for multiple products
 */
export const GET_PRODUCTS_INVENTORY = `
  query GetProductsInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        totalInventory
        tracksInventory
        variants(first: 100) {
          edges {
            node {
              id
              inventoryQuantity
              inventoryItem {
                id
                tracked
              }
            }
          }
        }
      }
    }
  }
`;
