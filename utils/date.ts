export function hasBootcampStarted(startDateStr: string | null | undefined): boolean {
    if (!startDateStr) return false;
    
    // Compare dates ignoring time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to parse standard YYYY-MM-DD
    const parts = startDateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const start = new Date(year, month, day);
            return start <= today;
        }
    }

    const date = new Date(startDateStr);
    if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date <= today;
    }

    // Try Spanish format (e.g. "9 de Junio", "15 Feb 2026")
    const cleanStr = startDateStr.toLowerCase();
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    let foundMonth = -1;
    for (let i = 0; i < months.length; i++) {
        if (cleanStr.includes(months[i])) {
            foundMonth = i;
            break;
        }
    }
    
    // Also check for short months if needed
    const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (foundMonth === -1) {
        for (let i = 0; i < shortMonths.length; i++) {
            if (cleanStr.includes(shortMonths[i])) {
                foundMonth = i;
                break;
            }
        }
    }

    if (foundMonth !== -1) {
        const matchDay = cleanStr.match(/\d+/);
        if (matchDay) {
            const day = parseInt(matchDay[0], 10);
            
            // Check if year is present in the string (4 digits)
            const matchYear = cleanStr.match(/\b\d{4}\b/);
            const year = matchYear ? parseInt(matchYear[0], 10) : today.getFullYear();
            
            const start = new Date(year, foundMonth, day);
            return start <= today;
        }
    }

    // Default to true for legacy custom text that we cannot parse as a future date
    return true;
}

export function formatDateString(dateStr: string | null | undefined): string {
    if (!dateStr) return '--';
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(dateStr)) {
        try {
            const parts = dateStr.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }
    return dateStr;
}

export function formatDateToLocal(dateInput: Date | string | null | undefined): string {
    if (!dateInput) return '--';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
