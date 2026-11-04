/**
 * Turnstile 認証済みセッション管理モジュール
 * 検証成功時に署名付きの HttpOnly Cookie を発行し、保護対象の API で検証します。
 * localStorage の値と違い、サーバーの秘密鍵で署名されているため、ブラウザ側では偽造できません。
 */
import crypto from 'crypto';

const COOKIE_NAME = 'tl_session';
const SESSION_DURATION_SEC = 24 * 60 * 60; // 24時間（js/turnstile.js の AUTH_DURATION_MS と合わせる）

// 署名用の秘密鍵。SESSION_SECRET を推奨、未設定なら TURNSTILE_SECRET_KEY で代用する
function getSecret() {
    return process.env.SESSION_SECRET || process.env.TURNSTILE_SECRET_KEY || '';
}

function sign(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function readCookie(request, name) {
    const header = request.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) {
            return part.slice(idx + 1).trim();
        }
    }
    return null;
}

/**
 * 認証済みセッションの Set-Cookie 文字列を生成
 * @param {import('http').IncomingMessage} request
 * @returns {string}
 */
export function createSessionCookie(request) {
    const secret = getSecret();
    if (!secret) {
        throw new Error('SESSION_SECRET または TURNSTILE_SECRET_KEY が設定されていません。');
    }

    const exp = Date.now() + SESSION_DURATION_SEC * 1000;
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
    const signature = sign(payload, secret);

    const attributes = [
        `${COOKIE_NAME}=${payload}.${signature}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${SESSION_DURATION_SEC}`
    ];
    // http://localhost（vercel dev）では Secure を付けると保存されない環境があるため、HTTPS のときだけ付与
    if (request.headers['x-forwarded-proto'] === 'https') {
        attributes.push('Secure');
    }
    return attributes.join('; ');
}

/**
 * リクエストが有効な認証済みセッション Cookie を持っているか確認
 * @param {import('http').IncomingMessage} request
 * @returns {boolean}
 */
export function hasValidSession(request) {
    const secret = getSecret();
    if (!secret) return false;

    const raw = readCookie(request, COOKIE_NAME);
    if (!raw) return false;

    const [payload, signature, ...rest] = raw.split('.');
    if (!payload || !signature || rest.length > 0) return false;

    // 署名の検証（タイミング攻撃を避けるため timingSafeEqual で比較）
    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(payload, secret));
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return false;
    }

    try {
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return Number.isFinite(exp) && Date.now() < exp;
    } catch (e) {
        return false;
    }
}

/**
 * 認証済みでなければ 401 を返す。呼び出し側は false が返ったらすぐ return すること
 * フロントはこの code を見て認証ゲートを再表示する
 * @returns {boolean} 認証済みなら true
 */
export function requireSession(request, response) {
    if (hasValidSession(request)) return true;

    response.status(401).json({
        error: 'セキュリティ確認が必要です。確認を完了してください。',
        code: 'TURNSTILE_REQUIRED'
    });
    return false;
}