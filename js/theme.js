/* ============================================================
   テーマ設定モジュール
   - data-theme 属性で light/dark/system を切り替え
   - system時は prefers-color-scheme に追従
   ============================================================ */

export function initTheme() {
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
}
