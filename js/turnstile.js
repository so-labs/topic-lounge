/**
 * ============================================================
 * Cloudflare Turnstile アクセス時認証モジュール
 * 初回アクセス時にボット検証を行い、成功後にセッションを保持してサイトを解放します。
 * ============================================================
 */

const TURNSTILE_SITE_KEY = '0x4AAAAAAFGOwp9Sc5n0RYKX';
const VERIFIED_STORAGE_KEY = 'topic_lounge_turnstile_verified';

let widgetId = null;

/**
 * Turnstile の初期化
 */
export function initTurnstile() {
    const modal = document.getElementById('turnstileModal');
    const container = document.getElementById('turnstileWidget');
    const statusText = document.getElementById('turnstileStatus');
    const errorContainer = document.getElementById('turnstileError');
    const retryBtn = document.getElementById('turnstileRetryBtn');

    if (!modal || !container) return;

    // 既に同一セッションで認証済みの場合はスキップ
    if (sessionStorage.getItem(VERIFIED_STORAGE_KEY) === 'true') {
        modal.classList.add('hidden');
        return;
    }

    // モーダルを表示
    modal.classList.remove('hidden');

    // 再試行ボタンのイベント
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            resetTurnstile();
        });
    }

    // Turnstile スクリプトの読み込み待機とレンダリング
    renderWhenReady();
}

/**
 * window.turnstile が利用可能になるまで待機して描画
 */
function renderWhenReady(attempt = 0) {
    const container = document.getElementById('turnstileWidget');
    const statusText = document.getElementById('turnstileStatus');
    const errorContainer = document.getElementById('turnstileError');
    const retryBtn = document.getElementById('turnstileRetryBtn');

    if (window.turnstile && typeof window.turnstile.render === 'function') {
        try {
            if (widgetId !== null) {
                window.turnstile.remove(widgetId);
            }

            widgetId = window.turnstile.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'auto',
                callback: async (token) => {
                    if (statusText) statusText.textContent = '認証を確認中...';
                    await verifyTokenWithServer(token);
                },
                'error-callback': (code) => {
                    console.error('[Turnstile] エラーコード:', code);
                    showError('認証に失敗しました。時間をおいて再試行してください。');
                },
                'expired-callback': () => {
                    console.warn('[Turnstile] トークンの有効期限が切れました。');
                    if (statusText) statusText.textContent = '認証の有効期限が切れました。再認証してください。';
                    resetTurnstile();
                }
            });
        } catch (err) {
            console.error('[Turnstile] レンダリングエラー:', err);
            showError('認証ウィジェットの表示に失敗しました。');
        }
        return;
    }

    // まだ読み込まれていない場合はリトライ（最大10秒 = 100ms * 100）
    if (attempt < 100) {
        setTimeout(() => renderWhenReady(attempt + 1), 100);
    } else {
        showError('認証スクリプトの読み込みに失敗しました。広告ブロッカー等が有効な場合は一時的に解除して再読み込みしてください。');
    }
}

/**
 * サーバー側でトークンを検証
 * @param {string} token
 */
async function verifyTokenWithServer(token) {
    const modal = document.getElementById('turnstileModal');
    const statusText = document.getElementById('turnstileStatus');

    try {
        const response = await fetch('/api/verify-turnstile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            if (statusText) statusText.textContent = '認証完了！サイトを読み込んでいます...';
            sessionStorage.setItem(VERIFIED_STORAGE_KEY, 'true');

            // 成功メッセージを一瞬表示してからモーダルをフェードアウト
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        } else {
            showError(data.error || '認証に失敗しました。もう一度お試しください。');
        }
    } catch (err) {
        console.error('[Turnstile] サーバー検証通信エラー:', err);
        showError('検証サーバーとの通信に失敗しました。ネットワーク状況をご確認ください。');
    }
}

/**
 * エラー表示
 * @param {string} message
 */
function showError(message) {
    const statusText = document.getElementById('turnstileStatus');
    const errorContainer = document.getElementById('turnstileError');
    const retryBtn = document.getElementById('turnstileRetryBtn');

    if (statusText) statusText.textContent = '';
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
    if (retryBtn) {
        retryBtn.style.display = 'inline-flex';
    }
}

/**
 * ウィジェットのリセット
 */
function resetTurnstile() {
    const statusText = document.getElementById('turnstileStatus');
    const errorContainer = document.getElementById('turnstileError');
    const retryBtn = document.getElementById('turnstileRetryBtn');

    if (errorContainer) {
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
    }
    if (retryBtn) {
        retryBtn.style.display = 'none';
    }
    if (statusText) {
        statusText.textContent = '安全なアクセスのため、確認を行っています...';
    }

    if (window.turnstile && widgetId !== null) {
        window.turnstile.reset(widgetId);
    } else {
        renderWhenReady();
    }
}
