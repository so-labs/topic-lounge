/**
 * セッション情報取得用サーバーレス関数 (Vercel Functions)
 * 認証画面に表示する「IPアドレス」を返します。
 * IPアドレスはブラウザの JavaScript からは取得できないため、サーバー側でヘッダーから読み取ります。
 */

export default function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const forwarded = request.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
        || request.headers['x-real-ip']
        || request.socket?.remoteAddress
        || '';

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ ip });
}