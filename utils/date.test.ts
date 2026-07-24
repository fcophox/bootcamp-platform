import { describe, it, expect } from 'vitest';
import { hasBootcampStarted, formatDateString, formatDateToLocal } from './date';

function toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function daysFromNow(offset: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
}

describe('hasBootcampStarted', () => {
    it('returns false for null, undefined, or empty string', () => {
        expect(hasBootcampStarted(null)).toBe(false);
        expect(hasBootcampStarted(undefined)).toBe(false);
        expect(hasBootcampStarted('')).toBe(false);
    });

    it('parses YYYY-MM-DD: true for a past start date, false for a future one', () => {
        expect(hasBootcampStarted(toYmd(daysFromNow(-10)))).toBe(true);
        expect(hasBootcampStarted(toYmd(daysFromNow(10)))).toBe(false);
    });

    it('treats today as started (inclusive)', () => {
        expect(hasBootcampStarted(toYmd(daysFromNow(0)))).toBe(true);
    });

    it('falls back to native Date parsing for non YYYY-MM-DD but Date-parseable strings', () => {
        expect(hasBootcampStarted('2020/01/15')).toBe(true);
        expect(hasBootcampStarted('2099/01/15')).toBe(false);
    });

    it('parses Spanish month names with an explicit year', () => {
        expect(hasBootcampStarted('15 de Febrero de 2020')).toBe(true);
        expect(hasBootcampStarted('15 de Febrero de 2099')).toBe(false);
    });

    it('parses short Spanish month abbreviations with an explicit year', () => {
        expect(hasBootcampStarted('15 Feb 2020')).toBe(true);
        expect(hasBootcampStarted('15 Feb 2099')).toBe(false);
    });

    it('defaults to true for text it cannot parse as any known date format', () => {
        // Documented behavior: unparseable legacy free text is treated as "started"
        // rather than blocking access.
        expect(hasBootcampStarted('Próximamente')).toBe(true);
        expect(hasBootcampStarted('TBD')).toBe(true);
    });
});

describe('formatDateString', () => {
    it('returns "--" for null or undefined', () => {
        expect(formatDateString(null)).toBe('--');
        expect(formatDateString(undefined)).toBe('--');
    });

    it('formats a YYYY-MM-DD string using the es-ES long month locale format', () => {
        const expected = new Date(2026, 2, 5).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        const result = formatDateString('2026-03-05');
        expect(result).toBe(expected);
        expect(result).toContain('2026');
        expect(result.toLowerCase()).toContain('marzo');
    });

    it('returns the original string unchanged when it does not match YYYY-MM-DD', () => {
        expect(formatDateString('5 de marzo de 2026')).toBe('5 de marzo de 2026');
        expect(formatDateString('not-a-date')).toBe('not-a-date');
    });
});

describe('formatDateToLocal', () => {
    it('returns "--" for null or undefined', () => {
        expect(formatDateToLocal(null)).toBe('--');
        expect(formatDateToLocal(undefined)).toBe('--');
    });

    it('returns "--" for an invalid date string', () => {
        expect(formatDateToLocal('not-a-date')).toBe('--');
    });

    it('formats a Date object using es-ES 2-digit day/month format', () => {
        const date = new Date(2026, 2, 5);
        const expected = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        expect(formatDateToLocal(date)).toBe(expected);
    });

    it('formats an ISO date string the same way as the equivalent Date object', () => {
        const iso = '2026-03-05T00:00:00';
        const expected = new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        expect(formatDateToLocal(iso)).toBe(expected);
    });

    it('treats a small numeric timestamp as Unix seconds', () => {
        const seconds = 1700000000; // well below the 9999999999 threshold
        const expected = new Date(seconds * 1000).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        expect(formatDateToLocal(seconds)).toBe(expected);
    });

    it('treats a large numeric timestamp as Unix milliseconds', () => {
        const millis = 1700000000000; // above the 9999999999 threshold
        const expected = new Date(millis).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        expect(formatDateToLocal(millis)).toBe(expected);
    });
});
