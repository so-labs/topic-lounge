/**
 * ============================================================
 * Topic Lounge - メインエントリーポイント
 * 各機能モジュールをインポートして初期化します。
 * ============================================================
 */

import { initTheme } from './js/theme.js';
import { initTabs } from './js/tabs.js';
import { initSettings } from './js/settings.js';
import { initTopics } from './js/topics.js';
import { initRelay } from './js/relay.js';

// DOMContentLoaded で各モジュールを安全に初期化
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initSettings();
    initTopics();
    initRelay();
});

// PWA Service Worker の登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => {
            console.error('Service Worker registration failed:', error);
        });
    });
}