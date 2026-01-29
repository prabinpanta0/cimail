export function extractEmailAddresses(headerValue: string | undefined): string[] {
    if (!headerValue) return [];
    const matches = headerValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return matches ? Array.from(new Set(matches.map(s => s.toLowerCase()))) : [];
}
