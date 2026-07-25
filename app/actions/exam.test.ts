import { describe, it, expect, vi, beforeEach } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

// Minimal thenable chain mirroring the real shim's fluent API — table-agnostic,
// each test controls exactly what each terminal call resolves to.
interface FakeChain {
    select: () => FakeChain;
    eq: () => FakeChain;
    in: () => FakeChain;
    order: () => FakeChain;
    single: () => Promise<{ data: unknown; error: unknown }>;
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
}

function fakeResult(data: unknown, error: unknown = null): FakeChain {
    const chain: FakeChain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        single: () => Promise.resolve({ data, error }),
        then: (resolve) => resolve({ data, error }),
    };
    return chain;
}

const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockFrom,
    }),
}));

const { getExam, submitExam } = await import('./exam');

beforeEach(() => {
    revalidatePath.mockReset();
    mockAuthGetUser.mockReset();
    mockFrom.mockReset();
});

describe('getExam', () => {
    it('returns the exam and its questions on success', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'Exam') return fakeResult({ id: 1, title: 'Final' });
            if (table === 'Question') return fakeResult([{ id: 1, text: 'Q1', order: 1, options: [] }]);
            throw new Error(`unexpected table ${table}`);
        });

        const result = await getExam(1);

        expect(result.exam).toEqual({ id: 1, title: 'Final' });
        expect(result.questions).toEqual([{ id: 1, text: 'Q1', order: 1, options: [] }]);
    });

    it('throws "Exam not found" when the exam query errors', async () => {
        mockFrom.mockImplementation((table: string) =>
            table === 'Exam' ? fakeResult(null, new Error('boom')) : fakeResult([])
        );

        await expect(getExam(1)).rejects.toThrow('Exam not found');
    });

    it('throws "Exam not found" when the exam is null even without an explicit error', async () => {
        mockFrom.mockImplementation((table: string) => (table === 'Exam' ? fakeResult(null) : fakeResult([])));

        await expect(getExam(1)).rejects.toThrow('Exam not found');
    });

    it('throws "Error fetching questions" when the questions query errors', async () => {
        mockFrom.mockImplementation((table: string) =>
            table === 'Exam' ? fakeResult({ id: 1 }) : fakeResult(null, new Error('boom'))
        );

        await expect(getExam(1)).rejects.toThrow('Error fetching questions');
    });
});

describe('submitExam: scoring', () => {
    function mockCorrectOptions(correctOptions: { questionId: number; id: number }[]) {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'Option') return fakeResult(correctOptions);
            if (table === 'ExamAttempt') {
                return { ...fakeResult(null), insert: () => fakeResult({ id: 'attempt-1' }) };
            }
            if (table === 'ExamResponse') return { ...fakeResult(null), insert: () => fakeResult(null) };
            throw new Error(`unexpected table ${table}`);
        });
    }

    beforeEach(() => {
        mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    });

    it('scores every correct answer and none of the incorrect ones', async () => {
        mockCorrectOptions([
            { questionId: 1, id: 100 },
            { questionId: 2, id: 200 },
        ]);

        const result = await submitExam(1, [
            { questionId: 1, optionId: 100 }, // correct
            { questionId: 2, optionId: 999 }, // wrong option chosen
        ]);

        expect(result.score).toBe(1);
        expect(result.totalQuestions).toBe(2);
    });

    it('scores 0 when every answer is wrong', async () => {
        mockCorrectOptions([{ questionId: 1, id: 100 }]);

        const result = await submitExam(1, [{ questionId: 1, optionId: 999 }]);

        expect(result.score).toBe(0);
    });

    it('scores full marks when every answer is correct', async () => {
        mockCorrectOptions([
            { questionId: 1, id: 100 },
            { questionId: 2, id: 200 },
            { questionId: 3, id: 300 },
        ]);

        const result = await submitExam(1, [
            { questionId: 1, optionId: 100 },
            { questionId: 2, optionId: 200 },
            { questionId: 3, optionId: 300 },
        ]);

        expect(result.score).toBe(3);
        expect(result.totalQuestions).toBe(3);
    });

    it('does not award a point for a question with no matching correct option on record', async () => {
        mockCorrectOptions([]); // no correct options returned at all

        const result = await submitExam(1, [{ questionId: 1, optionId: 100 }]);

        expect(result.score).toBe(0);
    });

    it('throws Unauthorized when there is no authenticated user', async () => {
        mockAuthGetUser.mockResolvedValue({ data: { user: null } });

        await expect(submitExam(1, [])).rejects.toThrow('Unauthorized');
    });

    it('revalidates the exam path and returns the attempt id on success', async () => {
        mockCorrectOptions([{ questionId: 1, id: 100 }]);

        const result = await submitExam(42, [{ questionId: 1, optionId: 100 }]);

        expect(result.success).toBe(true);
        expect(result.attemptId).toBe('attempt-1');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/exam/42');
    });

    it('throws when saving the attempt fails', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'Option') return fakeResult([]);
            if (table === 'ExamAttempt') return { ...fakeResult(null), insert: () => fakeResult(null, new Error('db down')) };
            throw new Error(`unexpected table ${table}`);
        });

        await expect(submitExam(1, [])).rejects.toThrow('db down');
    });

    it('throws when saving the responses fails', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'Option') return fakeResult([]);
            if (table === 'ExamAttempt') return { ...fakeResult(null), insert: () => fakeResult({ id: 'attempt-1' }) };
            if (table === 'ExamResponse') return { insert: () => Promise.resolve({ error: new Error('responses failed') }) };
            throw new Error(`unexpected table ${table}`);
        });

        await expect(submitExam(1, [{ questionId: 1, optionId: 1 }])).rejects.toThrow('responses failed');
    });
});
