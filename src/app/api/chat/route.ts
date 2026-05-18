import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// 在庫確認ツール
async function checkInventory() {
  console.log("在庫確認ツールが呼び出されました");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "申し訳ありません。データベースの設定が不十分です。";
  }

  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    // オブジェクトのまま返す（JSON文字列化しない）
    return data;
  } catch (err) {
    console.error("在庫確認エラー:", err);
    return "在庫情報の取得に失敗しました。";
  }
}

// 注文処理ツール
async function placeOrder(productId: number, quantity: number) {
  console.log(`注文処理呼び出し: ID=${productId}, 数量=${quantity}`);

  try {
    // 1. 在庫確認
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock, name')
      .eq('id', productId)
      .single();

    if (fetchError || !product) return "商品の特定に失敗しました。";
    if (product.stock < quantity) return `在庫不足です（現在庫: ${product.stock}）。`;

    // 2. 在庫減算
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: product.stock - quantity })
      .eq('id', productId);

    if (updateError) throw updateError;

    // オブジェクトのまま返す（JSON文字列化しない）
    return {
      status: "success",
      message: `${product.name}を${quantity}点、ご注文承りました。ありがとうございます！`
    };
  } catch (err) {
    console.error("注文実行エラー:", err);
    return "注文処理中に予期せぬエラーが発生しました。";
  }
}

const storeTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "checkInventory",
        description: "ショップの全商品の最新在庫状況（ID、商品名、価格、在庫数）を取得します。",
        // 引数なしでも parameters の定義が必須（未定義だとGeminiが関数を呼び出さない）
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "placeOrder",
        description: "指定されたIDの商品を注文（購入確定）します。在庫を実際に減らします。必ず注文の最終確認後に行ってください。",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            productId: { type: SchemaType.NUMBER, description: "注文する商品のID" },
            quantity: { type: SchemaType.NUMBER, description: "注文個数" }
          },
          required: ["productId", "quantity"]
        }
      }
    ],
  },
];

const SYSTEM_PROMPT = `
あなたは、京都のショップ「G-LAB」の優秀なコンシェルジュです。
お客様の意図を汲み取り、正確な「金額計算」と「丁寧な確認」を行ってください。

【ツール利用の厳格な指針】
1. 観光案内や一般的な挨拶、雑談の際には、絶対に「checkInventory」や「placeOrder」を呼び出さないでください。
2. お客様が具体的な商品（「キャップ」「Tシャツ」「グッズ」など）について尋ねた場合や、購入を希望された場合にのみ「checkInventory」を実行してください。
3. 無関係な文脈（例：葵祭の解説、道案内など）でツールを呼び出すことは禁止です。

【スマート接客ガイドライン】
1. 曖昧さの解消と検索: 
   商品に関連する言及があったら、即座に「checkInventory」を実行して特定してください。

2. 金額の計算と提示（重要）:
   購入の意思を確認する際は、必ず以下の情報を分かりやすく提示してください。
   - 商品の正式名称
   - 単価（1点あたりの価格）
   - ご希望の数量
   - 合計金額（単価 × 数量）
   例：「『日の丸キャップ』は1点 2,500円でございます。3点ですと合計で 7,500円となりますが、こちらで確定してよろしいでしょうか？」

3. 接客フロー:
   - ステップ1: 商品の問い合わせ時に「checkInventory」でID、名称、価格、在庫を確認。
   - ステップ2: 上記の「金額計算」を含めた最終確認を行う。
   - ステップ3: お客様から承諾が得られたら「placeOrder」を実行する。

4. キャラクター:
   - 常に丁寧で「おもてなし」の心を忘れない。
   - 最後は必ず『京都の風情を大切に。AI屋 G-LAB 店主より』で締める。
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history } = body;

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        systemInstruction: SYSTEM_PROMPT,
        tools: storeTools
    });

    // 履歴のロールをGeminiの形式（assistant -> model）に変換
    const geminiHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    console.log("チャットセッションを開始します（履歴あり）:", message);
    const chat = model.startChat({
      history: geminiHistory,
    });
    let result = await chat.sendMessage(message);
    let response = result.response;

    let callCount = 0;
    let calls = response.functionCalls();
    console.log("初期レスポンスの関数呼び出し:", calls ? calls.length : 0);

    while (calls && calls.length > 0 && callCount < 5) {
      callCount++;
      const functionResponses = [];

      for (const call of calls) {
        console.log(`関数実行中: ${call.name}`, call.args);
        if (call.name === "checkInventory") {
          const data = await checkInventory();
          // response にはパース済みオブジェクトを渡す（文字列はNG）
          functionResponses.push({ functionResponse: { name: "checkInventory", response: { products: data } } });
        } else if (call.name === "placeOrder") {
          const { productId, quantity } = call.args as { productId: number; quantity: number };
          const data = await placeOrder(productId, quantity);
          functionResponses.push({ functionResponse: { name: "placeOrder", response: { result: data } } });
        }
      }

      if (functionResponses.length > 0) {
        console.log(`AIにツール結果を送信します (回数: ${callCount}) - レート制限回避のため待機中...`);
        // 無料枠の制限を回避するための待機時間を延長
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        result = await chat.sendMessage(functionResponses);
        response = result.response;
        calls = response.functionCalls();
        console.log("次ターンの関数呼び出し:", calls ? calls.length : 0);
      } else {
        break;
      }
    }

    let text = "";
    try {
      text = response.text();
      console.log("最終テキスト応答を取得しました");
    } catch (e) {
      console.warn("Text generation failed or blocked:", e);
      text = "申し訳ございません。現在うまくお答えすることができません。別の言い方でお試しいただけますか？";
    }

    return Response.json({ reply: text });

  } catch (error: any) {
    if (error.status === 429) {
      console.error('クォータ制限エラー:', error);
      // 詳細なエラー理由をフロントエンドに返す
      return Response.json({ 
        error: `APIの利用制限が発生しました(429)。理由: ${error.message || "リクエスト過多です。しばらくお待ちください。"}` 
      }, { status: 429 });
    }
    
    console.error('APIエラー:', error);
    return Response.json({ error: `APIエラーが発生しました(500): ${error.message}` }, { status: 500 });
  }
}
