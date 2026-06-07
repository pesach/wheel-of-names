// Sharing utilities to encode and decode wheel state in URL hash

/**
 * Compact representation of wheel state:
 * {
 *   n: name (string)
 *   e: entries (array of [text, weight, imagePathOrNull])
 *   c: colors (array of hex colors)
 *   s: settings (object containing custom options)
 * }
 */

export function compressToHash(wheelState) {
    try {
        const compactState = {
            n: wheelState.name || 'Wheel',
            e: wheelState.entries.map(entry => [
                entry.text, 
                entry.weight || 1,
                entry.image || null
            ]),
            c: wheelState.colors || [],
            s: wheelState.settings || {}
        };
        
        const jsonStr = JSON.stringify(compactState);
        // Base64 encode supporting UTF-8 characters
        const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
        return base64;
    } catch (e) {
        console.error("Failed to compress wheel state:", e);
        return null;
    }
}

export function decompressFromHash(hash) {
    if (!hash || hash.length < 3) return null;
    try {
        // Strip leading '#' if present
        const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
        const decodedJson = decodeURIComponent(escape(atob(cleanHash)));
        const compactState = JSON.parse(decodedJson);

        return {
            name: compactState.n || 'Shared Wheel',
            entries: (compactState.e || []).map(entryArr => ({
                text: entryArr[0],
                weight: entryArr[1] || 1,
                image: entryArr[2] || null
            })),
            colors: compactState.c || [],
            settings: compactState.s || {}
        };
    } catch (e) {
        console.error("Failed to decompress wheel state from hash:", e);
        return null;
    }
}

/**
 * Generate a shareable URL containing the current wheel state
 */
export function generateShareUrl(wheelState) {
    const hash = compressToHash(wheelState);
    if (!hash) return window.location.href;
    const url = new URL(window.location.href);
    url.hash = hash;
    return url.toString();
}
