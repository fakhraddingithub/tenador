'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { FaMagic, FaArrowRight, FaLock, FaRobot, FaClipboardList } from 'react-icons/fa';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import { invalidateAdminCache } from '@/lib/adminCache';
import { REGENERATED_FIELDS } from '@/lib/productRegeneration';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

/**
 * بازتولیدِ محصول — دو حالت با یک خطِ لوله:
 * - خودکار: متن → POST /regenerate/generate (پرامپتِ مشترک → providerِ AI → پیش‌نمایش)
 * - دستی: متن → پرامپت → AIِ بیرونی → JSON → POST /regenerate (dryRun)
 * اعمال در هر دو حالت POST /regenerate با همان JSON است که سمتِ سرور از نو
 * اعتبارسنجی می‌شود؛ تصاویر و واریانت‌ها آن‌جا محافظت می‌شوند، نه در این صفحه.
 */
const MANUAL_STEPS = [
  { id: 1, label: 'متن خام' },
  { id: 2, label: 'پرامپت AI' },
  { id: 3, label: 'JSON خروجی' },
  { id: 4, label: 'پیش‌نمایش و اعمال' },
];

const FIELD_HINT = 'برای حفظِ مقدارِ فعلیِ یک فیلد (مثلاً قیمتِ واقعی)، کلیدش را از JSON حذف کنید.';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

