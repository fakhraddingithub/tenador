'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FaMagic, FaArrowRight, FaLock, FaRobot, FaClipboardList } from 'react-icons/fa';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import {
  REGENERATED_FIELDS,
  checkRegenerationDraft,
  parseRegenerationDraft,
  saveRegenerationDraft,
} from '@/lib/productRegeneration';
import { showToast } from '@/lib/toast';

/**
 * بازتولیدِ محصول — دو راه برای رسیدن به یک JSON، و یک مسیرِ مشترک بعد از آن:
 * - خودکار: متن → POST /regenerate/generate (پرامپتِ مشترک → providerِ AI)
 * - دستی: متن → پرامپت → AIِ بیرونی → چسباندنِ JSON
 * در هر دو، اینجا فقط ساختار و قالبِ JSON بررسی می‌شود (checkRegenerationDraft).
 * پس از تأیید، JSON در فرمِ ویرایشِ محصول (?regenerate=1) قرار می‌گیرد؛ بررسیِ
 * فیلدهای الزامی و ذخیره آن‌جا انجام می‌شود، مثلِ ساختِ محصول.
 */
const MANUAL_STEPS = [
  { id: 1, label: 'متن خام' },
  { id: 2, label: 'پرامپت AI' },
  { id: 3, label: 'JSON خروجی' },
];

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || '';
const labels = (keys) => keys.map((k) => REGENERATED_FIELDS[k] || k).join('، ');

