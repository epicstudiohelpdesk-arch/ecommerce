import type { CategoryDto, ProductSummaryDto, ProductDetailDto } from '@repo/api-contracts';
import type { ListPublicCatalogQuery } from '@repo/validation';

export type StorefrontCatalogParams = Partial<ListPublicCatalogQuery>;

export function getApiBaseUrl(): string {
  return process.env['NEXT_PUBLIC_API_URL'] || process.env['API_URL'] || 'http://localhost:3001';
}

export interface PaginatedProductsResult {
  items: ProductSummaryDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Fetches all active handcrafted product categories from the public catalog endpoint.
 */
export async function fetchCategories(): Promise<CategoryDto[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/catalog/categories`, {
      next: { revalidate: 60 },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[Storefront API] Failed to fetch categories: ${res.status} ${res.statusText}`);
      return [];
    }

    const payload = (await res.json()) as { success: boolean; data: CategoryDto[] };
    return payload.success && Array.isArray(payload.data) ? payload.data : [];
  } catch (err) {
    console.warn(`[Storefront API] Network error fetching categories: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetches published handcrafted products with filters, sorting, and pagination.
 */
export async function fetchProducts(
  params: StorefrontCatalogParams = {},
): Promise<PaginatedProductsResult> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', params.page.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
  if (params.categorySlug) searchParams.set('categorySlug', params.categorySlug);
  if (params.productType) searchParams.set('productType', params.productType);
  if (params.minPriceMinor !== undefined)
    searchParams.set('minPriceMinor', params.minPriceMinor.toString());
  if (params.maxPriceMinor !== undefined)
    searchParams.set('maxPriceMinor', params.maxPriceMinor.toString());
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.search) searchParams.set('search', params.search);

  const url = `${baseUrl}/catalog/products${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[Storefront API] Failed to fetch products: ${res.status} ${res.statusText}`);
      return {
        items: [],
        meta: { total: 0, page: params.page || 1, limit: params.limit || 20, totalPages: 1 },
      };
    }

    const payload = (await res.json()) as {
      success: boolean;
      data: PaginatedProductsResult;
    };

    if (payload.success && payload.data) {
      return {
        items: payload.data.items || [],
        meta: payload.data.meta || {
          total: payload.data.items?.length || 0,
          page: params.page || 1,
          limit: params.limit || 20,
          totalPages: 1,
        },
      };
    }

    return {
      items: [],
      meta: { total: 0, page: params.page || 1, limit: params.limit || 20, totalPages: 1 },
    };
  } catch (err) {
    console.warn(`[Storefront API] Network error fetching products: ${(err as Error).message}`);
    return {
      items: [],
      meta: { total: 0, page: params.page || 1, limit: params.limit || 20, totalPages: 1 },
    };
  }
}

/**
 * Fetches authoritative public product detail by URL slug.
 */
export async function fetchProductBySlug(slug: string): Promise<ProductDetailDto | null> {
  if (!slug || typeof slug !== 'string') return null;

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/catalog/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 30 },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(
          `[Storefront API] Error fetching product ${slug}: ${res.status} ${res.statusText}`,
        );
      }
      return null;
    }

    const payload = (await res.json()) as { success: boolean; data: ProductDetailDto };
    return payload.success && payload.data ? payload.data : null;
  } catch (err) {
    console.warn(
      `[Storefront API] Network error fetching product ${slug}: ${(err as Error).message}`,
    );
    return null;
  }
}

/**
 * Formats integer minor currency units (paise/cents) into user-friendly currency string (e.g. ₹890.00).
 */
export function formatMinorPrice(
  minorUnits: number,
  currency: string = 'INR',
  locale: string = 'en-IN',
): string {
  const major = (minorUnits || 0) / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}
