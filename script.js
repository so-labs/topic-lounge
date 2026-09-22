/* ============================================================
   テーマ設定
   - data-theme 属性で light/dark/system を切り替え
   - system時は prefers-color-scheme に追従
   ============================================================ */
(() => {
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const metaThemeColor = document.getElementById('theme-color-meta');

    // モバイルブラウザのUI色(meta theme-color)を明暗テーマに合わせて更新
    function updateThemeColor(isDark) {
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', isDark ? '#2C3E50' : '#F0F2F5');
        }
    }

    // 指定されたテーマを <html> の data-theme 属性へ反映する
    function applyTheme(theme) {
        let isDark = false;
        if (theme === 'system') {
            document.documentElement.removeAttribute('data-theme');
            isDark = prefersDarkScheme.matches;
        } else {
            document.documentElement.setAttribute('data-theme', theme);
            isDark = theme === 'dark';
        }
        updateThemeColor(isDark);
    }

    // 保存済みテーマを復元(未保存なら system)
    const savedTheme = localStorage.getItem('theme') || 'system';
    const selectedRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (selectedRadio) {
        selectedRadio.checked = true;
    }
    applyTheme(savedTheme);

    // ラジオボタンの変更時に選択を保存して即反映
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('theme', theme);
            applyTheme(theme);
        });
    });

    // OSの表示モード変更に追従(system 選択時のみ再適用)
    prefersDarkScheme.addEventListener('change', () => {
        const currentTheme = localStorage.getItem('theme') || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });
})();

/* ============================================================
   DOM参照(複数ブロックで共有するためモジュールトップレベルに置く)
   ============================================================ */
// 生成UI
const generateButton = document.getElementById('generateButton');
const ideaDisplay = document.getElementById('ideaDisplay');
const errorDisplay = document.getElementById('errorDisplay');
const modelSelect = document.getElementById('modelSelect');
const choiceOnly = document.getElementById('choiceOnly');
const customWordMode = document.getElementById('customWordMode');
const customWordInput = document.getElementById('customWordInput');
const loadingModal = document.getElementById('loadingModal');

// カスタムセレクト
const customSelectWrapper = document.getElementById('customSelectWrapper');
const customSelectTrigger = document.getElementById('customSelectTrigger');
const customSelectValue = document.getElementById('customSelectValue');
const customSelectDropdown = document.getElementById('customSelectDropdown');

// 設定パネル
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const settingsClose = document.getElementById('settingsClose');

/* ============================================================
   カスタムセレクト(open/close/toggle は設定パネルからも呼ばれる)
   ============================================================ */
// ドロップダウンを開く(下の空きが足りなければ上向きに開く)
function openCustomSelect() {
    if (!customSelectWrapper) return;

    // 画面下端との距離をチェックし、狭ければ上向きに開く
    const rect = customSelectTrigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 250 && rect.top > spaceBelow) {
        customSelectWrapper.classList.add('open-upward');
    } else {
        customSelectWrapper.classList.remove('open-upward');
    }

    customSelectWrapper.classList.add('is-open');
    customSelectTrigger.setAttribute('aria-expanded', 'true');

    // 選択中アイテムを視認できる位置へスクロール
    const selectedOption = customSelectDropdown.querySelector('.custom-select-option.is-selected');
    if (selectedOption) {
        selectedOption.scrollIntoView({ block: 'nearest' });
    }
}

// ドロップダウンを閉じる
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

