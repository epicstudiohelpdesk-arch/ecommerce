# Customer Storefront, Product Discovery & Product Details Architecture

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate Reference:** G07  
**Status:** Approved & Implemented  
**Classification:** Frontend Application Architecture & UX

---

## 1. Domain Overview & Purpose

The customer storefront (`apps/storefront`) serves as the primary discovery and browsing interface for patrons seeking authentic handmade and artisanal creations. Unlike standard industrial e-commerce platforms, the handcrafted storefront is specifically engineered to highlight:

1. **Artisan Provenance & Craft Narratives:** Emphasizing traditional techniques, handmade origin, and studio storytelling.
2. **Distinct Product Archetypes:** Clear distinction between `READY_TO_SHIP` studio inventory, `MADE_TO_ORDER` items requiring artisanal lead times, and `ONE_OF_A_KIND` unique masterworks.
3. **Verified Workshop Credentials:** Showcasing moderation and KYC authenticity marks to build buyer trust.
4. **Resilient Data Fetching:** SSR and Incremental Static Regeneration (ISR) with graceful fallback states when backend services are temporarily unreachable.
5. **Strict Purchasing Boundary:** Complete isolation of discovery UX from cart mutation and checkout transactions, which are scheduled for Gate G08 upon payment provider integration.

---

## 2. Storefront Architecture & Routing Model

Built using Next.js 15 (App Router), React 19, and TypeScript with strict boundary contracts defined in `@repo/api-contracts` and `@repo/validation`.

```mermaid
flowchart TD
    subgraph Storefront [apps/storefront (Next.js 15)]
        Layout["Root Layout (Nav, Search, Footer)"]
        Home["Homepage /"]
        Categories["Categories Overview /categories"]
        CategoryDetail["Category Product Listing /categories/[slug]"]
        SearchResults["Search Results /search?q=..."]
        ProductDetail["Product Detail /products/[slug]"]
        NotFound["404 Not Found Page"]
    end

    subgraph BackendAPI [apps/api (NestJS)]
        PublicCat["Public Catalog Controller (/catalog)"]
        CatSvc["Categories Service (/catalog/categories)"]
        ProdSvc["Public Products Service (/catalog/products)"]
        SlugSvc["Product Detail Service (/catalog/products/:slug)"]
    end

    Layout --> Home
    Layout --> Categories
    Layout --> CategoryDetail
    Layout --> SearchResults
    Layout --> ProductDetail

    Home -->|fetchCategories, fetchProducts| BackendAPI
    Categories -->|fetchCategories| BackendAPI
    CategoryDetail -->|fetchProducts(params)| BackendAPI
    SearchResults -->|fetchProducts(search, filters)| BackendAPI
    ProductDetail -->|fetchProductBySlug| BackendAPI
```

---

## 3. Route Specifications & Features

### 3.1 Root Layout (`/`)

- **Semantic Structure:** Accessible header (`role="banner"`), sticky navigation bar with search form, responsive mobile navigation drawer, and comprehensive footer sitemap.
- **Cross-Portal Navigation:** Direct access to artisan seller onboarding (`/onboarding` on port 3002) and administrative governance (port 3003).
- **Global Metadata:** Base Open Graph tags, canonical descriptions, and favicon declarations.

### 3.2 Homepage (`/`)

- **Editorial Hero Section:** Showcases the platform's fair trade artisan mission with clear calls-to-action to browse verified crafts.
- **Craft Categories Grid:** Visual navigation cards for all active craft categories.
- **Newest Creations Carousel:** Real-time published listings fetched from `/catalog/products?sort=newest&limit=8`.
- **Ready-to-Ship Spotlight:** Direct studio dispatch section highlighting items ready for immediate packaging without production delays.

### 3.3 Categories Overview (`/categories`)

- Complete index of all active marketplace disciplines (Pottery, Painting, Woodcraft, Jewellery, Textiles, Customised Gifts).
- SEO metadata and accessible breadcrumbs navigation.

### 3.4 Category Product Listing (`/categories/[slug]`)

- **Filter Controls:** Filter by craft type (`READY_TO_SHIP`, `MADE_TO_ORDER`, `ONE_OF_A_KIND`, `CUSTOMISABLE`).
- **Sorting Options:** `newest`, `price_asc`, `price_desc`, `title_asc`.
- **Pagination:** Clean page navigation preserving active filters.
- **Dynamic SEO:** Generated metadata including category name and count.
- **Resilient Fallback:** 404 handling if category does not exist.

### 3.5 Search Results (`/search`)

- Full-text search across titles, descriptions, categories, and tags.
- Query refinement input with active filter pills and real-time result counts.
- Empathetic empty state when search terms match zero listings.

### 3.6 Product Detail Page (`/products/[slug]`)

- **Visual Gallery:** Interactive `ProductGallery` with thumbnail selector and graceful craft SVG placeholders when photos are absent.
- **Dynamic Pricing & Variants:** `VariantSelector` supporting multi-edition selection, updating prices and live studio stock counts in real-time.
- **Craft Provenance Accordion:** Full disclosure of materials, traditional crafting techniques, production lead times, finished dimensions, weights, and care instructions.
- **Schema.org Structured Data:** JSON-LD `Product` and `Offer` metadata embedded for search engine crawlers.
- **Gate G08 Purchase Disclosure:** Transparent notice that cart and checkout will activate in Gate G08 upon payment gateway integration. Functional purchase buttons are safely disabled with informative copy.

---

## 4. API Client & Data Invariants

Implemented in `apps/storefront/src/lib/api.ts`:

1. **Integer Minor Units:** All monetary values are maintained in minor units (paise/cents) and formatted through `formatMinorPrice()`, preventing floating-point display errors.
2. **Revalidation Windows:** ISR revalidation configured at 60s for categories and 30s for catalog products.
3. **Network Resiliency:** All fetchers catch network and HTTP exceptions gracefully, returning safe empty fallbacks rather than throwing uncaught server errors.
4. **Graceful Placeholder Treatment:** Where artisan media is pending or omitted, SVG/CSS placeholders display craft metadata without fabricated stock images.

---

## 5. Security & Accessibility Conformance

- **WCAG 2.2 AA Alignment:** Semantic HTML5 landmarks (`header`, `nav`, `main`, `article`, `footer`), high-contrast stone/amber color palette, accessible ARIA attributes on interactive buttons and dialogs.
- **XSS Defense:** React 19 sanitization with structured JSON-LD rendered exclusively via trusted server attributes.
- **CSRF Isolation:** Zero state mutations or session tampering in discovery views.
