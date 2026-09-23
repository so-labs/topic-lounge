import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESモジュールの環境で__dirnameと__filenameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ファイルを読み込み、BOMを削除する関数
const readJsonFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileContent.replace(/^\uFEFF/, ""));
};

const API_KEY = process.env.GEMINI_API_KEY;

// AIが生成する1ターンあたりの最大文字数（履歴・コンテキストの肥大化防止用）
const MAX_STORY_CHARS = 500;

// models.json から定義済みモデル一覧を読み込み（ホワイトリスト）
let localValidModels = new Map();
try {
    const modelsConfig = readJsonFile(path.join(__dirname, "..", "models.json"));
    modelsConfig.forEach(group => {
        group.models?.forEach(m => {
            if (m.id) {
                localValidModels.set(m.id, m);
                localValidModels.set(`models/${m.id}`, m);
            }
        });
    });
} catch (e) {
    console.warn("models.jsonの読み込みに失敗しました:", e.message);
}

// ターン数に応じた執筆方針を返す (AIが担当するのは偶数ターン: 2, 4, 6, 8, 10)
function getTurnGuidance(turn) {
    if (turn >= 10) {
        return `【現在のターン: 第10ターン（最終回・完結）】
物語の最終回です。これまでの流れや直前の展開を受け止め、物語を完全に終わらせてください。余韻の残るエンディングを描き、物語を綺麗に完結させてください。`;
    }
    if (turn === 8) {
        return `【現在のターン: 第8ターン（最後の展開・締め）】
残るは人間の第9ターンと最終回（第10ターン）のみです。最後の展開としてかなり締めにかかってください。結末へ直結する重大な局面を描き、緊張感を最高潮に高めてください。`;
    }
    if (turn === 6) {
        return `【現在のターン: 第6ターン（中盤・大展開）】
物語の中盤の山場です。これまでの流れを踏まえつつ、物語を大きく動かす予想外の大きな展開を挟んで、物語をダイナミックに加速させてください。`;
    }
    return `【現在のターン: 第${turn}ターン（序盤展開）】
物語の序盤です。直前の展開を活かしつつ、読者がワクワクするような新たな出来事や変化、情景描写を盛り込んで展開を広げてください。`;
}

