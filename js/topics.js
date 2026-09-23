/* ============================================================
   お題生成 (Topics) モジュール
   ============================================================ */

import { showError, clearError } from './errorDisplay.js';

export function initTopics() {
    const generateButton = document.getElementById('generateButton');
    const ideaDisplay = document.getElementById('ideaDisplay');
    const errorDisplay = document.getElementById('errorDisplay');
    const modelSelect = document.getElementById('modelSelect');
    const choiceOnly = document.getElementById('choiceOnly');
    const customWordMode = document.getElementById('customWordMode');
    const customWordInput = document.getElementById('customWordInput');
    const loadingModal = document.getElementById('loadingModal');

    if (!generateButton || !ideaDisplay || !errorDisplay) return;

    generateButton.addEventListener('click', async () => {
        clearError(errorDisplay);
        generateButton.disabled = true;

        const selectedModel = modelSelect ? modelSelect.value : '';
        if (!selectedModel) {
            showError(errorDisplay, 'モデルを選択してください。');
            generateButton.disabled = false;
            return;
        }

        let mode = choiceOnly && choiceOnly.checked ? 'choice_only' : 'default';
        let word = '';

        if (customWordMode && customWordMode.checked) {
            word = (customWordInput.value || '').trim().slice(0, 10);
            if (!word) {
                showError(errorDisplay, 'ワードを入力してください（単語・最大10文字）');
                generateButton.disabled = false;
                return;
            }
            mode = 'custom_word';
            if (choiceOnly && choiceOnly.checked) {
                mode = 'custom_word_choice';
            }
        }

        loadingModal.classList.remove('hidden');

        // サーバー側のタイムアウトより少し長めに取り、サーバーからの分かりやすいエラーメッセージを優先しつつ、通信自体が固まった場合の保険として機能させる。
        const RELAY_TIMEOUT_MS = 100000;
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, RELAY_TIMEOUT_MS);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model: selectedModel, mode, word }),
                signal: abortController.signal,
            });

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

            if (data.idea) {
                if (data.choices && Array.isArray(data.choices) && data.choices.length >= 2) {
                    ideaDisplay.innerHTML = `${data.idea}<br><br>` + data.choices.map((c, i) => `<button class="choice-btn">${i + 1}. ${c}</button>`).join('');
                } else {
                    ideaDisplay.textContent = data.idea;
                }
            } else {
                ideaDisplay.textContent = '';
                showError(errorDisplay, '生成に失敗しました。');
            }
        } catch (error) {
            console.error('クライアントサイドでのエラー:', error);
            ideaDisplay.textContent = '';
            showError(errorDisplay, error, {
                timeoutMessage: '生成処理がタイムアウトしました。混雑しているか処理の重いモデルの可能性があるため、再度試すか別のモデルをお試しください。'
            });
        } finally {
            clearTimeout(timeoutId);
            generateButton.disabled = false;
            loadingModal.classList.add('hidden');
        }
    });
}
