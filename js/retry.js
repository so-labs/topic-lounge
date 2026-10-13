/* ============================================================
   自動リトライ (Auto Retry) 共通モジュール
   サーバー混雑やタイムアウトなどの一時的な障害に対してのみ自動再試行を行います。
   APIクォータ上限や不正なリクエスト等の恒久的なエラーはリトライ対象外とします。
   ============================================================ */

export const AUTO_RETRY_STORAGE_KEY = 'topic_lounge_auto_retry';

/**
 * 自動リトライ設定が有効になっているかを取得する
 * @returns {boolean}
 */
export function isAutoRetryEnabled() {
    try {
        return localStorage.getItem(AUTO_RETRY_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * 自動リトライ設定のON/OFFを保存する
 * @param {boolean} enabled
 */
export function setAutoRetryEnabled(enabled) {
    try {
        localStorage.setItem(AUTO_RETRY_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (e) {
        console.warn('[retry] localStorageへの書き込みに失敗しました:', e);
    }
}

/**
 * エラーが「自動リトライすべき一時的なサーバー問題」であるかを判定する
 *
 * リトライ対象:
 *   - 503 (混雑 / Service Unavailable)
 *   - 504 (タイムアウト / Gateway Timeout)
 *   - 502 / 524 (プロキシ無応答 / ゲートウェイエラー)
 *   - クライアント通信タイムアウト (AbortError / TimeoutError)
 *   - ネットワーク一時不通 (Failed to fetch 等のTypeError)
 *
 * リトライ対象外（即時終了）:
 *   - 429 (クォータ上限 / Too Many Requests)
 *   - 400 (無効なモデル、不正なパラメータ、ワード文字数違反など)
 *   - 401 / 403 (認証・権限エラー)
 *   - 404 / 405 (エンドポイント不在、Method Not Allowed)
 *   - APIキー未設定などのサーバー恒久設定エラー
 *
 * @param {Error|any} error
 * @param {number} [status]
 * @returns {boolean}
 */
export function isRetryableError(error, status = 0) {
    const errorStatus = status || error?.status || 0;
    const message = (error?.message || '').toLowerCase();

    // 1. クォータ上限・レート制限は絶対リトライしない（無料枠上限等）
    if (errorStatus === 429 ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('クォータ') ||
        message.includes('上限') ||
        message.includes('exhausted') ||
        message.includes('rate limit')) {
        return false;
    }

    // 2. クライアント側の不正入力やモデル不在・権限エラーはリトライしない
    if (errorStatus === 400 ||
        errorStatus === 401 ||
        errorStatus === 403 ||
        errorStatus === 404 ||
        errorStatus === 405 ||
        message.includes('無効なモデル') ||
        message.includes('軽量モデル') ||
        message.includes('単語のみ') ||
        message.includes('ワードが指定') ||
        message.includes('apiキーが設定されていません')) {
        return false;
    }

    // 3. サーバー側の一時的混雑・タイムアウト・ゲートウェイエラーはリトライ対象
    if (errorStatus === 503 ||
        errorStatus === 504 ||
        errorStatus === 502 ||
        errorStatus === 521 ||
        errorStatus === 522 ||
        errorStatus === 524) {
        return true;
    }

    // 4. 通信タイムアウト系
    if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        return true;
    }

    // 5. ネットワーク接続の一時切断・Fetch失敗
    if (error instanceof TypeError && message.includes('fetch')) {
        return true;
    }

    // 6. メッセージに一時的サーバー障害の兆候がある場合
    if (message.includes('503') ||
        message.includes('504') ||
        message.includes('502') ||
        message.includes('混雑') ||
        message.includes('タイムアウト') ||
        message.includes('high demand') ||
        message.includes('unavailable') ||
        message.includes('一時的')) {
        return true;
    }

    return false;
}

/**
 * 指定した非同期処理を、必要に応じて自動リトライ付きで実行する
 * @template T
 * @param {(attempt: number) => Promise<T>} taskFn - 実行する非同期タスク
 * @param {Object} [options]
 * @param {number} [options.maxRetries=2] - 最大再試行回数（初回を含めると最大3回試行）
 * @param {number} [options.baseDelayMs=1500] - 初回再試行までの待機ミリ秒（指数バックオフ）
 * @param {(attempt: number, maxRetries: number, delayMs: number, error: Error) => void} [options.onRetry] - 再試行前の通知コールバック
 * @returns {Promise<T>}
 */
export async function withAutoRetry(taskFn, options = {}) {
    const {
        maxRetries = 2,
        baseDelayMs = 1500,
        onRetry = null,
    } = options;

    const enabled = isAutoRetryEnabled();

    // 自動リトライが無効の場合は1回のみ実行
    if (!enabled) {
        return await taskFn(0);
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await taskFn(attempt);
        } catch (error) {
            lastError = error;

            // 最終試行の場合はリトライせずにエラーをスロー
            if (attempt >= maxRetries) {
                break;
            }

            // リトライ対象エラーかどうかを判定
            const canRetry = isRetryableError(error);
            if (!canRetry) {
                console.warn(`[retry] リトライ対象外のエラーのため中断します:`, error.message);
                throw error;
            }

            // 指数バックオフ待機（1回目: 1.5s, 2回目: 3.0s）
            // タイムアウト系エラー（AbortError / TimeoutError / 504）はサーバーが高負荷なので、待機を長めに取る
            const isTimeout = (error.name === 'AbortError' || error.name === 'TimeoutError') ||
                (error?.status === 504) ||
                ((error?.message || '').toLowerCase().includes('タイムアウト'));
            const delayMs = isTimeout
                ? 5000 + baseDelayMs * Math.pow(2, attempt) // タイムアウト時は基本待機に5s加算
                : baseDelayMs * Math.pow(2, attempt);
            console.warn(`[retry] リトライ試行 (${attempt + 1}/${maxRetries}) - ${delayMs}ms後に再試行します:`, error.message);

            if (typeof onRetry === 'function') {
                try {
                    onRetry(attempt + 1, maxRetries, delayMs, error);
                } catch (cbErr) {
                    console.error('[retry] onRetryコールバック内でエラー:', cbErr);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}
