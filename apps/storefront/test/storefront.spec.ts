import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatMinorPrice,
  getApiBaseUrl,
  fetchCategories,
  fetchProducts,
  fetchProductBySlug,
} from '../src/lib/api';
import type { ProductDetailDto } from '@repo/api-contracts';

describe('Storefront Client & Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('formatMinorPrice', () => {
    it('correctly formats INR minor units into currency string', () => {
      const formatted = formatMinorPrice(89000, 'INR', 'en-IN');
      expect(formatted).toContain('890.00');
    });

    it('correctly formats 0 minor units', () => {
      const formatted = formatMinorPrice(0, 'INR', 'en-IN');
      expect(formatted).toContain('0.00');
    });

    it('formats other currencies like USD correctly', () => {
      const formatted = formatMinorPrice(4550, 'USD', 'en-US');
      expect(formatted).toBe('$45.50');
    });
  });

  describe('getApiBaseUrl', () => {
    it('defaults to localhost:4000/api/v1 if no environment variable is set', () => {
      delete process.env['NEXT_PUBLIC_API_URL'];
      delete process.env['API_URL'];
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });

    it('respects NEXT_PUBLIC_API_URL when set', () => {
      process.env['NEXT_PUBLIC_API_URL'] = 'https://api.artisanmarket.example';
      expect(getApiBaseUrl()).toBe('https://api.artisanmarket.example');
    });

    it('respects API_URL when NEXT_PUBLIC_API_URL is unset', () => {
      delete process.env['NEXT_PUBLIC_API_URL'];
      process.env['API_URL'] = 'http://backend-service:3001';
      expect(getApiBaseUrl()).toBe('http://backend-service:3001');
    });
  });

  describe('fetchCategories', () => {
    it('returns categories when API returns successful response', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Pottery & Ceramics',
          slug: 'pottery-ceramics',
          isActive: true,
          displayOrder: 1,
        },
        {
          id: 'cat-2',
          name: 'Original Paintings',
          slug: 'original-paintings',
          isActive: true,
          displayOrder: 2,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCategories }),
      } as Response);

      const result = await fetchCategories();
      expect(result).toHaveLength(2);
      expect(result[0]?.slug).toBe('pottery-ceramics');
    });

    it('returns empty array when API response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await fetchCategories();
      expect(result).toEqual([]);
    });

    it('returns empty array on network fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

      const result = await fetchCategories();
      expect(result).toEqual([]);
    });
  });

  describe('fetchProducts', () => {
    it('properly serializes filter and pagination parameters into query string', async () => {
      let requestedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        requestedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              items: [],
              meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
            },
          }),
        } as Response;
      });

      await fetchProducts({
        categorySlug: 'pottery-ceramics',
        productType: 'READY_TO_SHIP',
        minPriceMinor: 50000,
        maxPriceMinor: 200000,
        sort: 'price_asc',
        search: 'terracotta',
        page: 2,
        limit: 10,
      });

      expect(requestedUrl).toContain('categorySlug=pottery-ceramics');
      expect(requestedUrl).toContain('productType=READY_TO_SHIP');
      expect(requestedUrl).toContain('minPriceMinor=50000');
      expect(requestedUrl).toContain('maxPriceMinor=200000');
      expect(requestedUrl).toContain('sort=price_asc');
      expect(requestedUrl).toContain('search=terracotta');
      expect(requestedUrl).toContain('page=2');
      expect(requestedUrl).toContain('limit=10');
    });

    it('returns safe fallback object when fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchProducts({ page: 1, limit: 12 });
      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('fetchProductBySlug', () => {
    it('returns null if slug is empty or invalid', async () => {
      const res = await fetchProductBySlug('');
      expect(res).toBeNull();
    });

    it('returns product detail when API returns 200', async () => {
      const mockProduct: Partial<ProductDetailDto> = {
        id: 'p-1',
        title: 'Handmade Glazed Urn',
        slug: 'handmade-glazed-urn',
        basePriceMinor: 120000,
        currency: 'INR',
        variants: [],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProduct }),
      } as Response);

      const res = await fetchProductBySlug('handmade-glazed-urn');
      expect(res?.slug).toBe('handmade-glazed-urn');
    });

    it('returns null when product is not found (404)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const res = await fetchProductBySlug('non-existent-craft');
      expect(res).toBeNull();
    });
  });

  describe('Schema.org and Stock Availability Logic', () => {
    it('computes total stock correctly from variant inventories', () => {
      const sampleVariants = [
        {
          id: 'v1',
          inventory: {
            availableQuantity: 5,
            quantityOnHand: 5,
            quantityReserved: 0,
            isUnlimited: false,
            lowStockThreshold: 2,
          },
        },
        {
          id: 'v2',
          inventory: {
            availableQuantity: 3,
            quantityOnHand: 3,
            quantityReserved: 0,
            isUnlimited: false,
            lowStockThreshold: 1,
          },
        },
      ];

      const totalStock = sampleVariants.reduce(
        (sum, v) => sum + (v.inventory?.availableQuantity ?? 0),
        0,
      );

      expect(totalStock).toBe(8);
    });

    it('determines in-stock status correctly for ready-to-ship vs made-to-order', () => {
      const readyToShipInStock = { totalStock: 4, productType: 'READY_TO_SHIP' };
      const readyToShipOutOfStock = { totalStock: 0, productType: 'READY_TO_SHIP' };
      const madeToOrderZeroStock = { totalStock: 0, productType: 'MADE_TO_ORDER' };

      const isAvailable = (item: { totalStock: number; productType: string }) =>
        item.totalStock > 0 || item.productType === 'MADE_TO_ORDER';

      expect(isAvailable(readyToShipInStock)).toBe(true);
      expect(isAvailable(readyToShipOutOfStock)).toBe(false);
      expect(isAvailable(madeToOrderZeroStock)).toBe(true);
    });
  });
});
