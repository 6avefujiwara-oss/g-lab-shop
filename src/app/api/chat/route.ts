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
async function placeOrder(productName: string, quantity: number) {
  console.log(`注文処理呼び出し: 商品名=${productName}, 数量=${quantity}`);

  try {
    // 1. 全商品を取得して名前でマッチング
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*');

    if (fetchError || !products) return "商品の特定に失敗しました。";

    const product = products.find(p => {
      const dbName = p.name.toLowerCase();
      const inputName = productName.toLowerCase();
      return dbName.includes(inputName) || inputName.includes(dbName) ||
             (p.name === 'Hinomaru Cap' && (inputName.includes('cap') || inputName.includes('キャップ') || inputName.includes('日の丸'))) ||
             (p.name === 'Sensu' && (inputName.includes('sensu') || inputName.includes('扇子') || inputName.includes('せんす'))) ||
             (p.name === 'Neko Samurai Tシャツ' && (inputName.includes('tシャツ') || inputName.includes('t-shirt') || inputName.includes('猫') || inputName.includes('侍')));
    });

    if (!product) return `商品「${productName}」の特定に失敗しました。`;
    if (product.stock < quantity) return `在庫不足です。現在この商品はご提供できません。`;

    // 2. 在庫減算
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: product.stock - quantity })
      .eq('id', product.id);

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
        description: "指定された名前の商品を注文（購入確定）します。在庫を実際に減らします。必ず注文の最終確認後に行ってください。",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            productName: { type: SchemaType.STRING, description: "注文する商品の正式名称（例：'Hinomaru Cap'）" },
            quantity: { type: SchemaType.NUMBER, description: "注文個数" }
          },
          required: ["productName", "quantity"]
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
1. 商品紹介時のルール（最重要・顧客への非表示ルール）:
   - **お客様に対して、データベースの「商品ID」や「具体的な在庫数」は絶対に提示しないでください。**
   - 商品の一覧や詳細を案内する際は、商品名と価格、および在庫の有無（「在庫あり」または「残りわずか」など）のみを親しみやすく提示してください。
     例：「日の丸キャップ (Hinomaru Cap)：2,000円（在庫あり）」
     ※お客様にIDや在庫数を意識させない、上質なおもてなしの接客を行ってください。

2. 金額の計算と提示（最終確認）:
   購入希望の言及があった際は、ツールを実行する前に必ず以下の情報を分かりやすく提示し、購入の最終確認を行ってください。
   - 商品の正式名称
   - 単価（1点あたりの価格）
   - ご希望の数量
   - 合計金額（単価 × 数量）
   例：「『日の丸キャップ』は1点 2,000円でございます。1点ですと合計で 2,000円となりますが、こちらで注文を確定（購入確定）してよろしいでしょうか？」

3. 接客フローとツール実行のタイミング:
   - ステップ1: 商品の問い合わせ時に「checkInventory」を実行し、内部で在庫状況を確認した上で、上記の非表示ルールに従って商品名と価格のみを提示する。
   - ステップ2: 購入希望時は、金額計算を含めた最終確認（「〜で確定してよろしいでしょうか？」）を行う。
   - ステップ3: お客様から承諾（例：「はい」「確定してください」「お願いします」「買います」など）が得られたら、**即座に「placeOrder」を実行する**。この際、\`productName\` 引数には該当商品の正式名称（\`Hinomaru Cap\`, \`Sensu\`, \`Neko Samurai Tシャツ\`）を、\`quantity\` には注文個数を指定して呼び出してください。

4. キャラクター:
   - 常に丁寧で「おもてなし」の心を忘れない。
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history } = body;

    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
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
          const { productName, quantity } = call.args as { productName: string; quantity: number };
          const data = await placeOrder(productName, quantity);
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
