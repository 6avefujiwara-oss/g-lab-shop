"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export default function AdminConsole() {
  const router = useRouter();

  // 状態管理
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(null);
  const [stockEdits, setStockEdits] = useState<{ [key: number]: number }>({});
  const [successMessage, setSuccessMessage] = useState<string>("");

  // 1. 起動時およびセッション確認
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth");
    if (isAuth === "true") {
      setIsAuthenticated(true);
      fetchProducts();
    } else {
      setIsLoading(false);
    }
  }, []);

  // 2. 商品データ取得
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      if (data) {
        setProducts(data);
        // 各商品の現在の在庫を入力用一時ステートに初期セット
        const initialEdits: { [key: number]: number } = {};
        data.forEach((p) => {
          initialEdits[p.id] = p.stock;
        });
        setStockEdits(initialEdits);
      }
    } catch (err) {
      console.error("商品データのロードエラー:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. ログイン認証処理
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "glab2026") {
      sessionStorage.setItem("admin_auth", "true");
      setIsAuthenticated(true);
      setAuthError("");
      fetchProducts();
    } else {
      setAuthError("パスワードが正しくありません。");
    }
  };

  // 4. ログアウト処理
  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    setIsAuthenticated(false);
    setProducts([]);
  };

  // 5. 在庫数の直接増減（ローカル変更）
  const adjustStock = (productId: number, delta: number) => {
    setStockEdits((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [productId]: updated };
    });
  };

  // 6. 在庫数の手入力変更（ローカル変更）
  const handleInputChange = (productId: number, value: string) => {
    const num = parseInt(value, 10);
    setStockEdits((prev) => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : Math.max(0, num),
    }));
  };

  // 7. 在庫数のデータベース更新（確定）
  const saveStockUpdate = async (productId: number, productName: string) => {
    const targetStock = stockEdits[productId];
    if (targetStock === undefined) return;

    setUpdatingProductId(productId);
    try {
      const { error } = await supabase
        .from("products")
        .update({ stock: targetStock })
        .eq("id", productId);

      if (error) throw error;

      // ローカルのproductsステートを更新
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: targetStock } : p))
      );

      // 成功通知を表示
      setSuccessMessage(`『${productName}』の在庫を ${targetStock} 点に更新しました。`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("在庫更新エラー:", err);
      alert("在庫の更新に失敗しました。");
    } finally {
      setUpdatingProductId(null);
    }
  };

  // === ロック（ログイン）画面 ===
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-serif">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-stone-200 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">G-LAB 管理者認証</h1>
          <p className="text-stone-600 text-sm mb-6">
            このエリアは店主専用です。パスワードを入力してください。
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="管理者用パスワード"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full border-2 border-stone-200 rounded-lg px-4 py-3 text-stone-800 bg-white focus:outline-none focus:border-stone-500 transition-colors"
              autoFocus
            />
            {authError && (
              <p className="text-red-600 text-xs font-bold text-left">{authError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-1/3 border-2 border-stone-200 text-stone-600 font-bold py-3 rounded-lg hover:bg-stone-50 transition-colors text-sm"
              >
                戻る
              </button>
              <button
                type="submit"
                className="w-2/3 bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 rounded-lg transition-colors text-sm"
              >
                認証して進む
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // === 管理画面（認証後） ===
  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-12 font-serif text-stone-800 relative">
      
      {/* 成功トーストメッセージ */}
      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <span>✅</span>
          <span className="font-bold text-sm">{successMessage}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 pb-6 border-b border-stone-200 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
              <span className="text-xl">⚙️</span>
              <h1 className="text-3xl font-bold tracking-widest text-stone-800">
                G-LAB 管理台帳
              </h1>
            </div>
            <p className="text-stone-600 text-sm text-center md:text-left">
              商品の在庫補充および価格・情報の確認を行う店主用画面です。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/")}
              className="border border-stone-300 text-stone-600 font-bold px-4 py-2 rounded-lg hover:bg-stone-100 transition-colors text-sm flex items-center gap-1"
            >
              💬 チャット画面へ戻る
            </button>
            <button
              onClick={handleLogout}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              🔒 閉じる（ログアウト）
            </button>
          </div>
        </div>

        {/* ロード中表示 */}
        {isLoading ? (
          <div className="text-center py-20">
            <span className="inline-block animate-spin text-4xl mb-4">🌀</span>
            <p className="text-stone-500 text-sm">台帳を読み込んでいます...</p>
          </div>
        ) : (
          <>
            {/* 商品棚の一覧 */}
            <div className="grid grid-cols-1 gap-6">
              {products.map((product) => {
                const currentEdit =
                  stockEdits[product.id] !== undefined
                    ? stockEdits[product.id]
                    : product.stock;
                const isModified = currentEdit !== product.stock;

                return (
                  <div
                    key={product.id}
                    className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all hover:shadow-md"
                  >
                    {/* 商品情報 */}
                    <div className="space-y-1">
                      <span className="text-xs text-stone-400 font-bold tracking-wider uppercase">
                        商品ID: #{product.id}
                      </span>
                      <h2 className="text-2xl font-bold text-stone-800">
                        {product.name}
                      </h2>
                      <div className="flex items-center gap-4 text-stone-600 mt-2">
                        <span className="text-lg font-bold">¥{product.price.toLocaleString()}</span>
                        <span className="text-xs bg-stone-100 px-2.5 py-1 rounded text-stone-500 font-bold">
                          現在の在庫: {product.stock} 点
                        </span>
                      </div>
                    </div>

                    {/* 在庫管理エリア */}
                    <div className="w-full md:w-auto bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          補充・変更後の在庫数
                        </label>
                        <div className="flex items-center gap-1 w-full sm:w-auto">
                          {/* クイック増減ボタン */}
                          <button
                            onClick={() => adjustStock(product.id, -1)}
                            className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
                            title="-1点"
                          >
                            -
                          </button>
                          
                          {/* 直接入力 */}
                          <input
                            type="number"
                            min="0"
                            value={currentEdit}
                            onChange={(e) => handleInputChange(product.id, e.target.value)}
                            className="w-16 h-8 border border-stone-300 rounded text-center font-bold text-stone-800 bg-white focus:outline-none focus:border-stone-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          
                          <button
                            onClick={() => adjustStock(product.id, 1)}
                            className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
                            title="+1点"
                          >
                            +
                          </button>
                          
                          <button
                            onClick={() => adjustStock(product.id, 5)}
                            className="px-1.5 h-8 rounded bg-white border border-stone-300 flex items-center justify-center font-bold text-xs text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
                            title="+5点"
                          >
                            +5
                          </button>

                          <button
                            onClick={() => adjustStock(product.id, 10)}
                            className="px-1.5 h-8 rounded bg-white border border-stone-300 flex items-center justify-center font-bold text-xs text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
                            title="+10点"
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* 更新・保存ボタン */}
                      <button
                        onClick={() => saveStockUpdate(product.id, product.name)}
                        disabled={updatingProductId !== null || !isModified}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-1 active:scale-95 shadow-sm ${
                          isModified
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            : "bg-stone-200 text-stone-400 cursor-not-allowed"
                        }`}
                      >
                        {updatingProductId === product.id ? (
                          <>
                            <span className="animate-spin text-xs">🌀</span>
                            <span>更新中...</span>
                          </>
                        ) : (
                          <>
                            <span>💾</span>
                            <span>台帳更新</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 商品がない場合の空表示 */}
            {products.length === 0 && (
              <div className="text-center text-stone-500 py-16 border-2 border-dashed border-stone-300 rounded-xl bg-white">
                <p className="text-lg">現在、棚に商品は並んでいません。</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