// オプション選択をネイティブ <select> に反映し、カスタムUIの表示を同期する
function selectCustomOption(val, text) {
    modelSelect.value = val;
    modelSelect.dispatchEvent(new Event('change'));
    if (customSelectValue) {
        customSelectValue.textContent = text;
    }
    // 選択状態(is-selected / aria-selected)を全オプションへ反映
    const options = customSelectDropdown.querySelectorAll('.custom-select-option');
    options.forEach(opt => {
        const isSelected = opt.getAttribute('data-value') === val;
        opt.classList.toggle('is-selected', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    closeCustomSelect();
}

// カスタムセレクトとワード指定UIのイベント登録
(() => {
    // ワード指定の有効/無効切り替え
    if (customWordMode) {
        customWordMode.addEventListener('change', () => {
            customWordInput.disabled = !customWordMode.checked;
            if (customWordMode.checked) {
                customWordInput.focus();
            }
        });
    }

    if (customSelectTrigger) {
        customSelectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCustomSelect();
        });

        // Enter/Space/矢印キーでも開けるように(キーボード操作対応)
        customSelectTrigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                openCustomSelect();
            }
        });
    }

    // Escapeキーでドロップダウンを閉じる
    // Escapeキーでドロップダウンを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && customSelectWrapper && customSelectWrapper.classList.contains('is-open')) {
            closeCustomSelect();
            customSelectTrigger.focus();
        }
    });

    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', (e) => {
        if (customSelectWrapper && !customSelectWrapper.contains(e.target)) {
            closeCustomSelect();
        }
    });
})();

