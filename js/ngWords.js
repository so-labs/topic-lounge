/* ============================================================
   ブラウザ側 NGワードチェック モジュール
   データソース: data/ng-words-ja.json (MosasoM/inappropriate-words-ja)
   ============================================================ */

let ngWordList = null;

// NGワードリストを一度だけ取得してキャッシュする
async function loadNgWords() {
    if (ngWordList !== null) return ngWordList;
    try {
        const res = await fetch('/data/ng-words-ja.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ngWordList = await res.json();
    } catch (err) {
        console.warn('[ngWords] NGワードリストの読み込みに失敗しました:', err.message);
        ngWordList = [];
    }
    return ngWordList;
}

/**
 * 入力テキストにNGワードが含まれるかチェックする。
 * 全角・半角の表記揺れも考慮するため、チェック対象と辞書の両方を正規化して比較する。
 *
 * @param {string} text チェックするテキスト
 * @returns {Promise<boolean>} NGワードが含まれる場合は true
 */
export async function containsNgWord(text) {
    if (!text) return false;
    const words = await loadNgWords();
    if (words.length === 0) return false;

    // 全角英数字・記号を半角に正規化して比較（表記揺れ対策）
    const normalize = (str) => str.normalize('NFKC').toLowerCase();
    const normalizedText = normalize(text);

    return words.some(w => normalizedText.includes(normalize(w)));
}

