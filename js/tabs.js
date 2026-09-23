/* ============================================================
   タブ切り替えモジュール (URLハッシュ連動)
   ============================================================ */

import { filterModels } from './settings.js';

export function initTabs() {
    const tabHome = document.getElementById('tabHome');
    const tabTopics = document.getElementById('tabTopics');
    const tabRelay = document.getElementById('tabRelay');
    const viewHome = document.getElementById('viewHome');
    const viewTopics = document.getElementById('viewTopics');
    const viewRelay = document.getElementById('viewRelay');

    if (!tabTopics || !tabRelay || !viewTopics || !viewRelay) return;

    function activateTab(target) {
        const isHome = target === 'home';
        const isTopics = target === 'topics';
        const isRelay = target === 'relay';

        if (tabHome && viewHome) {
            tabHome.classList.toggle('active', isHome);
            tabHome.setAttribute('aria-selected', isHome ? 'true' : 'false');
            viewHome.classList.toggle('hidden', !isHome);
        }
        tabTopics.classList.toggle('active', isTopics);
        tabTopics.setAttribute('aria-selected', isTopics ? 'true' : 'false');
        viewTopics.classList.toggle('hidden', !isTopics);

        tabRelay.classList.toggle('active', isRelay);
        tabRelay.setAttribute('aria-selected', isRelay ? 'true' : 'false');
        viewRelay.classList.toggle('hidden', !isRelay);

        // タブ切り替えに応じてモデル選択肢（リレー小説は軽量モデル限定）をフィルタ
        // ホームでは共通設定のみ（個別設定は非表示）
        filterModels(target);
    }

    function handleHash() {
        const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
        if (hash === 'relay') {
            activateTab('relay');
        } else if (hash === 'topics') {
            activateTab('topics');
        } else if (hash === 'home' || hash === '') {
            activateTab('home');
        } else {
            activateTab('topics');
        }
    }

    if (tabHome) {
        tabHome.addEventListener('click', () => {
            window.location.hash = 'home';
        });
    }
    tabTopics.addEventListener('click', () => {
        window.location.hash = 'topics';
    });

    tabRelay.addEventListener('click', () => {
        window.location.hash = 'relay';
    });

    // ホームカードからの遷移
    const homeCardTopics = document.getElementById('homeCardTopics');
    const homeCardRelay = document.getElementById('homeCardRelay');
    if (homeCardTopics) {
        homeCardTopics.addEventListener('click', () => {
            window.location.hash = 'topics';
        });
    }
    if (homeCardRelay) {
        homeCardRelay.addEventListener('click', () => {
            window.location.hash = 'relay';
        });
    }

    window.addEventListener('hashchange', handleHash);

    // 初期化
    handleHash();
}