export default async function handler(request, response) {
    const startTime = Date.now();

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    const {
        model: selectedModel,
        setting = '',
        turn = 1,
        history = [],
        keepTurns = 3
    } = request.body || {};

    const cleanTurn = Math.max(1, Math.min(10, parseInt(turn, 10) || 1));
    const cleanSetting = String(setting || '').trim().slice(0, 100);
    const cleanKeepTurns = Math.max(2, Math.min(4, parseInt(keepTurns, 10) || 3));

    console.log(`[relay] リクエスト受信: model=${selectedModel}, turn=${cleanTurn}, keepTurns=${cleanKeepTurns}, settingLength=${cleanSetting.length}`);

    // models.json に定義された軽量モデル以外は拒否
    const modelInfo = localValidModels.get(selectedModel);
    if (!selectedModel || !modelInfo || !modelInfo.lightweight) {
        console.warn(`[relay] 許可されていないモデル（軽量モデル以外）の指定: ${selectedModel}`);
        return response.status(400).json({ error: "直前リレー小説では軽量モデルのみ選択できます。" });
    }

    // APIキーがない場合はエラー
    if (!API_KEY) {
        console.error("[relay] エラー: APIキーが設定されていません。");
        return response.status(500).json({ error: "APIキーが設定されていません。" });
    }

    // 直前Nターンの履歴のみを抽出（Nは keepTurns: 2~4, デフォルト3）
    const safeHistory = Array.isArray(history) ? history.slice(-cleanKeepTurns) : [];
    const formattedHistory = safeHistory.map(item => {
        const roleName = item.role === 'user' ? '人間' : 'AI';
        const content = String(item.content || '').trim().slice(0, 500);
        return `【${roleName}】: ${content}`;
    }).join('\n\n');

    const turnGuidance = getTurnGuidance(cleanTurn);

    const prompt = `あなたは「直前リレー小説」の共同執筆AIです。
人間とAIが交互に文章を書き継ぎ、全10ターンで一つの物語を紡ぎます。

${cleanSetting ? `【共通設定（世界観・主人公など）】\n${cleanSetting}\n` : ''}
${turnGuidance}

【直前までの流れ（直近${cleanKeepTurns}エピソード）】
${formattedHistory ? formattedHistory : '（物語の開始です）'}

【執筆ルール】
- 上記の直前の流れとターンの方針を踏まえ、続く小説の文章を書いてください。
- 文字数は100文字〜250文字程度（読みやすい短い一節）。
- 「承知しました」「面白い展開ですね」「第〜ターン」などの挨拶・前置き・解説・タイトル表記は一切書かないでください。
- 純粋な物語の本文のみを出力してください。`;

    try {
        const generationConfig = {
            temperature: 0.8,
        };

        // Gemma 4またはGemini 3モデルの場合、推論内容（Thinking）を抑制する設定を追加
        if (selectedModel.startsWith("gemma-4") || selectedModel.startsWith("gemini-3")) {
            generationConfig.thinkingConfig = {
                includeThoughts: false,
            };
        }

        const client = new GoogleGenAI({ apiKey: API_KEY });
        const API_TIMEOUT_MS = modelInfo.timeout || 25000;

        let result;
        const maxRetries = 1;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let timer;
            try {
                console.log(`[relay] API呼び出し開始 (${attempt + 1}/${maxRetries + 1}): model=${selectedModel}`);

                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        const err = new Error(`API呼び出しが${API_TIMEOUT_MS / 1000}秒以内に完了しませんでした（タイムアウト）`);
                        err.name = "TimeoutError";
                        reject(err);
                    }, API_TIMEOUT_MS);
                });

                const apiCallPromise = client.models.generateContent({
                    model: selectedModel,
                    contents: prompt,
                    config: generationConfig,
                });

                result = await Promise.race([apiCallPromise, timeoutPromise]);
                clearTimeout(timer);
                break;
            } catch (err) {
                clearTimeout(timer);
                if (err.name === "TimeoutError") {
                    console.error(`[relay] タイムアウト発生 (${API_TIMEOUT_MS / 1000}秒): model=${selectedModel}`);
                    throw err;
                }

                const isUnavailable = err?.status === 503 ||
                    err?.message?.includes("503") ||
                    err?.message?.includes("high demand") ||
                    err?.message?.includes("UNAVAILABLE");

                if (isUnavailable && attempt < maxRetries) {
                    console.warn(`[relay] モデル高負荷のため再試行します（1秒待機）`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                throw err;
            }
        }

        // 推論パーツを除外して純粋なテキストを取得
        let text = "";
        if (result.candidates && result.candidates[0].content.parts) {
            text = result.candidates[0].content.parts
                .filter(part => !part.thought)
                .map(part => part.text)
                .join("")
                .trim();
        } else {
            text = result.text ? result.text.trim() : "";
        }

        // 余計な引用符や前後のMarkdownコードブロック記号等があれば除去
        text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

        // 上限を超えた場合はトリムする（サロゲートペアを壊さないようコードポイント単位で数える）
        const textChars = Array.from(text);
        if (textChars.length > MAX_STORY_CHARS) {
            console.warn(`[relay] 生成結果が${MAX_STORY_CHARS}文字を超えたためトリムしました (元の文字数: ${textChars.length})`);
            text = textChars.slice(0, MAX_STORY_CHARS).join("").trim();
        }

        const elapsed = Date.now() - startTime;
        console.log(`[relay] 生成成功 (所要時間: ${elapsed}ms, turn: ${cleanTurn})`);

        return response.status(200).json({
            text,
            turn: cleanTurn
        });
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[relay] エラー発生 (所要時間: ${elapsed}ms):`, error.message);

        if (error.name === "TimeoutError") {
            return response.status(504).json({
                error: "AIモデルの応答がタイムアウトしました。混雑している可能性があるため、再度試すか別のモデルをお選びください。"
            });
        }

        const isUnavailable = error?.status === 503 ||
            error?.message?.includes("503") ||
            error?.message?.includes("high demand") ||
            error?.message?.includes("UNAVAILABLE");

        if (isUnavailable) {
            return response.status(503).json({
                error: "現在モデルが混雑しています。しばらく経ってから再度お試しいただくか、他のモデルをお選びください。"
            });
        }

        return response.status(500).json({
            error: "リレー小説の生成処理に失敗しました。"
        });
    }
}
