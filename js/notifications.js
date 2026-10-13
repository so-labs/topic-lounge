/* ============================================================
   PWA & 通知 (Notifications) 共通モジュール
   PWAとしてインストールされている環境でのみ、生成成功通知を送信します。
   ============================================================ */

/**
 * アプリがPWAとしてインストール（スタンドアロン起動）されているかを判定する
 * @returns {boolean}
 */
export function isInstalledPwa() {
    if (typeof window === 'undefined') return false;

    const isStandaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = window.navigator && window.navigator.standalone === true;
    const isAndroidTwa = typeof document !== 'undefined' && document.referrer.includes('android-app://');

    return !!(isStandaloneDisplay || isIosStandalone || isAndroidTwa);
}

/**
 * 通知の許可状態を確認し、未確認（default）の場合は許可を要求する
 * @returns {Promise<NotificationPermission|'unsupported'>}
 */
export async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }

    if (Notification.permission === 'default') {
        try {
            return await Notification.requestPermission();
        } catch (e) {
            console.warn('[notifications] 通知許可リクエストでエラーが発生しました:', e);
            return Notification.permission;
        }
    }

    return Notification.permission;
}

/**
 * PWA環境かつ通知が許可されている場合に、生成完了のプッシュ/ローカル通知を送信する
 * バックグラウンド（非表示）時のみ通知を送信します。
 * @param {'topics'|'relay'} type - 通知の種別
 * @param {string|{turn: number, text: string}} data - 表示内容
 */
export async function notifyGenerationSuccess(type, data) {
    // PWAとしてインストールされている環境のみ通知
    if (!isInstalledPwa()) {
        return;
    }

    // フォアグラウンド（画面が見えている状態）では通知しない
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
        return;
    }

    if (Notification.permission !== 'granted') {
        return;
    }

    let title = '生成が完了しました！';
    let body = '';
    let tag = 'topic-lounge-generated';

    if (type === 'topics') {
        title = '【Topic Lounge】お題が生成されました！';
        const ideaText = typeof data === 'string' ? data : (data?.idea || '');
        body = ideaText ? ideaText.slice(0, 80) : '新しいお題が完成しました。';
        tag = 'topic-lounge-topic';
    } else if (type === 'relay') {
        title = '【Topic Lounge】物語の続きが届きました！';
        const turn = data?.turn ? `第${data.turn}ターン: ` : '';
        const storyText = (data?.text || '').trim();
        body = `${turn}${storyText.slice(0, 80)}`;
        tag = 'topic-lounge-relay';
    }

    const options = {
        body,
        icon: './icons/icon.svg',
        badge: './icons/icon.svg',
        tag,
        renotify: true,
        data: {
            url: './',
            type
        }
    };

    try {
        // Service Worker の showNotification を優先（バックグラウンドやスタンドアロンで最も安定）
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration && typeof registration.showNotification === 'function') {
                await registration.showNotification(title, options);
                return;
            }
        }

        // フォールバック: ネイティブ Notification
        new Notification(title, options);
    } catch (e) {
        console.warn('[notifications] 通知送信に失敗しました:', e);
    }
}

/**
 * PWA環境かつバックグラウンド時に、全リトライ失敗の通知を送信する
 * @param {'topics'|'relay'} type - 通知の種別
 */
export async function notifyGenerationFailure(type) {
    if (!isInstalledPwa()) return;

    // フォアグラウンド時は通知しない
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const isTopics = type === 'topics';
    const title = isTopics
        ? '【Topic Lounge】お題の生成に失敗しました'
        : '【Topic Lounge】AIの応答に失敗しました';
    const body = '再試行しても失敗しました。アプリを開いて再度お試しください。';
    const tag = isTopics ? 'topic-lounge-topic-error' : 'topic-lounge-relay-error';

    const options = {
        body,
        icon: './icons/icon.svg',
        badge: './icons/icon.svg',
        tag,
        renotify: true,
        data: { url: './', type }
    };

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration && typeof registration.showNotification === 'function') {
                await registration.showNotification(title, options);
                return;
            }
        }
        new Notification(title, options);
    } catch (e) {
        console.warn('[notifications] 失敗通知の送信に失敗しました:', e);
    }
}
