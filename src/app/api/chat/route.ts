import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// 在庫確認ツール
async function checkInventory() {
  console.log("在庫確認ツールが呼び出されました");

  const { data, error } = await supabase.from('products').select('*');

  if (error) {
    console.error("在庫確認エラー:", error);
    return "在庫情報の取得に失敗しました。";
  }

  return JSON.stringify(data);
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
3. 【ショップ店員】 G-LABの主力商品である「猫侍 (Neko Samurai) の Tシャツ」や「京扇子」などに自然な流れで興味を持ってもらい、提案してください。
4. 【在庫確認】 商品や在庫に関する質問には、必ず「checkInventory」ツールを使用して答えてください。
5. 【誠実な対応】 注文の最終決定前には、必ずお客様に「こちらで確定してよろしいでしょうか?」と確認を行ってください。
6. 【ショップ店員】最後は『京都の風情を大切に。AI屋 G-LAB 店主より』という一言だけで締めくくってください。過度な宣伝は不要です。」

`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash', // 2026年5月現在の主力安定モデル
        systemInstruction: SYSTEM_PROMPT,
        tools: storeTools
    });

    const chat = model.startChat();
    let result = await chat.sendMessage(message);
    let response = result.response;

    const calls = response.functionCalls();

    // Function Calling の処理
    if (calls && calls.length > 0) {
      const call = calls[0];

      if (call && call.name === "checkInventory") {
        const inventoryData = await checkInventory();

        result = await chat.sendMessage([{
          functionResponse: {
            name: "checkInventory",
            response: { content: inventoryData }
          }
        }]);
        response = result.response;
      }
    }

    const text = response.text();
    return Response.json({ reply: text });

  } catch (error) {
    console.error('APIエラー:', error);
    return Response.json(
      { error: "申し訳ございません。現在AI店主が席を外しております。少々お待ちくださいませ。" },
      { status: 500 }
    );
  }
}
