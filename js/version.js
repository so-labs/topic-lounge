export async function getAppVersion(swPath = './sw.js') {
    try {
        const response = await fetch(swPath, { cache: 'no-store' });
        if (!response.ok) return 'Unknown';

        const text = await response.text();
        const match = text.match(/CACHE_NAME\s*=\s*['"]topic-lounge-(.+?)['"]/);

        if (match && match[1]) {
            return match[1];
        }
    } catch (e) {
        console.warn('Failed to fetch app version from sw.js:', e);
    }
    return 'Unknown';
}