function ErrorBox({ errors, children }) {
  if (!errors) return null;
  const list = errors.list || [];
  return (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm space-y-2">
      <p className="font-bold">{errors.message}</p>
      {list.length > 1 && (
        <ul className="list-disc pr-5 space-y-1">
          {list.map(({ field, message }, i) => (
            <li key={`${field}-${i}`}><span className="font-mono text-xs" dir="ltr">{field}</span>: {message}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

/** مرحله‌ی تأییدِ JSON — مشترک بین دو حالت. */
function ConfirmPanel({ review, json, product, onConfirm, actions }) {
  const { check, ai } = review;
  const missing = Object.keys(REGENERATED_FIELDS).filter((k) => !check.present.includes(k));
  const imageCount = (product.mainImage ? 1 : 0) + (product.gallery?.length || 0);
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-sm space-y-1.5">
        <p className="font-bold">ساختارِ JSON معتبر است.</p>
        <p>با تأیید، این مقادیر در فرمِ ویرایشِ محصول قرار می‌گیرند تا بررسی و در صورتِ نیاز اصلاحشان کنید. تا زمانی که فرم را ذخیره نکنید چیزی تغییر نمی‌کند.</p>
        {check.present.length > 0 && <p>در فرم قرار می‌گیرد: {labels(check.present)}</p>}
        {missing.length > 0 && <p>در JSON نبودند و مقدارِ فعلی‌شان در فرم می‌ماند: {labels(missing)}</p>}
      </div>

      <div className="flex items-start gap-2 text-sm text-gray-700">
        <FaLock className="mt-1 shrink-0 text-emerald-700" aria-hidden="true" />
        <p>
          تصاویر ({imageCount}) و واریانت‌ها ({product.variants?.length || 0}) دست‌نخورده می‌مانند
          {check.preserved.length > 0 && <> — کلیدهای <span dir="ltr" className="font-mono">{check.preserved.join(', ')}</span> در JSON نادیده گرفته می‌شوند</>}.
        </p>
      </div>
      {check.ignored.length > 0 && (
        <p className="text-sm text-gray-600">کلیدهای ناشناخته (نادیده گرفته می‌شوند): <span dir="ltr" className="font-mono">{check.ignored.join(', ')}</span></p>
      )}
      {ai && <p className="text-xs text-gray-400" dir="ltr">{ai.provider} · {ai.model}</p>}

      <details className="border rounded-xl">
        <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-gray-700">نمایشِ JSON</summary>
        <pre className="text-xs bg-gray-50 p-4 max-h-80 overflow-auto whitespace-pre-wrap" dir="ltr">{json}</pre>
      </details>

      <div className="flex flex-wrap gap-3">
        {actions}
        <Button variant="success" onClick={onConfirm} className="flex-1">
          تأیید JSON و رفتن به فرمِ ویرایش
        </Button>
      </div>
    </div>
  );
}

export default function ProductRegeneratePage() {
  const router = useRouter();
  const { productId } = useParams();
  const { can } = useAdminPermissions();
  const canUseAi = can('ai.productDraft');

  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState(null); // 'auto' | 'manual'; پیش‌فرض پس از دانستنِ دسترسی
  const [step, setStep] = useState(1); // فقط حالتِ دستی
  const [rawContent, setRawContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [json, setJson] = useState('');
  const [review, setReview] = useState(null); // { check, ai? } — JSONِ معتبر، منتظرِ تأیید
  const [errors, setErrors] = useState(null); // { message, list?, recoverable? }
  const [busy, setBusy] = useState(''); // '' | 'prompt' | 'generate'

  const activeMode = mode ?? (canUseAi ? 'auto' : 'manual');

  useEffect(() => {
    let alive = true;
    fetch(`/api/product/${productId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.product) throw new Error(getApiErrorMessage(data, 'محصول یافت نشد'));
        if (alive) setProduct(data.product);
      })
      .catch((err) => alive && setLoadError(err.message));
    return () => { alive = false; };
  }, [productId]);

  const categoryId = idOf(product?.category);
  const editHref = `/p-admin/admin-products/edit/${productId}`;

  function switchMode(next) {
    if (busy) return;
    setMode(next);
    setReview(null);
    setErrors(null);
    if (next === 'manual') setStep(json ? 3 : 1);
  }

  /** خروجیِ خودکار را به حالتِ دستی می‌برد تا ادمین JSON را اصلاح کند. */
  function editJsonManually() {
    setMode('manual');
    setReview(null);
    setErrors(null);
    setStep(3);
  }

  function checkRawContent() {
    if (rawContent.trim().length >= 50) return true;
    setErrors({ message: 'متن محصول خیلی کوتاه است؛ دست‌کم ۵۰ نویسه از توضیحاتِ کاملِ محصول را وارد کنید.' });
    return false;
  }

  // ── خودکار ──
  async function generateAuto() {
    setErrors(null);
    setReview(null);
    if (!checkRawContent()) return;
    setBusy('generate');
    try {
      const { res, data } = await postJson(`/api/product/${productId}/regenerate/generate`, { rawContent });
      if (typeof data.json === 'string') setJson(data.json);
      if (!res.ok) {
        setErrors({
          message: getApiErrorMessage(data, 'بازتولیدِ خودکار انجام نشد'),
          list: data.errors,
          recoverable: typeof data.json === 'string',
        });
        return;
      }
      setReview({ check: data.check, ai: data.ai });
    } catch {
      setErrors({ message: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' });
    } finally {
      setBusy('');
    }
  }

  // ── دستی ──
  async function generatePrompt() {
    setErrors(null);
    if (!checkRawContent()) return;
    setBusy('prompt');
    try {
      const { res, data } = await postJson('/api/ai/product-draft', { categoryId, rawContent });
      if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در ساخت پرامپت'));
      setAiPrompt(data.draft);
      setStep(2);
      showToast.success('پرامپت ساخته شد');
    } catch (err) {
      setErrors({ message: err.message });
    } finally {
      setBusy('');
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      showToast.info('پرامپت کپی شد');
    } catch {
      showToast.error('کپی خودکار ممکن نشد؛ متن را دستی انتخاب و کپی کنید');
    }
  }

  /** همان بررسیِ ساختاری‌ای که روتِ generate روی خروجیِ مدل اجرا می‌کند. */
  function checkManualJson() {
    setErrors(null);
    const parsed = parseRegenerationDraft(json);
    if (parsed.error) {
      setErrors({ message: parsed.error });
      return;
    }
    const check = checkRegenerationDraft(parsed.draft, { categoryId, sportId: idOf(product.category?.sport) });
    if (check.errors.length) {
      setErrors({ message: `JSON قابلِ نگاشت به فرم نیست: ${check.errors[0].message}`, list: check.errors });
      return;
    }
    setReview({ check });
  }

  // ── تأیید (مشترک) → فرمِ ویرایش ──
  function confirmJson() {
    const parsed = parseRegenerationDraft(json);
    if (parsed.error) {
      setErrors({ message: parsed.error });
      setReview(null);
      return;
    }
    if (!saveRegenerationDraft(productId, { draft: parsed.draft, source: activeMode, savedAt: Date.now() })) {
      setErrors({ message: 'مرورگر اجازه‌ی نگه‌داشتنِ موقتِ داده را نمی‌دهد (حالتِ خصوصی یا ذخیره‌سازیِ مسدود)؛ JSON را در فرمِ ویرایش با «ویرایش جیسون» هر بخش وارد کنید.' });
      return;
    }
    router.push(`${editHref}?regenerate=1`);
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100 p-8 text-center space-y-4">
        <p className="text-red-600 font-bold">{loadError}</p>
        <Link href="/p-admin/admin-products" className="text-sm text-[var(--color-primary)] underline">بازگشت به محصولات</Link>
      </div>
    );
  }
  if (!product) return <AdminLoader />;

  const sourceInput = (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-gray-700" htmlFor="raw">متنِ محصول از سایتِ مرجع</label>
      <textarea
        id="raw"
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
        rows={10}
        disabled={busy === 'generate'}
        className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-50"
        placeholder="توضیحات کامل محصول را از هر منبعی اینجا پیست کنید..."
      />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-4 rounded-2xl text-purple-600"><FaMagic size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">بازتولید محصول</h1>
            <p className="text-gray-500 text-sm mt-1">{product.name} · {product.category?.title || '—'}</p>
          </div>
        </div>
        <Link href={editHref} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <FaArrowRight aria-hidden="true" /> بازگشت به ویرایش
        </Link>
      </div>

      {/* Mode selector */}
      <div role="tablist" aria-label="حالتِ بازتولید" className="grid sm:grid-cols-2 gap-3">
        {[
          { id: 'auto', icon: <FaRobot />, title: 'خودکار با AI', text: 'متن را بچسبانید؛ AI با قواعدِ پرامپت و داده‌های سایت JSON را می‌سازد.', disabled: !canUseAi },
          { id: 'manual', icon: <FaClipboardList />, title: 'دستی', text: 'پرامپت را کپی کنید، به AIِ دلخواه بدهید و JSON را برگردانید.' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={activeMode === m.id}
            disabled={m.disabled || (!!busy && activeMode !== m.id)}
            onClick={() => switchMode(m.id)}
            className={`text-right rounded-2xl border-2 p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${activeMode === m.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-gray-100 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-2 font-bold text-gray-800">{m.icon} {m.title}</div>
            <p className="text-xs text-gray-500 mt-1">
              {m.disabled ? 'دسترسیِ «دستیار هوش مصنوعی» را ندارید.' : m.text}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* ── AUTO ── */}
        {activeMode === 'auto' && (
          review ? (
            <ConfirmPanel
              review={review}
              json={json}
              product={product}
              onConfirm={confirmJson}
              actions={(
                <>
                  <Button variant="outline" onClick={() => { setReview(null); setErrors(null); }}>تولیدِ دوباره</Button>
                  <Button variant="secondary" onClick={editJsonManually}>ویرایش دستی JSON</Button>
                </>
              )}
            />
          ) : (
            <div className="space-y-4">
              {sourceInput}
              <ErrorBox errors={errors}>
                {errors?.recoverable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={generateAuto}>تلاش دوباره</Button>
                    <Button size="sm" variant="secondary" onClick={editJsonManually}>اصلاحِ دستیِ JSON خروجی</Button>
                  </div>
                )}
              </ErrorBox>
              <Button onClick={generateAuto} loading={busy === 'generate'} disabled={!!busy} className="w-full" icon={<FaMagic />}>
                {busy === 'generate' ? 'AI در حال تحلیل متن…' : 'بازتولید محصول'}
              </Button>
              {busy === 'generate' && (
                <p className="text-xs text-gray-500 text-center" aria-live="polite">
                  متن تحلیل و با قواعدِ پرامپت و برندها/سری‌های سایت تطبیق داده می‌شود — ممکن است تا یک دقیقه طول بکشد. هنوز چیزی ذخیره نمی‌شود.
                </p>
              )}
            </div>
          )
        )}

        {/* ── MANUAL ── */}
        {activeMode === 'manual' && (
          <>
            <ol className="flex items-center gap-2">
              {MANUAL_STEPS.map((s, i) => (
                <li key={s.id} className="flex items-center flex-1 gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => s.id < step && (setStep(s.id), setReview(null))}
                    disabled={s.id >= step}
                    aria-current={s.id === step ? 'step' : undefined}
                    className={`size-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm
                      ${step >= s.id ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {s.id}
                  </button>
                  <span className="hidden sm:inline text-xs text-gray-600 truncate">{s.label}</span>
                  {i < MANUAL_STEPS.length - 1 && <div className={`h-0.5 flex-1 ${step > s.id ? 'bg-black' : 'bg-gray-200'}`} />}
                </li>
              ))}
            </ol>

            <ErrorBox errors={errors} />

            {step === 1 && (
              <div className="space-y-4">
                {sourceInput}
                {canUseAi ? (
                  <Button onClick={generatePrompt} loading={busy === 'prompt'} disabled={!categoryId} className="w-full">
                    ساخت پرامپت
                  </Button>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-gray-400">دسترسیِ «دستیار هوش مصنوعی» را ندارید — می‌توانید JSON را مستقیم وارد کنید.</p>
                    <Button variant="outline" onClick={() => setStep(3)}>ورود مستقیم JSON</Button>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">پرامپت را کپی کنید و به AI بدهید</span>
                  <Button variant="secondary" size="sm" onClick={copyPrompt}>کپی پرامپت</Button>
                </div>
                <pre className="text-xs bg-gray-50 border rounded-xl p-4 max-h-80 overflow-auto whitespace-pre-wrap" dir="ltr">{aiPrompt}</pre>
                <Button onClick={() => setStep(3)} className="w-full">پاسخِ AI را دارم</Button>
              </div>
            )}

            {step === 3 && (review ? (
              <ConfirmPanel
                review={review}
                json={json}
                product={product}
                onConfirm={confirmJson}
                actions={<Button variant="outline" onClick={() => setReview(null)}>ویرایش JSON</Button>}
              />
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700" htmlFor="ai-json">JSON خروجیِ AI</label>
                <textarea
                  id="ai-json"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={14}
                  dir="ltr"
                  className="w-full border rounded-xl p-3 text-xs font-mono"
                  placeholder='{ "name": "...", ... }'
                />
                <p className="text-xs text-gray-500">
                  فقط ساختار و قالب بررسی می‌شود؛ فیلدهای الزامی در فرمِ ویرایش و هنگامِ ذخیره بررسی می‌شوند. کلیدی که در JSON نباشد مقدارِ فعلی‌اش را نگه می‌دارد.
                </p>
                <Button onClick={checkManualJson} className="w-full">بررسیِ JSON</Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
