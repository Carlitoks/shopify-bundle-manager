/**
 * GraphQL mutations for bundle manager
 */

/**
 * Mutation to save bundle configuration to product metafields
 */
export const SAVE_BUNDLE_CONFIG = `
  mutation SaveBundleConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Mutation to delete bundle configuration
 */
export const DELETE_BUNDLE_CONFIG = `
  mutation DeleteBundleConfig($metafieldId: ID!) {
    metafieldDelete(input: { id: $metafieldId }) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;
