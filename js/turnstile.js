/**
 * ============================================================
 * Cloudflare Turnstile アクセス時認証モジュール
 * 初回アクセス時にボット検証を行い、成功後に24時間の認証状態を保持してサイトを解放します。
 * 認証状態の実体はサーバーが発行する署名付き Cookie で、localStorage は画面側のヒントとして使います。
 * ============================================================
 */

const TURNSTILE_SITE_KEY = '0x4AAAAAAFGOwp9Sc5n0RYKX';
const VERIFIED_STORAGE_KEY = 'topic_lounge_turnstile_verified';
const AUTH_DURATION_MS = 24 * 60 * 60 * 1000; // 24時間（lib/turnstile-session.js の SESSION_DURATION_SEC と合わせる）

let widgetId = null;
let authGuardInstalled = false; // fetch ガードの二重設置を防ぐフラグ

/**
 * IPアドレスをサーバーから取得して画面に表示
 * ウィジェットの描画は待たない。取得に失敗しても認証自体には影響しない
 */
async function loadIpAddress() {
    const ipEl = document.getElementById('turnstileIp');

    try {
        const response = await fetch('/api/session-info', {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (ipEl) ipEl.textContent = data.ip || '取得できませんでした';
    } catch (err) {
        console.warn('[Turnstile] IPアドレスの取得に失敗しました:', err);
        if (ipEl) ipEl.textContent = '取得できませんでした';
    }
}

/**
 * Turnstile 認証が有効期限内かどうかを判定
 * 期限切れまたは不正な値の場合は localStorage から削除して false を返す
 * @returns {boolean}
 */
function isTurnstileVerified() {
    try {
        const storedValue = localStorage.getItem(VERIFIED_STORAGE_KEY);
        if (storedValue === null) {
            return false;
        }

        const expiresAt = Number(storedValue);
        // 数値として正しいか確認（NaN, Infinity 等を排除）
        if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
            localStorage.removeItem(VERIFIED_STORAGE_KEY);
            return false;
        }

        // 現在時刻が保存された期限より前か確認
        if (Date.now() < expiresAt) {
            return true;
        }

        // 期限切れの場合
        localStorage.removeItem(VERIFIED_STORAGE_KEY);
        return false;
    } catch (e) {
        console.warn('[Turnstile] localStorage の参照に失敗しました:', e);
        return false;
    }
}

/**
 * サーバーから「認証が必要」(401) と返されたときに、認証ゲートを再表示する
 * Cookie の期限切れ・削除、localStorage の改ざんなどで「認証済み」の見た目とサーバー側の状態がずれた場合の復帰用
 */
function reopenGate() {
    const modal = document.getElementById('turnstileModal');
    if (!modal) return;

    // 既にゲートが開いている間は何もしない（複数のリクエストが同時に 401 になった場合の重複防止）
    const isOpen = !modal.classList.contains('hidden') && !document.documentElement.classList.contains('turnstile-ok');
    if (isOpen) return;

    try {
        localStorage.removeItem(VERIFIED_STORAGE_KEY);
    } catch (e) {
        console.warn('[Turnstile] localStorage の更新に失敗しました:', e);
    }
    document.documentElement.classList.remove('turnstile-ok');
    initTurnstile();
}

/**
 * fetch をラップして、API が 401 + code=TURNSTILE_REQUIRED を返したらゲートを再表示する
 * お題生成・リレー小説など、各機能のコードを個別に直さなくてもよいようにするための仕組み
 */
function installAuthGuard() {
    if (authGuardInstalled || typeof window.fetch !== 'function') return;
    authGuardInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.status === 401) {
            // 呼び出し元の処理は待たせず、裏で中身を確認する
            response.clone().json().then((data) => {
                if (data && data.code === 'TURNSTILE_REQUIRED') {
                    reopenGate();
                }
            }).catch(() => { });
        }
        return response;
    };
}

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

    installAuthGuard();

    // localStorage の値は「ゲートを最初から出さないためのヒント」にすぎない
    // 本当の認証済み判定は、サーバーが発行した署名付き Cookie を各 API が確認して行う
    // 既に認証済み（24時間の有効期間内）の場合はスキップ
    if (isTurnstileVerified()) {
        modal.classList.add('hidden');
        return;
    }

    // モーダルを表示
    modal.classList.remove('hidden');

    // 再表示のときに、前回のエラーや完了メッセージが残らないようにする
    if (errorContainer) {
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
    }
    if (retryBtn) {
        retryBtn.style.display = 'none';
    }
    if (statusText) {
        statusText.textContent = '継続するにはセキュリティチェックを完了してください';
    }

    // 再試行ボタンのイベント
    // （再表示のたびに initTurnstile が呼ばれるため、addEventListener ではなく onclick で二重登録を防ぐ）
    if (retryBtn) {
        retryBtn.onclick = () => {
            resetTurnstile();
        };
    }

    // IPアドレスは裏で取得しつつ、ウィジェットはすぐ描画する
    loadIpAddress();

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
            try {
                const expiresAt = Date.now() + AUTH_DURATION_MS;
                localStorage.setItem(VERIFIED_STORAGE_KEY, String(expiresAt));
            } catch (e) {
                console.warn('[Turnstile] localStorage への保存に失敗しました:', e);
            }

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
        statusText.textContent = '継続するにはセキュリティチェックを完了してください';
    }

    if (window.turnstile && widgetId !== null) {
        window.turnstile.reset(widgetId);
    } else {
        renderWhenReady();
    }
}
