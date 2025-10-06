# Bundle Display Extension

Theme app extension that displays bundle contents and availability on storefront product pages.

## Features

- **Bundle Contents Block**: Shows "What's Included" with product quantities
- **Bundle Availability Block**: Displays stock status and available quantity

## Setup in Theme Editor

1. Go to **Online Store → Themes → Customize**
2. Navigate to a **Product page**
3. Click **Add block** or **Add app block**
4. Select **Bundle Contents** and/or **Bundle Availability**
5. Position blocks (recommended: below product description)
6. Customize colors and styling
7. **Save**

## Block Settings

### Bundle Contents
- Title text and size
- Show/hide total item count
- Background, border, and text colors
- Quantity badge styling

### Bundle Availability
- In-stock/out-of-stock messages
- Show/hide quantity
- Text size and status colors

## Technical Details

Reads bundle configuration from `custom.bundle_config` metafield:

```json
{
  "isBundle": true,
  "products": [
    {
      "productId": "gid://shopify/Product/123",
      "quantity": 2,
      "title": "Product Name"
    }
  ]
}
```

Blocks automatically show only on bundle products and hide on regular products.

## Files

- `blocks/bundle_contents.liquid` - Contents display
- `blocks/bundle_availability.liquid` - Stock status display
- `shopify.extension.toml` - Extension configuration
