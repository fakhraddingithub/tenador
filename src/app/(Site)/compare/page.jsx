'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiX, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { toast } from 'react-toastify';
import { MdDescription } from 'react-icons/md';

// پالت رنگی برای کارت محصولات (استفاده از رنگ های تم شما به عنوان پایه)
const PRODUCT_COLORS = ['#aa4725', '#ffbf00', '#0ea5e9', '#10b981', '#8b5cf6'];

export default function ComparePage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [lockedCategory, setLockedCategory] = useState(null);

    // برای بستن دراپ داون وقتی بیرون کلیک میشه
    const searchRef = useRef(null);

    // Debounce Search
    useEffect(() => {
        const fetchProducts = async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const url = `/api/compare/search?q=${encodeURIComponent(query)}${lockedCategory ? `&categoryId=${lockedCategory._id}` : ''
                    }`;
                const res = await fetch(url);
                const data = await res.json();
                setResults(data.products || []);
            } catch (error) {
                console.error('Error fetching search results:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchProducts, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [query, lockedCategory]);

    const handleSelectProduct = (product) => {
        if (selectedProducts.find((p) => p._id === product._id)) {
            setQuery('');
            setResults([]);
            return; // جلوگیری از انتخاب تکراری
        }

        if (selectedProducts.length === 0) {
            setLockedCategory(product.category); // قفل کردن دسته بندی با محصول اول
        }

        // اضافه کردن رنگ اختصاصی به محصول برای چارت
        const productWithColor = {
            ...product,
            color: PRODUCT_COLORS[selectedProducts.length % PRODUCT_COLORS.length],
        };

        setSelectedProducts((prev) => [...prev, productWithColor]);
        toast.success("محصول به مقایسه اضافه شد")
        setQuery('');
        setResults([]);
    };

    const handleRemoveProduct = (productId) => {
        const newProducts = selectedProducts.filter((p) => p._id !== productId);
        setSelectedProducts(newProducts);

        // اگر همه محصولات پاک شدند، قفل دسته بندی باز شود تا بتواند هر محصولی را سرچ کند
        if (newProducts.length === 0) {
            setLockedCategory(null);
        } else {
            // بروزرسانی رنگ ها تا جای خالی پر شود
            const updatedColors = newProducts.map((p, idx) => ({
                ...p,
                color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length]
            }));
            setSelectedProducts(updatedColors);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-text)] transition-all duration-700 ease-in-out">

            {/* بخش جستجو: 
        اگر محصولی انتخاب نشده، وسط صفحه است. 
        اگر انتخاب شده، با انیمیشن به بالای صفحه منتقل می شود. 
      */}
            <div
                className={`w-full max-w-4xl mx-auto px-4 transition-all duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] ${selectedProducts.length === 0
                    ? 'h-screen flex flex-col items-center justify-center'
                    : 'pt-10 pb-6'
                    }`}
            >
                {selectedProducts.length === 0 && (
                    <div className="text-center mb-8 space-y-3 opacity-100 transition-opacity duration-500">
                        <h1 className="text-4xl font-bold text-[var(--color-primary)]">مقایسه تخصصی محصولات</h1>
                        <p className="text-neutral-500">نام اولین محصول برای مقایسه را وارد کنید</p>
                    </div>
                )}

                <div className="relative w-full" ref={searchRef}>
                    <div className="relative group">
                        <div className={`absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-neutral-400 group-focus-within:text-[var(--color-primary)] transition-colors`}>
                            <FiSearch size={22} />
                        </div>
                        <input
                            type="text"
                            className="block w-full p-5 pr-12 text-lg text-gray-900 border-2 border-neutral-200 rounded-2xl bg-white focus:ring-0 focus:border-[var(--color-primary)] shadow-sm focus:shadow-md transition-all outline-none"
                            placeholder={
                                lockedCategory
                                    ? `جستجوی محصول دیگر در دسته "${lockedCategory.title}"...`
                                    : "نام محصول را جستجو کنید (مثلا: راکت ویلسون)..."
                            }
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {isSearching && (
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                                <div className="w-5 h-5 border-2 border-[var(--color-secondary)] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    {/* دراپ داون پیشنهادات */}
                    {query.length >= 2 && (
                        <div className="absolute top-full right-0 w-full mt-2 bg-white border border-neutral-100 rounded-xl shadow-xl overflow-hidden0">
                            {results.length > 0 ? (
                                <ul className="max-h-[300px] overflow-y-auto divide-y divide-neutral-100">
                                    {results.map((item) => (
                                        <li key={item._id}>
                                            <button
                                                onClick={() => handleSelectProduct(item)}
                                                className="w-full text-right px-5 py-4 hover:bg-neutral-50 flex items-center gap-4 transition-colors text-right"
                                            >
                                                <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden shrink-0 relative">
                                                    {/* اینجا از next/image استفاده کنید. برای نمونه img گذاشتم */}
                                                    <img
                                                        src={item.mainImage || '/placeholder.png'}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-start text-right">
                                                    <span className="font-bold text-neutral-800 line-clamp-1">{item.name}</span>
                                                    <span className="text-xs text-neutral-400 mt-1">{item.category?.title}</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                !isSearching && (
                                    <div className="p-6 text-center text-neutral-500">
                                        محصولی با این نام {lockedCategory ? 'در این دسته‌بندی' : ''} وجود ندارد.
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* بخش محتوای مقایسه 
        فقط زمانی نمایش داده میشود که حداقل یک محصول انتخاب شده باشد
      */}
            {selectedProducts.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 pb-20 animate-in fade-in slide-in-from-bottom-10 duration-700">

                    {/* 1. کارت‌های محصولات انتخاب شده */}
                    <div className="flex flex-wrap gap-4 justify-center mb-12">
                        {selectedProducts.map((product) => (
                            <div
                                key={product._id}
                                className="relative rounded-2xl p-2 pl-4 shadow-sm flex items-center gap-3 w-full sm:w-72 border-2 transition-all hover:shadow-lg group"
                                style={{
                                    backgroundColor: `${product.color}10`, // اوپاسیتی ۱۰٪ هماهنگ با چارت
                                    borderColor: `${product.color}30`
                                }}
                            >


                                {/* تصویر محصول */}
                                <Link href={`/products/${product.slug || product._id}`} className="shrink-0">
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-white/50 relative shadow-inner">
                                        <img
                                            src={product.mainImage || product.images?.[0]}
                                            alt={product.name || product.title}
                                            className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                </Link>

                                {/* محتوای متنی */}
                                <div className="flex-1 flex flex-col items-start overflow-hidden py-1">
                                    <Link
                                        href={`/products/${product.slug || product._id}`}
                                        className="font-extrabold text-[13px] leading-tight text-neutral-800 line-clamp-2 hover:text-[var(--color-primary)] transition tracking-tight"
                                    >
                                        {product.title || product.name}
                                    </Link>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: product.color }}></span>
                                        <span className="text-[10px] font-bold text-neutral-500 truncate opacity-80">
                                            {product.category?.title || "دسته نامشخص"}
                                        </span>
                                    </div>
                                </div>

                                {/* نشانگر رنگی کناری (تزیینی) */}
                                <div
                                    className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full"
                                    style={{ backgroundColor: product.color }}
                                ></div>
                                {/* دکمه حذف - سمت راست کارت */}
                                <button
                                    onClick={() => handleRemoveProduct(product._id)}
                                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm shrink-0"
                                    title="حذف از مقایسه"
                                >
                                    <FiTrash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 2. نمودار عنکبوتی (Radar Chart) */}
                    <div className=" items-center mb-16 bg-white p-8 rounded-[var(--radius)] shadow-sm border border-neutral-100">
                        <div className="w-full h-[500px]">
                            <CompareChart products={selectedProducts} categoryStats={lockedCategory?.technicalStats} />
                        </div>
                    </div>
                    {/* بعد از بخش چارت و مقایسه فعلی */}
                    {lockedCategory && (
                        <BestInCategory
                            categoryId={lockedCategory._id}
                            onAddProduct={handleSelectProduct}
                        />
                    )}
                    {/* 4. توضیحات شاخص‌های فنی */}
                    <div className="mt-16">
                        <h3 className="text-2xl font-bold mb-8 border-r-4 border-[var(--color-primary)] pr-3">
                            راهنمای شاخص‌های {lockedCategory?.title}
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {lockedCategory?.technicalStats?.map((stat) => (
                                <div key={stat.name} className="bg-white p-6 rounded-[var(--radius)] border border-neutral-100 shadow-sm hover:shadow-md transition">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold">
                                            <MdDescription/>
                                        </div>
                                        <h4 className="font-bold text-lg">{stat.label}</h4>
                                    </div>
                                    <p className="text-sm text-neutral-600 leading-relaxed text-justify">
                                        {stat.description || 'توضیحاتی برای این شاخص ثبت نشده است.'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

// ==========================================
// کامپوننت نمودار عنکبوتی (Recharts)
// ==========================================
function CompareChart({ products, categoryStats }) {
    if (!categoryStats || categoryStats.length === 0)
        return <div className="h-full flex items-center justify-center text-neutral-400">نمودار برای این دسته تعریف نشده است.</div>;

    const chartData = categoryStats.map((stat) => {
        let dataPoint = { subject: stat.label, fullMark: 100 };

        products.forEach((prod) => {
            // دسترسی مستقیم به کلید در آبجکت technicalStats
            // مثلاً: prod.technicalStats["power"]
            const score = prod.technicalStats?.[stat.name] || 0;
            dataPoint[prod._id] = score;
        });

        return dataPoint;
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                <PolarGrid stroke="#e5e5e5" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 'bold' }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af' }} />
                <Tooltip
                    contentStyle={{
                        borderRadius: 'var(--radius)',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        direction: 'rtl'
                    }}
                    formatter={(value, name, props) => {
                        // value: امتیاز محصول (مثلا 85)
                        // props.payload.subject: نام شاخص به فارسی (مثلا قدرت)
                        const label = props.payload.subject;
                        return [`${value} از 100`, label];
                    }}
                    // برای اینکه در بالای تول‌تیپ اسم محصول انتخاب شده را ببینیم
                    labelFormatter={(value) => {
                        return `شاخص: ${value}`;
                    }}
                />
                {products.map((product) => (
                    <Radar
                        key={product._id}
                        name={product._id}
                        dataKey={product._id}
                        stroke={product.color}
                        strokeWidth={2}
                        fill={product.color}
                        fillOpacity={0.2}
                    />
                ))}
            </RadarChart>
        </ResponsiveContainer>
    );
}

// ==========================================
// کامپوننت برترین ها در هر شاخص
// ==========================================


function BestInCategory({ categoryId, onAddProduct }) {
    const [bests, setBests] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBests() {
            if (!categoryId) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/compare/best-in-category?categoryId=${categoryId}`);
                const data = await res.json();
                setBests(data.bests || {});
            } catch (err) {
                console.error("خطا در دریافت برترین‌ها", err);
            } finally {
                setLoading(false);
            }
        }
        fetchBests();
    }, [categoryId]);

    if (loading) return <div className="p-10 text-center animate-pulse text-neutral-400">در حال یافتن برترین‌های کل فروشگاه...</div>;
    if (Object.keys(bests).length === 0) return null;

    return (
        <div className="mt-10">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[var(--color-primary)]">
                <span className="w-2 h-7 bg-[var(--color-secondary)] rounded-full"></span>
                برترین‌های کل دسته‌بندی
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(bests).map(([statName, data]) => (
                    <div
                        key={statName}
                        onClick={() => onAddProduct(data.product)}
                        className="group cursor-pointer relative bg-white border border-neutral-100 p-4 rounded-[var(--radius)] shadow-sm hover:shadow-xl hover:border-[var(--color-primary)] transition-all duration-300"
                    >
                        {/* امتیاز بزرگ در پس زمینه */}
                        <div className="absolute top-2 left-3 text-3xl font-bold opacity-10 text-[var(--color-primary)] group-hover:opacity-30 transition-opacity">
                            {data.score}
                        </div>

                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-tighter bg-[var(--color-primary)]/20 px-2 py-0.5 rounded">
                                بهترین در {data.label}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white border border-neutral-50">
                                <img
                                    src={data.product.mainImage || '/placeholder.png'}
                                    alt={data.product.nmae}
                                    className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>

                            <div className="flex flex-col min-w-0">
                                <h4 className="font-bold text-sm truncate leading-tight text-[var(--color-text)] mb-1">
                                    {data.product.title || data.product.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[var(--color-primary)] font-bold">
                                        امتیاز: {data.score} از ۱۰۰
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* دکمه اضافه کردن تعاملی */}
                        <div className="mt-3 flex items-center justify-center w-full py-1 border-t border-dashed border-neutral-100 text-[10px] font-bold text-neutral-400 group-hover:text-[var(--color-primary)] transition-colors">
                            + کلیک برای اضافه کردن به مقایسه
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}