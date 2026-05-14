import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// 在庫確認ツール
async function checkInventory() {
  console.log("在庫確認ツールが呼び出されました");

  // 環境変数のチェック
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase環境変数が不足しています");
    return "申し訳ありません。現在、在庫データベースの設定が不十分なため確認できません。";
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      console.error("在庫確認エラー:", error);
      return "在庫情報の取得中にエラーが発生しました。";
    }

    if (!data || data.length === 0) {
      return "現在、在庫として登録されている商品はございません。";
    }

    return JSON.stringify(data);
  } catch (err) {
    console.error("在庫確認中に例外が発生:", err);
    return "在庫確認プロセスで予期せぬエラーが発生しました。";
  }
}

const storeTools = [
  {
    functionDeclarations: [
      {
        name: "checkInventory",
        description: "ショップ「G-LAB」の最新の在庫状況（商品名、価格、在庫数）を取得します。お客様から商品や在庫について聞かれた際は、必ずこのツールを使用して最新情報を確認してください。",
      },
    ],
  },
];

const SYSTEM_PROMPT = `
あなたは、京都にある日本文化とAIアートを融合させたショップ「G-LAB」の優秀なバイリンガル・コンシェルジュです。
以下のルールに従って、丁寧な接客を行ってください。

1. 【言語対応】 相手が英語で話しかけてきたら流暢な英語で、日本語なら日本語で自然に返答してください。
2. 【観光案内】 京都の観光 (特に禅寺や浮世絵などの伝統文化)について聞かれたら、深い知識をもっておもてなしの心で案内してください。
3. 【ショップ店員】 G-LABの主力商品である「猫侍 (Neko Samurai) の Tシャツ」や「日の丸キャップ（Hinomaru Cap)」などに自然な流れで興味を持ってもらい、提案してください。
4. 【在庫確認】 商品や在庫に関する質問には、必ず「checkInventory」ツールを使用して答えてください。
5. 【誠実な対応】 注文の最終決定前には、必ずお客様に「こちらで確定してよろしいでしょうか?」と確認を行ってください。
6. 【ショップ店員】最後は『京都の風情を大切に。AI屋 G-LAB 店主より』という一言だけで締めくくってください。過度な宣伝は不要です。

`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        tools: storeTools
    });

    const chat = model.startChat();
    let result = await chat.sendMessage(message);
    let response = result.response;

    // ツール呼び出しのループ処理（最大5回まで）
    let callCount = 0;
    while (response.functionCalls()?.length > 0 && callCount < 5) {
      callCount++;
      const calls = response.functionCalls();
      const functionResponses = [];

      for (const call of calls) {
        if (call.name === "checkInventory") {
          const inventoryData = await checkInventory();
          functionResponses.push({
            functionResponse: {
              name: "checkInventory",
              response: { content: inventoryData }
            }
          });
        }
      }

      if (functionResponses.length > 0) {
        result = await chat.sendMessage(functionResponses);
        response = result.response;
      } else {
        break;
      }
    }

    // テキストレスポンスを取得（存在しない場合はフォールバック）
    let text = "";
    try {
      text = response.text();
    } catch (e) {
      console.warn("テキスト取得エラー:", e);
      text = "申し訳ございません。情報の処理中に問題が発生しました。もう一度お聞きいただけますか？";
    }

    return Response.json({ reply: text });

  } catch (error) {
    console.error('APIエラー:', error);
    return Response.json(
      { error: "申し訳ございません。現在AI店主が席を外しております。少々お待ちくださいませ。" },
      { status: 500 }
    );
  }
}