/* ============================================================
   モデル一覧の読み込みとセレクトボックス生成
   ============================================================ */
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

        // ネイティブ <select> とカスタムドロップダウンの両方を再構築
        groups.forEach((group) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.group;

            // カスタムドロップダウン用グループ
            const customGroup = document.createElement('div');
            customGroup.className = 'custom-select-group';
            const groupTitle = document.createElement('div');
            groupTitle.className = 'custom-select-group-title';
            groupTitle.textContent = group.group;
            customGroup.appendChild(groupTitle);

            // default フラグの付いたモデル(最初の1つ)を選択状態にする
            group.models.forEach((model) => {
                // ネイティブoption（内部連携・フォールバック用）
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;

                const isDefault = (model.default && !hasSelected);
                if (isDefault) {
                    option.selected = true;
                    hasSelected = true;
                    selectedName = model.name;
                }
                optgroup.appendChild(option);

                // カスタムoption
                const customOption = document.createElement('div');
                customOption.className = `custom-select-option${isDefault ? ' is-selected' : ''}`;
                customOption.setAttribute('role', 'option');
                customOption.setAttribute('data-value', model.id);
                customOption.setAttribute('aria-selected', isDefault ? 'true' : 'false');
                customOption.setAttribute('tabindex', '0');
                customOption.innerHTML = `
                    <span>${model.name}</span>
                    <svg class="custom-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;

                customOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectCustomOption(model.id, model.name);
                    customSelectTrigger.focus();
                });

                customOption.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectCustomOption(model.id, model.name);
                        customSelectTrigger.focus();
                    }
                });

                customGroup.appendChild(customOption);
            });

            modelSelect.appendChild(optgroup);
            if (customSelectDropdown) customSelectDropdown.appendChild(customGroup);
        });

        // default 指定が無かった場合は先頭モデルを選択
        if (!hasSelected && modelSelect.options.length > 0) {
            modelSelect.options[0].selected = true;
            selectedName = modelSelect.options[0].textContent;
            const firstCustom = customSelectDropdown.querySelector('.custom-select-option');
            if (firstCustom) {
                firstCustom.classList.add('is-selected');
                firstCustom.setAttribute('aria-selected', 'true');
            }
        }

        if (customSelectValue && selectedName) {
            customSelectValue.textContent = selectedName;
        }
    } catch (error) {
        console.error('モデル一覧の取得に失敗しました:', error);
        modelSelect.innerHTML = '<option value="">モデルの取得に失敗しました</option>';
        if (customSelectValue) customSelectValue.textContent = 'モデルの取得に失敗しました';
        if (customSelectDropdown) {
            customSelectDropdown.innerHTML = '<div style="padding: 10px; color: var(--text-color); font-size: 0.9em; text-align: center;">モデルの取得に失敗しました</div>';
        }
    }
}

// モデル一覧を読み込んで初期化
loadModels();

/* ============================================================
   生成ボタン
   ============================================================ */
generateButton.addEventListener('click', async () => {
    errorDisplay.textContent = '';
    generateButton.disabled = true;

    // 選択されたモデル名を取得
    const selectedModel = modelSelect.value;
    if (!selectedModel) {
        errorDisplay.textContent = 'モデルを選択してください。';
        generateButton.disabled = false;
        return;
    }
    // モードとワード指定からリクエストパラメータを組み立てる
    let mode = choiceOnly && choiceOnly.checked ? 'choice_only' : 'default';
    let word = '';

    if (customWordMode && customWordMode.checked) {
        // ワードは最大10文字に切り詰める
        word = (customWordInput.value || '').trim().slice(0, 10);
        if (!word) {
            errorDisplay.textContent = 'ワードを入力してください（単語・最大10文字）';
            generateButton.disabled = false;
            return;
        }
        mode = 'custom_word';
        if (choiceOnly && choiceOnly.checked) {
            mode = 'custom_word_choice';
        }
    }

    // ローディング表示と20秒タイムアウト(AbortControllerで中断)
    loadingModal.classList.remove('hidden');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
        abortController.abort();
    }, 20000); // 20秒タイムアウト

    try {
        // APIへ生成リクエストを送信
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: selectedModel, mode, word }),
            signal: abortController.signal,
        });

        // 応答はJSONとは限らないためパース失敗を許容する
        let data = {};
        try {
            data = await response.json();
        } catch {
            if (!response.ok) {
                throw new Error(`通信エラーが発生しました (HTTP ${response.status})`);
            }
        }

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        // 結果の表示(選択肢があればボタン形式で表示)
        if (data.idea) {
            if (data.choices && Array.isArray(data.choices) && data.choices.length >= 2) {
                ideaDisplay.innerHTML = `${data.idea}<br><br>` + data.choices.map((c, i) => `<button class="choice-btn">${i + 1}. ${c}</button>`).join('');
            } else {
                ideaDisplay.textContent = data.idea;
            }
        } else {
            ideaDisplay.textContent = '';
            errorDisplay.textContent = '生成に失敗しました。';
        }
    } catch (error) {
        console.error('クライアントサイドでのエラー:', error);
        ideaDisplay.textContent = '';
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            errorDisplay.textContent = '生成処理がタイムアウトしました（20秒）。混雑している可能性があるため、再度試すか別のモデルをお試しください。';
        } else {
            errorDisplay.textContent = error.message || '通信エラーが発生しました。';
        }
    } finally {
        // 成功・失敗に関わらずボタンとローディング表示を元に戻す
        clearTimeout(timeoutId);
        generateButton.disabled = false;
        loadingModal.classList.add('hidden');
    }
});

/* ============================================================
   Service Worker 登録
   ============================================================ */
(() => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
        });
    }
})();

/* ============================================================
   設定パネル(open/close はスワイプからも呼ばれる)
   ============================================================ */
/* ============================================================
   設定パネル(open/close はスワイプからも呼ばれる)
   ============================================================ */
// 設定パネルとFABを開いた状態にする
function openPanel() {
    settingsPanel.classList.add('is-open');
    settingsToggle.classList.add('is-open');
    settingsPanel.setAttribute('aria-hidden', 'false');
}

// 設定パネルを閉じる(開いているカスタムセレクトも一緒に閉じる)
function closePanel() {
    closeCustomSelect();
    settingsPanel.classList.remove('is-open');
    settingsToggle.classList.remove('is-open');
    settingsPanel.setAttribute('aria-hidden', 'true');
}

// 設定パネルの開閉イベント登録
(() => {
    if (!settingsToggle || !settingsPanel) return;

    // FABクリックでトグル
    settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.contains('is-open') ? closePanel() : openPanel();
    });

    if (settingsClose) {
        settingsClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closePanel();
        });
    }

    // パネル外クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
            closePanel();
        }
    });
})();

/* ============================================================
   スワイプで設定パネルの開閉
   - 閉じている状態で左スワイプ → 開く
   - 開いている状態で右スワイプ → 閉じる
   縦スクロールと誤認識しないよう、移動量・速度・方向の
   各しきい値でスワイプを判定する
   ============================================================ */
(() => {
    if (!settingsPanel || !settingsToggle) return;

    const THRESHOLD_X = 60;            // 横方向の最小移動量(px)
    const MIN_VELOCITY_X = 0.25;       // 横方向の最小速度(px/ms)
    const Y_RATIO_MAX = 0.6;           // |Δy| / |Δx| の上限。これを超えると縦成分優勢とみなして不発
    const MAX_DURATION = 1000;         // 長すぎるスワイプは意図的操作ではないとみなして不発

    // タッチ追跡用の状態
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    // タッチ開始: 単一タッチのみ追跡対象とする
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

    document.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        // 縦スクロールを妨げないよう、ここでは何もしない(判定はtouchendで行う)
    }, { passive: true });

    // タッチ終了: 蓄積した座標からスワイプ判定を行う
    document.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;

        const changed = e.changedTouches[0];
        if (!changed) return;

        const dx = changed.clientX - startX; // 左スワイプは負、右スワイプは正
        const dy = changed.clientY - startY;
        const dt = e.timeStamp - startT;

        if (dt > MAX_DURATION) return;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // 横移動量が閾値未満なら不発
        if (absDx < THRESHOLD_X) return;

        // 縦成分が横成分に対して大きすぎる場合は縦スクロールとみなして不発
        if (absDx > 0 && absDy / absDx > Y_RATIO_MAX) return;

        const velocity = absDx / Math.max(dt, 1);
        if (velocity < MIN_VELOCITY_X) return;

        const isOpen = settingsPanel.classList.contains('is-open');

        // パネルが閉じている → 左スワイプで開く
        if (!isOpen && dx < 0) {
            openPanel();
            return;
        }

        // パネルが開いている → 右スワイプで閉じる
        if (isOpen && dx > 0) {
            closePanel();
            return;
        }
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
        tracking = false;
    }, { passive: true });
})();

/* ============================================================
   タブ切り替えロジック (URLハッシュ連動)
   ============================================================ */
(() => {
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
})();

/* ============================================================
   直前リレー小説 (Relay Story) フロントエンドロジック
   ============================================================ */
(() => {
    const STORAGE_KEY = 'relay_story_state';

    // DOM要素
    const setupView = document.getElementById('relaySetupView');
    const storyView = document.getElementById('relayStoryView');
    const finishView = document.getElementById('relayFinishView');

    const settingInput = document.getElementById('relaySettingInput');
    const settingCount = document.getElementById('relaySettingCount');
    const startBtn = document.getElementById('relayStartBtn');

    const currentTurnEl = document.getElementById('relayCurrentTurn');
    const turnPhaseEl = document.getElementById('relayTurnPhase');
    const progressFill = document.getElementById('relayProgressFill');
    const resetBtn = document.getElementById('relayResetBtn');
    const activeSettingEl = document.getElementById('relayActiveSetting');
    const activeSettingText = document.getElementById('relayActiveSettingText');

    const storyLogs = document.getElementById('relayStoryLogs');
    const loadingIndicator = document.getElementById('relayLoadingIndicator');
    const errorDisplay = document.getElementById('relayErrorDisplay');

    const storyInput = document.getElementById('relayStoryInput');
    const inputCount = document.getElementById('relayInputCount');
    const submitBtn = document.getElementById('relaySubmitBtn');

    const fullStoryEl = document.getElementById('relayFullStory');
    const copyBtn = document.getElementById('relayCopyBtn');
    const restartBtn = document.getElementById('relayRestartBtn');

    if (!setupView || !storyView || !finishView) return;

    // 内部状態
    let state = {
        setting: '',
        turn: 1,
        history: [], // { role: 'user' | 'model', content: string, turn: number }
        isFinished: false,
        isLoading: false
    };

    // HTMLエスケープユーティリティ
    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ターンごとのフェーズ名
    function getPhaseName(turn) {
        if (turn >= 10) return '最終回（結末）';
        if (turn === 9) return '結末直前（クライマックス）';
        if (turn >= 7) return '終盤';
        return '序盤・展開';
    }

    // 状態をLocalStorageに保存
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('LocalStorageへの保存に失敗しました:', e);
        }
    }

    // 状態をLocalStorageから復元
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.turn === 'number') {
                    state = Object.assign(state, parsed);
                    state.isLoading = false; // ロード時はローディング解除
                    return true;
                }
            }
        } catch (e) {
            console.warn('LocalStorageからの復元に失敗しました:', e);
        }
        return false;
    }

    // 全状態リセット
    function resetStory() {
        state = {
            setting: '',
            turn: 1,
            history: [],
            isFinished: false,
            isLoading: false
        };
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { }

        settingInput.value = '';
        settingCount.textContent = '0 / 100';
        storyInput.value = '';
        inputCount.textContent = '0 / 500';
        errorDisplay.textContent = '';
        render();
    }

    // 画面レンダリング
    function render() {
        errorDisplay.textContent = '';

        // 完結している場合
        if (state.isFinished) {
            setupView.classList.add('hidden');
            storyView.classList.add('hidden');
            finishView.classList.remove('hidden');
            renderFullStory();
            return;
        }

        // 進行中の場合（ターン進行中または履歴あり）
        if (state.history.length > 0 || state.setting || state.turn > 1) {
            setupView.classList.add('hidden');
            storyView.classList.remove('hidden');
            finishView.classList.add('hidden');

            // ヘッダー情報
            currentTurnEl.textContent = state.turn;
            turnPhaseEl.textContent = getPhaseName(state.turn);
            const progressPercent = Math.min(100, Math.max(10, state.turn * 10));
            progressFill.style.width = `${progressPercent}%`;

            // 設定バッジ
            if (state.setting) {
                activeSettingEl.classList.remove('hidden');
                activeSettingText.textContent = state.setting;
            } else {
                activeSettingEl.classList.add('hidden');
            }

            // ログの描画
            renderLogs();

            // 執筆中表示
            loadingIndicator.classList.toggle('hidden', !state.isLoading);
            storyInput.disabled = state.isLoading;
            submitBtn.disabled = state.isLoading;

            // プレースホルダーの更新
            if (state.turn === 1 && state.history.length === 0) {
                storyInput.placeholder = '物語の冒頭を書いてください（例: その街では、誰もが雨を忘れていた。）...';
            } else if (state.turn >= 10) {
                storyInput.placeholder = '最終ターンです。物語を締めくくる結末へ導いてください...';
            } else {
                storyInput.placeholder = `第${state.turn}ターンの続きを書いてください...`;
            }

            if (!state.isLoading) {
                storyInput.focus();
            }
            return;
        }

        // 初期設定画面
        setupView.classList.remove('hidden');
        storyView.classList.add('hidden');
        finishView.classList.add('hidden');
    }

    // ログエリアのレンダリング
    function renderLogs() {
        const totalItems = state.history.length;
        // 直前3エピソードのみコンテキスト対象
        const contextStartIndex = Math.max(0, totalItems - 3);

        storyLogs.innerHTML = state.history.map((item, index) => {
            const isUser = item.role === 'user';
            const inContext = index >= contextStartIndex;
            const roleLabel = isUser ? 'あなた' : 'AI';
            const contextBadge = inContext ? '<span class="relay-context-badge">💡 AI記憶中</span>' : '';

            return `
                <div class="relay-log-item ${isUser ? 'user' : 'ai'} ${inContext ? 'in-context' : ''}">
                    <div class="relay-log-meta">
                        <span>【第${item.turn}ターン】${roleLabel}</span>
                        ${contextBadge}
                    </div>
                    <div class="relay-log-text">${escapeHtml(item.content)}</div>
                </div>
            `;
        }).join('');

        // 最下部へスクロール
        setTimeout(() => {
            storyLogs.scrollTop = storyLogs.scrollHeight;
        }, 50);
    }

    // 完結画面の全文レンダリング
    function renderFullStory() {
        const storyParts = [];
        if (state.setting) {
            storyParts.push(`【世界観・設定】\n${state.setting}\n`);
        }

        const episodes = state.history.map(item => {
            const speaker = item.role === 'user' ? '人間' : 'AI';
            return `［第${item.turn}ターン - ${speaker}］\n${item.content}`;
        });

        storyParts.push(episodes.join('\n\n'));
        const fullText = storyParts.join('\n');
        fullStoryEl.textContent = fullText;
    }

    // AIへの送信処理
    async function submitUserTurn() {
        if (state.isLoading) return;

        const text = storyInput.value.trim();
        if (!text) {
            errorDisplay.textContent = '物語の続きを入力してください。';
            storyInput.focus();
            return;
        }

        errorDisplay.textContent = '';
        state.isLoading = true;

        // ユーザー入力を履歴に追加
        state.history.push({
            role: 'user',
            content: text,
            turn: state.turn
        });

        storyInput.value = '';
        inputCount.textContent = '0 / 500';
        saveState();
        render();

        // 共通設定パネルで選択されているモデルを取得（なければデフォルト）
        const selectedModel = (modelSelect && modelSelect.value) ? modelSelect.value : 'gemini-2.5-flash';

        try {
            // APIに渡す直近3件の履歴
            const safeHistory = state.history.slice(-3).map(h => ({
                role: h.role,
                content: h.content
            }));

            const response = await fetch('/api/relay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    setting: state.setting,
                    turn: state.turn,
                    history: safeHistory
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AIの応答取得に失敗しました。');
            }

            const aiText = String(data.text || '').trim();
            if (!aiText) {
                throw new Error('AIから有効なテキストが返却されませんでした。');
            }

            // AIの文章を履歴に追加
            state.history.push({
                role: 'model',
                content: aiText,
                turn: state.turn
            });

            // ターン進行判定
            if (state.turn >= 10) {
                state.isFinished = true;
            } else {
                state.turn += 1;
            }

            state.isLoading = false;
            saveState();
            render();

        } catch (error) {
            console.error('[relay] 送信エラー:', error);
            errorDisplay.textContent = error.message || '通信エラーが発生しました。もう一度お試しください。';
            state.isLoading = false;
            // エラー時は直前のユーザー発言を入力欄に復元して履歴から取り除く（再試行可能にする）
            const lastEntry = state.history.pop();
            if (lastEntry && lastEntry.role === 'user') {
                storyInput.value = lastEntry.content;
                inputCount.textContent = `${lastEntry.content.length} / 500`;
            }
            saveState();
            render();
        }
    }

    // イベントリスナー設定
    // 1. 設定文字数カウント
    settingInput.addEventListener('input', () => {
        settingCount.textContent = `${settingInput.value.length} / 100`;
    });

    // 2. 物語開始ボタン
    startBtn.addEventListener('click', () => {
        state.setting = settingInput.value.trim().slice(0, 100);
        state.turn = 1;
        state.history = [];
        state.isFinished = false;
        state.isLoading = false;
        saveState();
        render();
    });

    // 3. 本文文字数カウント
    storyInput.addEventListener('input', () => {
        inputCount.textContent = `${storyInput.value.length} / 500`;
    });

    // 4. Ctrl/Cmd+Enter での送信
    storyInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            submitUserTurn();
        }
    });

    // 5. 送信ボタン
    submitBtn.addEventListener('click', submitUserTurn);

    // 6. リセットボタン
    resetBtn.addEventListener('click', () => {
        if (confirm('現在の物語を中断して、最初からやり直しますか？\n（これまでの内容は消去されます）')) {
            resetStory();
        }
    });

    // 7. 新しい物語を始めるボタン
    restartBtn.addEventListener('click', () => {
        resetStory();
    });

    // 8. 全文コピーボタン
    copyBtn.addEventListener('click', async () => {
        const textToCopy = fullStoryEl.textContent;
        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'コピーしました！';
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.disabled = false;
            }, 2000);
        } catch (e) {
            console.error('コピー失敗:', e);
            alert('コピーに失敗しました。画面のテキストを手動で選択してコピーしてください。');
        }
    });

    // 初期化: 保存された状態があれば復元
    loadState();
    render();
})();