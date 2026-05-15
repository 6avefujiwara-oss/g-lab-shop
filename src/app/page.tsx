"use client";

import { useState, useRef, useEffect } from "react";

export default function Storefront() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージが更新されたら自動的に末尾へスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: input,
          history: messages 
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "APIレスポンスエラー");
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || data.error }]);
    } catch (error: any) {
      console.error("通信エラー:", error);
      setMessages([...newMessages, { role: "assistant", content: `申し訳ございません。エラーが発生しました: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 p-4 md:p-8 font-serif">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[85vh] border border-stone-200">

        {/* ヘッダーエリア */}
        <div className="bg-stone-800 text-white p-5 text-center">
          <h1 className="text-3xl font-bold tracking-widest mb-1">G-LAB</h1>
          <p className="text-sm text-stone-300">伝統文化とAIの融合 - コンシェルジュ・サービス</p>
          <p className="text-base text-stone-300 mt-1">
             Providing tourist guidance and local rules in both Japanese and English.
         </p>
        </div>

        {/* チャット履歴表示エリア */}
        <div className="flex-1 p-6 overflow-y-auto bg-stone-50 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-stone-500 mt-20">
              <p className="text-xl mb-2 text-stone-700">いらっしゃいませ / Welcome!</p>
              <p>G-LABのチャットボット・コンシェルジュです。京都の観光案内や当店のオリジナルグッズについて何でもお聞きください。</p>
              <p className="text-sm mt-2">※商品のご注文に関する最終確認などは慎重に対応させていただきます。</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>     
                <div className={`max-w-[80%] p-4 rounded-lg whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-stone-700 text-white rounded-br-none"
                    : "bg-white border border-stone-300 text-stone-800 rounded-bl-none shadow-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-stone-500 text-sm ml-2 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse delay-100">●</span>
              <span className="animate-pulse delay-200">●</span>
              <span>AIが考え中...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="p-4 bg-white border-t border-stone-200 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="メッセージを入力してください..."
            disabled={isLoading}
            className="flex-1 border-2 border-stone-200 rounded-lg px-4 py-3 text-stone-800 bg-white focus:outline-none focus:border-stone-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-stone-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-stone-700 disabled:bg-stone-300 transition-colors"
          >
            送信
          </button>
        </div>

      </div>
    </main>
  );
}