function ValueView({ value }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return <span className="text-gray-400">—</span>;
  }
  if (Array.isArray(value)) return <span>{value.join('، ')}</span>;
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="text-gray-400">—</span>;
    return (
      <ul className="space-y-0.5">
        {entries.map(([k, v]) => (
          <li key={k}><span className="font-mono text-xs text-gray-500" dir="ltr">{k}</span>: {Array.isArray(v) ? v.join('، ') : String(v)}</li>
        ))}
      </ul>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function ErrorBox({ errors, children }) {
  if (!errors) return null;
  const list = errors.fieldErrors ? Object.entries(errors.fieldErrors) : [];
  return (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm space-y-2">
      <p className="font-bold">{errors.message}</p>
      {list.length > 1 && (
        <ul className="list-disc pr-5 space-y-1">
          {list.map(([key, message]) => (
            <li key={key}><span className="font-mono text-xs" dir="ltr">{key}</span>: {message}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

function PreviewPanel({ preview, product, ai }) {
  const changed = new Set(preview.changes.map((c) => c.field));
  const unchanged = Object.entries(REGENERATED_FIELDS)
    .filter(([key]) => !changed.has(key) && !preview.missing.includes(key))
    .map(([, label]) => label);
  const imageCount = (product.mainImage ? 1 : 0) + (product.gallery?.length || 0);

  return (
    <div className="space-y-5">
      {ai && <p className="text-xs text-gray-400" dir="ltr">{ai.provider} · {ai.model}</p>}

      {preview.changes.length === 0 ? (
        <p className="text-center text-gray-600 py-6">نتیجه هیچ تغییری نسبت به محصولِ فعلی ندارد.</p>
      ) : (
        <section className="space-y-3">
          <h2 className="font-bold text-gray-800">تغییر می‌کند ({preview.changes.length} فیلد)</h2>
          <div className="divide-y border rounded-2xl">
            {preview.changes.map((change) => (
              <div key={change.field} className="p-4 space-y-2">
                <div className="font-bold text-sm text-gray-800">
                  {change.label}
                  {change.field === 'basePrice' && <span className="mr-2 text-xs font-bold text-amber-700">قیمت تغییر می‌کند</span>}
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-red-50/60 rounded-xl p-3 max-h-48 overflow-auto">
                    <div className="text-xs text-gray-500 mb-1">فعلی</div>
                    <ValueView value={change.before} />
                  </div>
                  <div className="bg-emerald-50/60 rounded-xl p-3 max-h-48 overflow-auto">
                    <div className="text-xs text-gray-500 mb-1">جدید</div>
                    <ValueView value={change.after} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {preview.slug && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">
          با تغییرِ نام، نشانیِ صفحه‌ی محصول هم عوض می‌شود: <span dir="ltr" className="font-mono">{preview.slug.before}</span> ← <span dir="ltr" className="font-mono">{preview.slug.after}</span>
        </p>
      )}

      <section className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-sm space-y-1.5">
        <h3 className="font-bold flex items-center gap-2"><FaLock aria-hidden="true" /> حفظ می‌شود</h3>
        <p>تصاویر ({imageCount}) و واریانت‌ها ({product.variants?.length || 0}، با قیمت، تصاویر و بارکدها) — همیشه، بدونِ استثنا.</p>
        {unchanged.length > 0 && <p>بدونِ تغییر: {unchanged.join('، ')}</p>}
        {preview.missing.length > 0 && (
          <p>در JSON نبودند و دست‌نخورده می‌مانند: {preview.missing.map((k) => REGENERATED_FIELDS[k] || k).join('، ')}</p>
        )}
        {preview.preserved.length > 0 && (
          <p>کلیدهای تصویر/واریانت در خروجی نادیده گرفته شدند: <span dir="ltr" className="font-mono">{preview.preserved.join(', ')}</span></p>
        )}
      </section>

      {preview.ignored.length > 0 && (
        <p className="text-sm text-gray-600">کلیدهای ناشناخته (نادیده گرفته شدند): <span dir="ltr" className="font-mono">{preview.ignored.join(', ')}</span></p>
      )}
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
  const [json, setJson] = useState(''); // JSONی که پیش‌نمایش و اعمال رویش انجام می‌شود
  const [preview, setPreview] = useState(null);
  const [aiMeta, setAiMeta] = useState(null);
  const [errors, setErrors] = useState(null); // { message, fieldErrors, recoverable }
  const [busy, setBusy] = useState(''); // '' | 'prompt' | 'generate' | 'preview' | 'apply'

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

  const categoryId = product?.category?._id || product?.category || '';
  const editHref = `/p-admin/admin-products/edit/${productId}`;

  function switchMode(next) {
    if (busy) return;
    setMode(next);
    setPreview(null);
    setErrors(null);
    setAiMeta(null);
    if (next === 'manual') setStep(json ? 3 : 1);
  }

  /** خروجیِ خودکار را به حالتِ دستی می‌برد تا ادمین JSON را اصلاح کند. */
  function editJsonManually() {
    setMode('manual');
    setPreview(null);
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
    setPreview(null);
    if (!checkRawContent()) return;
    setBusy('generate');
    try {
      const { res, data } = await postJson(`/api/product/${productId}/regenerate/generate`, { rawContent });
      setAiMeta(data.ai || null);
      if (typeof data.json === 'string') setJson(data.json);
      if (!res.ok) {
        setErrors({
          message: getApiErrorMessage(data, 'بازتولیدِ خودکار انجام نشد'),
          fieldErrors: data.fieldErrors,
          recoverable: typeof data.json === 'string',
        });
        return;
      }
      setPreview(data.preview);
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

  async function requestPreview() {
    setErrors(null);
    if (!json.trim()) {
      setErrors({ message: 'JSON خروجیِ AI را وارد کنید.' });
      return;
    }
    setBusy('preview');
    try {
      const { res, data } = await postJson(`/api/product/${productId}/regenerate`, { json, dryRun: true });
      if (!res.ok) {
        setErrors({ message: getApiErrorMessage(data, 'JSON نامعتبر است'), fieldErrors: data.fieldErrors });
        return;
      }
      setAiMeta(null);
      setPreview(data);
      setStep(4);
    } catch {
      setErrors({ message: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' });
    } finally {
      setBusy('');
    }
  }

  // ── اعمال (مشترک) ──
  async function apply() {
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'تغییرات اعمال شود؟',
      text: `${preview.changes.length} فیلد بازنویسی می‌شود. تصاویر و واریانت‌ها دست‌نخورده می‌مانند.`,
      showCancelButton: true,
      confirmButtonText: 'اعمال تغییرات',
      cancelButtonText: 'انصراف',
      reverseButtons: true,
    });
    if (!isConfirmed) return;

    setErrors(null);
    setBusy('apply');
    try {
      const { res, data } = await postJson(`/api/product/${productId}/regenerate`, {
        json, expectedUpdatedAt: preview.updatedAt,
      });
      if (!res.ok) {
        const message = getApiErrorMessage(data, 'خطا در بازتولید محصول');
        setErrors({ message, fieldErrors: data.fieldErrors, recoverable: activeMode === 'auto' });
        // نسخه‌ی محصول یا ارجاع‌ها عوض شده — پیش‌نمایشِ فعلی دیگر معتبر نیست
        if (res.status === 409 || res.status === 400) {
          setPreview(null);
          if (activeMode === 'manual') setStep(3);
        }
        showError('بازتولید انجام نشد', message);
        return;
      }
      invalidateAdminCache('/api/product');
      showToast.success(`محصول بازتولید شد (${data.changes?.length ?? 0} فیلد به‌روز شد)`);
      router.push(editHref);
      router.refresh();
    } catch {
      showError('خطا', 'ارتباط با سرور برقرار نشد؛ وضعیتِ محصول را در صفحه‌ی ویرایش بررسی کنید.');
    } finally {
      setBusy('');
    }
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

  const applyBar = (secondary) => (
    <div className="flex flex-wrap gap-3">
      {secondary}
      <Button
        variant="success"
        onClick={apply}
        loading={busy === 'apply'}
        disabled={preview.changes.length === 0 || !!busy}
        className="flex-1"
      >
        اعمال تغییرات روی محصول
      </Button>
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
          { id: 'auto', icon: <FaRobot />, title: 'خودکار با AI', text: 'متن را بچسبانید؛ AI با قواعدِ پرامپت و داده‌های سایت محصول را می‌سازد.', disabled: !canUseAi },
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
          <>
            {!preview && (
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
                    متن تحلیل، با قواعدِ پرامپت و برندها/سری‌های سایت تطبیق و اعتبارسنجی می‌شود — ممکن است تا یک دقیقه طول بکشد. هنوز چیزی ذخیره نمی‌شود.
                  </p>
                )}
              </div>
            )}

            {preview && (
              <div className="space-y-5">
                <PreviewPanel preview={preview} product={product} ai={aiMeta} />
                <ErrorBox errors={errors} />
                {applyBar(
                  <>
                    <Button variant="outline" onClick={() => { setPreview(null); setErrors(null); }} disabled={!!busy}>
                      بازتولیدِ دوباره
                    </Button>
                    <Button variant="secondary" onClick={editJsonManually} disabled={!!busy}>ویرایش دستی JSON</Button>
                  </>,
                )}
              </div>
            )}
          </>
        )}

        {/* ── MANUAL ── */}
        {activeMode === 'manual' && (
          <>
            <ol className="flex items-center gap-2">
              {MANUAL_STEPS.map((s, i) => (
                <li key={s.id} className="flex items-center flex-1 gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => s.id < step && s.id !== 4 && setStep(s.id)}
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

            {step === 3 && (
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
                <p className="text-xs text-gray-500">{FIELD_HINT}</p>
                <Button onClick={requestPreview} loading={busy === 'preview'} className="w-full">
                  بررسی و پیش‌نمایشِ تغییرات
                </Button>
              </div>
            )}

            {step === 4 && preview && (
              <div className="space-y-5">
                <PreviewPanel preview={preview} product={product} />
                {applyBar(
                  <Button variant="outline" onClick={() => { setStep(3); setPreview(null); }} disabled={!!busy}>
                    ویرایش JSON
                  </Button>,
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
