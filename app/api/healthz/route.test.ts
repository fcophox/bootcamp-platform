import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchQuery = vi.fn();
vi.mock('convex/nextjs', () => ({ fetchQuery: (...args: unknown[]) => fetchQuery(...args) }));
vi.mock('@/convex/_generated/api', () => ({ api: { bootcamps: { list: 'bootcamps.list' } } }));

const { GET } = await import('./route');

beforeEach(() => {
    fetchQuery.mockReset();
});

describe('GET /api/healthz', () => {
    it('returns 200 healthy when Convex responds', async () => {
        fetchQuery.mockResolvedValue([{ id: '1', title: 'Bootcamp' }]);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('healthy');
        expect(fetchQuery).toHaveBeenCalledWith('bootcamps.list', {});
    });

    it('returns 503 unhealthy when Convex is unreachable', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchQuery.mockRejectedValue(new Error('convex is down'));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('unhealthy');
        expect(body.error).toBe('convex is down');
        consoleError.mockRestore();
    });
});
