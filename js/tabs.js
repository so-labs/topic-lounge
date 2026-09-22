/* ============================================================
   タブ切り替えモジュール (URLハッシュ連動)
   ============================================================ */

import { filterModels } from './settings.js';

export function initTabs() {
    const tabTopics = document.getElementById('tabTopics');
    const tabRelay = document.getElementById('tabRelay');
    const viewTopics = document.getElementById('viewTopics');
    const viewRelay = document.getElementById('viewRelay');

    if (!tabTopics || !tabRelay || !viewTopics || !viewRelay) return;

    function activateTab(target) {
        const isRelay = target === 'relay';

        tabTopics.classList.toggle('active', !isRelay);
        tabTopics.setAttribute('aria-selected', !isRelay ? 'true' : 'false');
        viewTopics.classList.toggle('hidden', isRelay);

        tabRelay.classList.toggle('active', isRelay);
        tabRelay.setAttribute('aria-selected', isRelay ? 'true' : 'false');
        viewRelay.classList.toggle('hidden', !isRelay);

        // タブ切り替えに応じてモデル選択肢（リレー小説は軽量モデル限定）をフィルタ
        filterModels(isRelay);
    }

    function handleHash() {
        const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
        if (hash === 'relay') {
            activateTab('relay');
        } else {
            activateTab('topics');
        }
    }

    tabTopics.addEventListener('click', () => {
        window.location.hash = 'topics';
    });

    tabRelay.addEventListener('click', () => {
        window.location.hash = 'relay';
    });

    window.addEventListener('hashchange', handleHash);

    // 初期化
    handleHash();
}
