/* ============================================================
   お題生成 (Topics) モジュール
   ============================================================ */

import { showError, clearError } from './errorDisplay.js';
import { withAutoRetry } from './retry.js';
import { notifyGenerationSuccess, notifyGenerationFailure } from './notifications.js';

export function initTopics() {
    const generateButton = document.getElementById('generateButton');
    const ideaDisplay = document.getElementById('ideaDisplay');
    const errorDisplay = document.getElementById('errorDisplay');
    const modelSelect = document.getElementById('modelSelect');
    const choiceOnly = document.getElementById('choiceOnly');
    const customWordMode = document.getElementById('customWordMode');
    const customWordInput = document.getElementById('customWordInput');
    const loadingModal = document.getElementById('loadingModal');
    const loadingText = loadingModal ? loadingModal.querySelector('p') : null;

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
        if (loadingText) {
            loadingText.textContent = 'お題を生成中...';
        }

        try {
            const data = await withAutoRetry(async () => {
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

                    let resData = {};
                    try {
                        resData = await response.json();
                    } catch {
                        if (!response.ok) {
                            const err = new Error(`通信エラーが発生しました (HTTP ${response.status})`);
                            err.status = response.status;
                            throw err;
                        }
                    }

                    if (!response.ok) {
                        const err = new Error(resData.error || `HTTP error! status: ${response.status}`);
                        err.status = response.status;
                        throw err;
                    }

                    return resData;
                } finally {
                    clearTimeout(timeoutId);
                }
            }, {
                maxRetries: 2,
                baseDelayMs: 1500,
                onRetry: (attempt, maxRetries) => {
                    if (loadingText) {
                        loadingText.textContent = `お題を再試行中 (${attempt}/${maxRetries})...`;
                    }
                }
            });

            if (data.idea) {
                if (data.choices && Array.isArray(data.choices) && data.choices.length >= 2) {
                    ideaDisplay.innerHTML = `${data.idea}<br><br>` + data.choices.map((c, i) => `<button class="choice-btn">${i + 1}. ${c}</button>`).join('');
                } else {
                    ideaDisplay.textContent = data.idea;
                }

                // PWAとしてインストールされている場合は成功通知を送信
                notifyGenerationSuccess('topics', data.idea);
            } else {
                ideaDisplay.textContent = '';
                showError(errorDisplay, '生成に失敗しました。');
            }
        } catch (error) {
            console.error('クライアントサイドでのエラー:', error);
            ideaDisplay.textContent = '';
            // バックグラウンド時は失敗通知を送信
            notifyGenerationFailure('topics');
            showError(errorDisplay, error, {
                timeoutMessage: '生成処理がタイムアウトしました。混雑しているか処理の重いモデルの可能性があるため、再度試すか別のモデルをお試しください。'
            });
        } finally {
            if (loadingText) {
                loadingText.textContent = 'お題を生成中...';
            }
            generateButton.disabled = false;
            loadingModal.classList.add('hidden');
        }
    });
}
