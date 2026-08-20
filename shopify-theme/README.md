# ZAVYXO — Shopify Online Store 2.0 Theme

A dark-luxury storefront theme built for ZAVYXO, a premium adult-wellness brand.

## Install

From this directory, using [Shopify CLI](https://shopify.dev/docs/themes/tools/cli):

```
shopify theme dev --store your-store.myshopify.com   # live preview
shopify theme push --store your-store.myshopify.com  # publish
```

Or zip the contents of `shopify-theme/` (not the folder itself) and upload via
Shopify Admin → Online Store → Themes → Add theme → Upload zip file.

## First-time setup checklist

1. **Navigation**: create a menu handled `main-menu` (Online Store → Navigation) with
   top-level items for Women / Men / Couples / Toys / Bondage / Lingerie / Lubricants /
   New Arrivals / Sale. Add second-level links under any item to get an automatic
   mega-menu. Create separate menus for the footer's Shop / Help / Legal columns and
   assign them to the footer section's blocks in the theme editor.
2. **Collections**: create collections with handles `best-sellers` and `new-arrivals`
   and assign them in the homepage's product carousel sections (Theme Editor → Home page).
3. **Pages**: create a page titled "Wishlist" and assign it the `page.wishlist`
   template (Online Store → Pages → Template) so the header wishlist icon has
   somewhere to link. Also create Shipping / Returns / FAQ / Privacy Policy / etc.
   pages referenced from the footer menus.
4. **Metafields** (Settings → Custom data → Products) — used for dynamic, honest
   product claims. Create boolean metafields under namespace `custom`:
   `waterproof`, `usb_rechargeable`, `body_safe`, `whisper_quiet`, `travel_lock`,
   `remote_control`, `app_control`, `multiple_modes`. Only checked claims render on
   the product page — nothing is hardcoded.
5. **Frequently Bought Together**: add a product-list metafield
   `custom.complete_the_set` on any product and reference 1–2 companion products to
   enable the FBT widget on that product page.
6. **Reviews**: install a reviews app that writes to the standard
   `reviews.rating` / `reviews.rating_count` product metafields (Judge.me, Loox,
   Shopify Product Reviews all support this) to power star ratings everywhere,
   and drop the app's embed block into the `data-reviews-app-slot` mount point in
   `snippets/product-reviews.liquid`. No reviews or ratings are fabricated by
   default — sections show a clearly-labeled placeholder until real data exists.
7. **Best Seller badge**: set a `custom.best_seller` (boolean) product metafield on
   any product to show the "Best Seller" badge on its card.
8. **Age gate / legal / shipping copy**: review and adjust under Theme Settings →
   Age verification, and the footer's trust/legal text — this theme ships with
   placeholder legal language, not a substitute for real legal review.
9. **Theme Settings** (Theme Editor → Theme settings) expose the whole design
   system — colors, typography, spacing, radii, glow intensity, cart behavior,
   product card behavior — with no code changes required.

## Structure

- `layout/theme.liquid` — page shell, design tokens, global scripts
- `sections/` — every homepage block, header, footer, product/collection/search/cart
  pages, all editable via the Theme Editor
- `snippets/` — shared components (product card, price, ratings, icons, etc.)
- `assets/theme.css` — the full design system (single stylesheet, CSS custom
  properties driven by Theme Settings)
- `assets/*.js` — cart (Ajax drawer), product form (variants/gallery/FBT), predictive
  search, collection filters, age gate, wishlist (localStorage-based)
