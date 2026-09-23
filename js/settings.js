/* ============================================================
   設定パネル & モデル選択モジュール
   ============================================================ */

import { getAppVersion } from './version.js';

let currentIsRelay = false;
let globalSelectCustomOption = null;

// タブ切り替え時にモデル選択の表示を切り替える
// target: 'home' | 'topics' | 'relay' または旧来の boolean (true=relay, false=topics)
export function filterModels(target) {
    let isRelay = false;
    let isHome = false;
    if (typeof target === 'string') {
        isRelay = target === 'relay';
        isHome = target === 'home';
    } else {
        isRelay = !!target;
        isHome = false;
    }
    currentIsRelay = isRelay;
    const modelSelect = document.getElementById('modelSelect');
    const customSelectDropdown = document.getElementById('customSelectDropdown');
    if (!modelSelect || !customSelectDropdown) return;

    const optgroups = modelSelect.querySelectorAll('optgroup');
    const customGroups = customSelectDropdown.querySelectorAll('.custom-select-group');

    let currentSelectedIsHidden = false;

    // 1. 各カスタムオプションの表示・非表示
    const customOptions = customSelectDropdown.querySelectorAll('.custom-select-option');
    customOptions.forEach(opt => {
        const isLightweight = opt.getAttribute('data-lightweight') === 'true';
        const shouldHide = isRelay && !isLightweight;
        opt.classList.toggle('hidden', shouldHide);
        if (shouldHide && opt.classList.contains('is-selected')) {
            currentSelectedIsHidden = true;
        }
    });

    // 2. カスタムグループの見出し表示・非表示（全要素がhiddenなら見出しも隠す）
    customGroups.forEach(group => {
        const visibleOptions = group.querySelectorAll('.custom-select-option:not(.hidden)');
        group.classList.toggle('hidden', visibleOptions.length === 0);
    });

    // 3. 個別設定エリアの切り替え（拡張性重視: 将来 feature-settings が増えても対応可能）
    // 全ての feature-settings を一旦非表示にし、ターゲットに対応するものだけを表示する
    const featureSettingsEls = document.querySelectorAll('.feature-settings');
    featureSettingsEls.forEach(el => el.classList.add('hidden'));
    if (!isHome) {
        if (typeof target === 'string') {
            // ターゲット名から期待されるIDを推測（例: 'topics' -> 'settingsTopics', 'relay' -> 'settingsRelay'）
            const expectedId = `settings${target.charAt(0).toUpperCase()}${target.slice(1)}`;
            const expectedEl = document.getElementById(expectedId);
            if (expectedEl) {
                expectedEl.classList.remove('hidden');
            } else {
                // 命名規則に合わない場合のフォールバック
                const settingsTopics = document.getElementById('settingsTopics');
                const settingsRelay = document.getElementById('settingsRelay');
                if (target === 'topics' && settingsTopics) settingsTopics.classList.remove('hidden');
                else if (target === 'relay' && settingsRelay) settingsRelay.classList.remove('hidden');
            }
        } else {
            // 旧来の boolean 呼び出し互換
            const settingsTopics = document.getElementById('settingsTopics');
            const settingsRelay = document.getElementById('settingsRelay');
            if (isRelay && settingsRelay) settingsRelay.classList.remove('hidden');
            else if (!isRelay && settingsTopics) settingsTopics.classList.remove('hidden');
        }
    }

    // 3b. 区切り線の表示制御: 個別設定が1つも表示されていない場合は区切り線も非表示
    const settingsPanelEl = document.getElementById('settingsPanel');
    const dividerEl = settingsPanelEl ? settingsPanelEl.querySelector('.settings-divider') : null;
    if (dividerEl) {
        const anyFeatureVisible = document.querySelectorAll('.feature-settings:not(.hidden)').length > 0;
        dividerEl.classList.toggle('hidden', !anyFeatureVisible);
    }

    // 4. ネイティブ <select> の option/optgroup も同期
    Array.from(modelSelect.options).forEach(opt => {
        const isLightweight = opt.getAttribute('data-lightweight') === 'true';
        const shouldHide = isRelay && !isLightweight;
        opt.hidden = shouldHide;
        opt.disabled = shouldHide;
    });

    optgroups.forEach(group => {
        const visibleOpts = group.querySelectorAll('option:not([hidden])');
        group.hidden = visibleOpts.length === 0;
    });

    // 5. 現在選択中のモデルが非表示になった場合、表示中の最初の有効な軽量モデルに切り替える
    if (isRelay && currentSelectedIsHidden) {
        const firstValidCustom = customSelectDropdown.querySelector('.custom-select-option:not(.hidden)');
        if (firstValidCustom && globalSelectCustomOption) {
            const val = firstValidCustom.getAttribute('data-value');
            const text = firstValidCustom.querySelector('span')?.textContent || '';
            globalSelectCustomOption(val, text);
        }
    } else if (!isRelay) {
        // お題生成に戻った際、保存済みのモデルがあれば復元
        const saved = localStorage.getItem('selected_model');
        const targetOpt = Array.from(modelSelect.options).find(o => o.value === saved);
        if (targetOpt && globalSelectCustomOption) {
            globalSelectCustomOption(saved, targetOpt.textContent);
        }
    }
}

