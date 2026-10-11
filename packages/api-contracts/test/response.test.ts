import { describe, expect, it } from 'vitest';
import { createErrorResponse, createSuccessResponse } from '../src/response';

describe('API response contracts', () => {
  it('creates standardized success response envelope', () => {
    const res = createSuccessResponse({ id: '123' }, 'req-abc');
    expect(res.success).toBe(true);
    expect(res.data.id).toBe('123');
    expect(res.meta?.correlationId).toBe('req-abc');
    expect(res.meta?.timestamp).toBeDefined();
  });

  it('creates standardized error response envelope', () => {
    const err = createErrorResponse('NOT_FOUND', 'Entity not found', { entity: 'item' }, 'req-xyz');
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('NOT_FOUND');
    expect(err.error.message).toBe('Entity not found');
    expect(err.error.correlationId).toBe('req-xyz');
    expect(err.error.details).toEqual({ entity: 'item' });
    expect(err.error.timestamp).toBeDefined();
  });
});
