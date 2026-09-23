/* ============================================================
   エラー表示 共通モジュール
   お題生成・直前リレー小説など、AI応答を伴う処理のエラー表示を
   共通化するためのユーティリティ。
   ============================================================ */

const DEFAULT_TIMEOUT_MESSAGE = '処理がタイムアウトしました。混雑している可能性があるため、再度試すか別のモデルをお試しください。';
const DEFAULT_FALLBACK_MESSAGE = '通信エラーが発生しました。もう一度お試しください。';

// Errorオブジェクトから、ユーザーに表示すべきメッセージ文字列を組み立てる
function resolveErrorMessage(error, options = {}) {
    const {
        timeoutMessage = DEFAULT_TIMEOUT_MESSAGE,
        fallbackMessage = DEFAULT_FALLBACK_MESSAGE
    } = options;

    // fetchのAbortController由来、または明示的なタイムアウトエラー
    if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        return timeoutMessage;
    }

    return (error && error.message) || fallbackMessage;
}

let errorTimeoutId = null;

/**
 * 指定した要素にエラーメッセージをポップアップ表示する。
 * @param {HTMLElement} element - エラーメッセージを表示する要素
 * @param {Error|string} error - 表示するエラー（文字列を直接渡した場合はそのまま表示）
 * @param {Object} [options]
 * @param {string} [options.timeoutMessage] - タイムアウト系エラー時に表示するメッセージ
 * @param {string} [options.fallbackMessage] - メッセージを特定できない場合のフォールバック
 */
export function showError(element, error, options = {}) {
    if (!element) return;

    if (typeof error === 'string') {
        element.textContent = error;
    } else {
        element.textContent = resolveErrorMessage(error, options);
    }
    
    element.classList.add('show-toast');
    
    if (errorTimeoutId) {
        clearTimeout(errorTimeoutId);
    }
    
    // 5秒後に自動的に閉じる
    errorTimeoutId = setTimeout(() => {
        clearError(element);
    }, 5000);
}

/**
 * 指定した要素のエラー表示をクリア（非表示）する。
 * @param {HTMLElement} element
 */
export function clearError(element) {
    if (!element) return;
    element.classList.remove('show-toast');
    
    // アニメーション完了後にテキストをクリア
    setTimeout(() => {
        if (!element.classList.contains('show-toast')) {
            element.textContent = '';
        }
    }, 300);
}