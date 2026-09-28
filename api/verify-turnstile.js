/**
 * Cloudflare Turnstile 検証用サーバーレス関数 (Vercel Functions)
 * クライアントから受け取った Turnstile トークンを Cloudflare の siteverify API で検証します。
 */

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { token } = request.body || {};
    if (!token || typeof token !== 'string') {
        return response.status(400).json({ success: false, error: '認証トークンが指定されていません。' });
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
        console.error('[verify-turnstile] エラー: TURNSTILE_SECRET_KEY が環境変数に設定されていません。');
        return response.status(500).json({ success: false, error: 'サーバー環境変数が設定されていません。' });
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);

        // クライアントIPの取得（任意）
        const clientIp = request.headers['x-forwarded-for'] || request.socket?.remoteAddress;
        if (clientIp) {
            const ip = clientIp.split(',')[0].trim();
            formData.append('remoteip', ip);
        }

        const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!cfResponse.ok) {
            console.error(`[verify-turnstile] Cloudflare API HTTPエラー: status=${cfResponse.status}`);
            return response.status(502).json({ success: false, error: 'Cloudflare認証サーバーとの通信に失敗しました。' });
        }

        const result = await cfResponse.json();
        console.log(`[verify-turnstile] 検証結果: success=${result.success}`);

        if (result.success) {
            return response.status(200).json({ success: true });
        } else {
            console.warn('[verify-turnstile] 検証失敗:', result['error-codes'] || []);
            return response.status(403).json({
                success: false,
                error: 'ボット対策の検証に失敗しました。',
                codes: result['error-codes'] || []
            });
        }
    } catch (err) {
        console.error('[verify-turnstile] サーバー例外エラー:', err);
        return response.status(500).json({ success: false, error: '検証中にエラーが発生しました。' });
    }
}