export function initSettings() {
    const modelSelect = document.getElementById('modelSelect');
    const customSelectWrapper = document.getElementById('customSelectWrapper');
    const customSelectTrigger = document.getElementById('customSelectTrigger');
    const customSelectValue = document.getElementById('customSelectValue');
    const customSelectDropdown = document.getElementById('customSelectDropdown');

    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsClose = document.getElementById('settingsClose');

    const customWordMode = document.getElementById('customWordMode');
    const customWordInput = document.getElementById('customWordInput');
    const appVersionDisplay = document.getElementById('appVersionDisplay');

    if (!modelSelect || !settingsPanel) return;

    // バージョン情報の取得と表示
    if (appVersionDisplay) {
        getAppVersion().then(version => {
            appVersionDisplay.textContent = `Ver ${version}`;
        });
    }

    /* --- カスタムセレクト操作 --- */
    function openCustomSelect() {
        if (!customSelectWrapper) return;
        const rect = customSelectTrigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 250 && rect.top > spaceBelow) {
            customSelectWrapper.classList.add('open-upward');
        } else {
            customSelectWrapper.classList.remove('open-upward');
        }

        customSelectWrapper.classList.add('is-open');
        customSelectTrigger.setAttribute('aria-expanded', 'true');

        const selectedOption = customSelectDropdown.querySelector('.custom-select-option.is-selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }

    function closeCustomSelect() {
        if (!customSelectWrapper) return;
        customSelectWrapper.classList.remove('is-open');
        customSelectTrigger.setAttribute('aria-expanded', 'false');
    }

    function toggleCustomSelect() {
        if (customSelectWrapper.classList.contains('is-open')) {
            closeCustomSelect();
        } else {
            openCustomSelect();
        }
    }

    function selectCustomOption(val, text) {
        modelSelect.value = val;
        modelSelect.dispatchEvent(new Event('change'));
        if (customSelectValue) {
            customSelectValue.textContent = text;
        }
        const options = customSelectDropdown.querySelectorAll('.custom-select-option');
        options.forEach(opt => {
            const isSelected = opt.getAttribute('data-value') === val;
            opt.classList.toggle('is-selected', isSelected);
            opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        closeCustomSelect();
    }

    globalSelectCustomOption = selectCustomOption;

    if (customSelectTrigger) {
        customSelectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCustomSelect();
        });

        customSelectTrigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                openCustomSelect();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && customSelectWrapper && customSelectWrapper.classList.contains('is-open')) {
            closeCustomSelect();
            customSelectTrigger.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (customSelectWrapper && !customSelectWrapper.contains(e.target)) {
            closeCustomSelect();
        }
    });

    if (customWordMode && customWordInput) {
        customWordMode.addEventListener('change', () => {
            customWordInput.disabled = !customWordMode.checked;
            if (customWordMode.checked) {
                customWordInput.focus();
            }
        });
    }

    /* --- モデル一覧読み込み (models.json) --- */
    async function loadModels() {
        try {
            const response = await fetch('./models.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const groups = await response.json();

            modelSelect.innerHTML = '';
            if (customSelectDropdown) customSelectDropdown.innerHTML = '';

            let hasSelected = false;
            let selectedName = '';

            groups.forEach((group) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = group.group;

                const customGroup = document.createElement('div');
                customGroup.className = 'custom-select-group';
                const groupTitle = document.createElement('div');
                groupTitle.className = 'custom-select-group-title';
                groupTitle.textContent = group.group;
                customGroup.appendChild(groupTitle);

                group.models.forEach((model) => {
                    const isDefault = (model.default && !hasSelected);
                    const displayName = model.name; // 「（軽量）」などの装飾は付与しない
                    const isLightweight = !!model.lightweight;

                    // ネイティブ <select> option
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = displayName;
                    option.setAttribute('data-lightweight', isLightweight ? 'true' : 'false');
                    if (isDefault) {
                        option.selected = true;
                        hasSelected = true;
                        selectedName = displayName;
                    }
                    optgroup.appendChild(option);

                    // カスタム option
                    const customOption = document.createElement('div');
                    customOption.className = `custom-select-option${isDefault ? ' is-selected' : ''}`;
                    customOption.setAttribute('role', 'option');
                    customOption.setAttribute('data-value', model.id);
                    customOption.setAttribute('data-lightweight', isLightweight ? 'true' : 'false');
                    customOption.setAttribute('aria-selected', isDefault ? 'true' : 'false');
                    customOption.setAttribute('tabindex', '0');
                    customOption.innerHTML = `
                        <span>${displayName}</span>
                        <svg class="custom-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;

                    customOption.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectCustomOption(model.id, displayName);
                        customSelectTrigger.focus();
                    });

                    customOption.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCustomOption(model.id, displayName);
                            customSelectTrigger.focus();
                        }
                    });

                    customGroup.appendChild(customOption);
                });

                modelSelect.appendChild(optgroup);
                if (customSelectDropdown) customSelectDropdown.appendChild(customGroup);
            });

            if (customSelectValue && selectedName) {
                customSelectValue.textContent = selectedName;
            }

            // 保存済みモデルがあれば復元
            const savedModel = localStorage.getItem('selected_model');
            if (savedModel && Array.from(modelSelect.options).some(o => o.value === savedModel)) {
                const targetOpt = Array.from(modelSelect.options).find(o => o.value === savedModel);
                if (targetOpt) {
                    selectCustomOption(savedModel, targetOpt.textContent);
                }
            }

            modelSelect.addEventListener('change', () => {
                // 通常のお題生成での選択を記録
                if (!currentIsRelay) {
                    localStorage.setItem('selected_model', modelSelect.value);
                }
            });

            // 現在のURLハッシュに応じた初期フィルタリング
            const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
            let initialTarget = 'home';
            if (rawHash === 'relay') initialTarget = 'relay';
            else if (rawHash === 'topics') initialTarget = 'topics';
            else if (rawHash === 'home' || rawHash === '') initialTarget = 'home';
            else initialTarget = 'topics';
            filterModels(initialTarget);

        } catch (error) {
            console.error('モデル一覧の取得に失敗しました:', error);
            if (customSelectValue) {
                customSelectValue.textContent = 'モデル取得失敗';
            }
        }
    }

    /* --- 設定パネルの開閉 & スワイプ --- */
    function openPanel() {
        settingsPanel.classList.add('is-open');
        settingsPanel.setAttribute('aria-hidden', 'false');
        settingsToggle.classList.add('is-hidden');
    }

    function closePanel() {
        closeCustomSelect();
        settingsPanel.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
        settingsToggle.classList.remove('is-hidden');
    }

    if (settingsToggle) {
        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            openPanel();
        });
    }

    if (settingsClose) {
        settingsClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closePanel();
        });
    }

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
            if (settingsPanel.classList.contains('is-open')) {
                closePanel();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsPanel.classList.contains('is-open')) {
            closePanel();
            settingsToggle.focus();
        }
    });

    // スワイプジェスチャー
    const THRESHOLD_X = 60;
    const MIN_VELOCITY_X = 0.25;
    const Y_RATIO_MAX = 0.6;
    const MAX_DURATION = 1000;
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) {
            tracking = false;
            return;
        }
        const touch = e.touches[0];
        tracking = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startT = e.timeStamp;
    }, { passive: true });

    document.addEventListener('touchmove', () => { }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const changed = e.changedTouches[0];
        if (!changed) return;

        const dx = changed.clientX - startX;
        const dy = changed.clientY - startY;
        const dt = e.timeStamp - startT;
        if (dt > MAX_DURATION) return;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < THRESHOLD_X) return;
        if (absDx > 0 && absDy / absDx > Y_RATIO_MAX) return;

        const velocity = absDx / Math.max(dt, 1);
        if (velocity < MIN_VELOCITY_X) return;

        const isOpen = settingsPanel.classList.contains('is-open');
        if (!isOpen && dx < 0) {
            openPanel();
        } else if (isOpen && dx > 0) {
            closePanel();
        }
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
        tracking = false;
    }, { passive: true });

    // 初期読み込み実行
    loadModels();
}
