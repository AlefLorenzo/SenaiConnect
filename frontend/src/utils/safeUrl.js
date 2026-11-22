export function getSafeDestination(value) {
    const destination = String(value || '').trim();
    if (!destination || /^(javascript|data|file|vbscript):/i.test(destination)) return null;

    if (destination.startsWith('/')) {
        if (destination.startsWith('//') || destination.includes(String.fromCharCode(92))) return null;
        return destination;
    }

    try {
        const parsed = new URL(destination);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
    } catch {
        return null;
    }
}

export function isExternalDestination(value) {
    const safe = getSafeDestination(value);
    return Boolean(safe && /^https?:\/\//i.test(safe));
}
