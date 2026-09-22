/* ============================================================
   直前リレー小説 (Relay Story) モジュール
   ============================================================ */

import { showError, clearError } from './errorDisplay.js';

export function initRelay() {
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
    const modelSelect = document.getElementById('modelSelect');

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
        if (turn >= 10) return '最終回（完結）';
        if (turn === 9) return '結末直前（布石）';
        if (turn >= 7) return '終盤（締め）';
        if (turn >= 5) return '中盤（大展開）';
        return '序盤（展開）';
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
                    state.isLoading = false;
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
        clearError(errorDisplay);
        render();
    }

    // 画面レンダリング
    // ※ エラーメッセージのクリアは呼び出し側（各操作の開始時点）で行う。
    //    ここで一律クリアすると、エラー発生後に呼ばれるrender()で
    //    表示直後のエラーメッセージが消えてしまうため行わない。
    function render() {
        // 完結している場合
        if (state.isFinished) {
            setupView.classList.add('hidden');
            storyView.classList.add('hidden');
            finishView.classList.remove('hidden');
            renderFullStory();
            return;
        }

        // 進行中の場合
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
            } else if (state.turn === 9) {
                storyInput.placeholder = '第9ターン（人間の最終ターン）です。結末に向けた最後の布石を書いてください...';
            } else if (state.turn === 7) {
                storyInput.placeholder = '第7ターンです。終盤に向けて事態を締めくくりへ導く展開を書いてください...';
            } else if (state.turn === 5) {
                storyInput.placeholder = '第5ターンです。中盤の山場に向けて物語を動かす展開を書いてください...';
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
            showError(errorDisplay, '物語の続きを入力してください。');
            storyInput.focus();
            return;
        }

        clearError(errorDisplay);
        state.isLoading = true;

        state.history.push({
            role: 'user',
            content: text,
            turn: state.turn
        });

        state.turn += 1;

        storyInput.value = '';
        inputCount.textContent = '0 / 500';
        saveState();
        render();

        const selectedModel = (modelSelect && modelSelect.value) ? modelSelect.value : 'gemini-3.5-flash-lite';

        // サーバー側のタイムアウト（25秒・リトライ込みで最大27秒程度）より
        // 少し長めに取り、サーバーからの分かりやすいエラーメッセージを
        // 優先しつつ、通信自体が固まった場合の保険として機能させる。
        const RELAY_TIMEOUT_MS = 30000;
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, RELAY_TIMEOUT_MS);

        try {
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
                }),
                signal: abortController.signal
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AIの応答取得に失敗しました。');
            }

            const aiText = String(data.text || '').trim();
            if (!aiText) {
                throw new Error('AIから有効なテキストが返却されませんでした。');
            }

            state.history.push({
                role: 'model',
                content: aiText,
                turn: state.turn
            });

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
            state.isLoading = false;
            const lastEntry = state.history.pop();
            if (lastEntry && lastEntry.role === 'user') {
                storyInput.value = lastEntry.content;
                inputCount.textContent = `${lastEntry.content.length} / 500`;
                state.turn -= 1;
            }
            saveState();
            render();
            showError(errorDisplay, error, {
                timeoutMessage: 'AIの応答がタイムアウトしました。混雑している可能性があるため、再度試すか別のモデルをお試しください。'
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // イベントリスナー設定
    settingInput.addEventListener('input', () => {
        settingCount.textContent = `${settingInput.value.length} / 100`;
    });

    startBtn.addEventListener('click', () => {
        state.setting = settingInput.value.trim().slice(0, 100);
        state.turn = 1;
        state.history = [];
        state.isFinished = false;
        state.isLoading = false;
        saveState();
        render();
    });

    storyInput.addEventListener('input', () => {
        inputCount.textContent = `${storyInput.value.length} / 500`;
    });

    storyInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            submitUserTurn();
        }
    });

    submitBtn.addEventListener('click', submitUserTurn);

    resetBtn.addEventListener('click', () => {
        if (confirm('現在の物語を中断して、最初からやり直しますか？\n（これまでの内容は消去されます）')) {
            resetStory();
        }
    });

    restartBtn.addEventListener('click', () => {
        resetStory();
    });

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

    // 初期化
    loadState();
    render();
}
