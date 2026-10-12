'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartDto } from '@repo/api-contracts';
import { getApiBaseUrl } from './api';

interface CartContextType {
  cart: CartDto | null;
  itemsCount: number;
  isLoading: boolean;
  error: string | null;
  addToCart: (variantId: string, quantity?: number, customizationText?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  sessionId: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Initialize or restore persistent session ID
  useEffect(() => {
    let sid = '';
    if (typeof window !== 'undefined') {
      sid = localStorage.getItem('marketplace_cart_session_id') || '';
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
        localStorage.setItem('marketplace_cart_session_id', sid);
      }
      setSessionId(sid);
    }
  }, []);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (sessionId) {
      headers['x-cart-session-id'] = sessionId;
    }
    return headers;
  }, [sessionId]);

  const refreshCart = useCallback(async () => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/cart`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch cart: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setCart(data.data);
      }
    } catch (err) {
      console.warn('[CartContext] Error refreshing cart:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, getHeaders]);

  useEffect(() => {
    if (sessionId) {
      refreshCart();
    }
  }, [sessionId, refreshCart]);

  const addToCart = async (variantId: string, quantity = 1, customizationText?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/cart/items`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ variantId, quantity, customizationText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to add item to cart');
      }
      setCart(data.data);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to update item');
      }
      setCart(data.data);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to remove item');
      }
      setCart(data.data);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/cart/clear`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to clear cart');
      }
      setCart(data.data);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const itemsCount = cart?.itemsCount ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemsCount,
        isLoading,
        error,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
        sessionId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
