import { supabase } from '@/lib/supabase'

export default async function Home() {
  // 1. Supabaseの「products」棚から、すべてのデータを取得する
  const { data: products, error } = await supabase.from('products').select('*')

  if (error) {
    console.error('データの取得に失敗しました:', error)
  }

  // 2. 画面（UI）のデザイン
  return (
    <main className="min-h-screen bg-stone-50 p-8 font-serif">
      <div className="max-w-4xl mx-auto">
        
        {/* 看板部分 */}
        <h1 className="text-4xl font-bold text-stone-800 mb-4 tracking-widest text-center">
          AI屋 - G-LAB
        </h1>
        <p className="text-center text-stone-600 mb-12">
          誠実なAI店主が、あなたにぴったりの品をご案内します。
        </p>

        {/* 商品を並べる棚（グリッド） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products?.map((product) => (
            <div key={product.id} className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 transition-transform hover:-translate-y-1">
              <h2 className="text-xl font-bold text-stone-800 mb-2">{product.name}</h2>
              <div className="flex justify-between items-center text-stone-600 mt-4">
                <span className="font-bold text-lg">¥{product.price}</span>
                <span className="text-sm bg-stone-100 px-2 py-1 rounded">在庫: {product.stock}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 商品がない場合のメッセージ */}
        {(!products || products.length === 0) && (
          <div className="text-center text-stone-500 mt-10 p-8 border border-dashed border-stone-300 rounded-lg">
            <p>現在、棚に商品は並んでいません。</p>
          </div>
        )}

      </div>
    </main>
  )
}


