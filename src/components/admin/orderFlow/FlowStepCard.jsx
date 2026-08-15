"use client";

/**
 * src/components/admin/orderFlow/FlowStepCard.jsx
 *
 * کارتِ یک مرحله از فرایند سفارش در گریدِ ادمین.
 *
 * ترتیبِ کارت‌ها در گرید = ترتیبِ آرایه‌ی nodes = ترتیبی که مشتری در مودالِ
 * سفارش می‌بیند (buildStepSequence وقتی لبه‌ای وجود ندارد همان ترتیبِ آرایه را
 * برمی‌گرداند). پس جابه‌جاییِ کارت‌ها همان تغییرِ ترتیبِ مراحل است.
 *
 * الگوی drag & drop عیناً همان صفحه‌ی «مدیریت ورزش‌ها» است: دستگیره‌ی جداگانه
 * روی کارت، بقیه‌ی کارت برای کلیک/ویرایش آزاد. تفاوت: روی دستگیره
 * `touch-action: none` گذاشته شده تا روی موبایل اسکرولِ صفحه ژستِ کشیدن را
 * ندزدد؛ دکمه‌های «جابه‌جایی به عقب/جلو» هم به‌عنوانِ جایگزینِ همیشه‌دردسترس
 * (لمس و کیبورد) کنارِ آن هستند.
 *
 * نکته: این کارت SSR می‌شود، پس className هرگز نباید رشته‌ی چندخطیِ داخلِ
 * attribute باشد (`className="\n  a b\n"`). بیلدِ سرور و کلاینت آن را یکسان
 * نرمال‌سازی نمی‌کنند و hydration خطا می‌دهد. رشته‌ی تک‌خطی یا تمپلیت داخلِ
 * آکولاد امن است.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiGrid,
  FiMenu,
  FiTool,
  FiTrash2,
} from "react-icons/fi";

const TYPE_META = {
  category: {
    color: "#3b82f6",
    label: "دسته‌بندی",
    Icon: FiGrid,
  },
  service: {
    color: "#8b5cf6",
    label: "خدمت",
    Icon: FiTool,
  },
};

const BORDER = "#e8e4df";
const MUTED = "#9c9189";

/** categoryId می‌تواند رشته، ObjectId سریال‌شده یا آبجکتِ populate‌شده باشد. */
export function getNodeCategoryId(node) {
  const cat = node?.categoryId;
  if (!cat) return null;
  return String(typeof cat === "object" ? cat._id || cat.id || "" : cat) || null;
}

/** دسته‌بندیِ متصل به نود را از لیستِ مرجع پیدا می‌کند. */
function findCategory(node, categories) {
  const id = getNodeCategoryId(node);
  if (!id) return null;
  return categories.find((c) => String(c._id) === id) || null;
}

/**
 * پیکربندیِ ناقص = چیزی که باعث می‌شود مرحله برای مشتری بی‌فایده باشد.
 * (اعتبارسنجیِ سختِ ذخیره نیست؛ فقط هشدارِ بصری.)
 */
export function getStepWarning(node, categories) {
  if (node.type === "category") {
    if (!getNodeCategoryId(node)) return "دسته‌بندی انتخاب نشده";
    if (categories.length > 0 && !findCategory(node, categories)) {
      return "دسته‌بندی مرتبط پیدا نشد";
    }
    return null;
  }
  if (node.type === "service") {
    if (!node.serviceName?.trim()) return "نام خدمت وارد نشده";
    if (!node.serviceOptions?.length) return "هیچ گزینه‌ای تعریف نشده";
    const broken = node.serviceOptions.some(
      (o) => !o?.label?.trim() || !o?.value?.trim()
    );
    if (broken) return "بعضی گزینه‌ها عنوان یا مقدار ندارند";
    return null;
  }
  return null;
}

/* ─── بدنه‌ی بصریِ کارت — بدون منطقِ drag، تا در DragOverlay هم استفاده شود ─── */
function StepCardShell({
  node,
  index,
  total,
  categories,
  onEdit,
  onDelete,
  onMoveEarlier,
  onMoveLater,
  dragHandleProps,
  isDragging = false,
  isOverlay = false,
}) {
  const meta = TYPE_META[node.type] || TYPE_META.category;
  const { Icon, color } = meta;
  const category = findCategory(node, categories);
  const warning = getStepWarning(node, categories);
  const optionCount = node.serviceOptions?.length || 0;

  const subtitle =
    node.type === "category"
      ? category?.title || (getNodeCategoryId(node) ? "—" : "بدون دسته‌بندی")
      : node.serviceName?.trim() || "بدون نام خدمت";

  const sportName = category?.sport?.name || category?.sport?.title || null;

  return (
    <div
      className={`
        relative flex h-full flex-col overflow-hidden rounded-2xl bg-white
        transition-shadow duration-200
        ${isOverlay ? "shadow-2xl" : "shadow-sm hover:shadow-md"}
      `}
      style={{
        border: `1px solid ${warning ? "#f5d9a8" : BORDER}`,
        opacity: isDragging && !isOverlay ? 0.4 : 1,
      }}
    >
      {/* نوار رنگیِ نوع مرحله */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* ردیفِ بالا: شماره‌ی مرحله + نوع + دستگیره */}
        <div className="flex items-start gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: color }}
            aria-hidden="true"
          >
            {index + 1}
          </span>

          <span
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
            style={{ background: `${color}14`, color }}
          >
            <Icon size={11} />
            {meta.label}
          </span>

          <span className="flex-1" />

          <button
            type="button"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-[var(--color-primary)] hover:text-white active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            style={{ border: `1px solid ${BORDER}`, touchAction: "none" }}
            aria-label={`جابه‌جایی مرحله ${index + 1}: ${node.label}`}
            title="برای جابه‌جایی بکشید"
          >
            <FiMenu size={15} />
          </button>
        </div>

        {/* عنوان و زیرعنوان */}
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-bold text-gray-800"
            title={node.label}
          >
            {node.label || "بدون عنوان"}
          </h3>
          <p className="mt-1 truncate text-xs" style={{ color: MUTED }} title={subtitle}>
            {subtitle}
            {sportName && (
              <span className="opacity-70"> · {sportName}</span>
            )}
          </p>
        </div>

        {/* برچسب‌ها */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
            style={
              node.required
                ? { background: "#fef3c7", color: "#92400e" }
                : { background: "#f1f5f9", color: "#64748b" }
            }
          >
            {node.required ? "اجباری" : "اختیاری"}
          </span>

          {node.type === "category" && node.allowVariantSelection && (
            <span
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "#eff6ff", color: "#2563eb" }}
            >
              انتخاب واریانت
            </span>
          )}

          {node.type === "service" && (
            <span
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "#f5f3ff", color: "#7c3aed" }}
            >
              {optionCount} گزینه
            </span>
          )}
        </div>

        {/* هشدارِ پیکربندی */}
        {warning && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold"
            style={{ background: "#fffbeb", color: "#b45309" }}
          >
            <FiAlertCircle size={12} className="shrink-0" />
            <span className="truncate">{warning}</span>
          </div>
        )}

        {/* اکشن‌ها — همیشه چسبیده به پایینِ کارت تا ارتفاع‌ها یکدست بماند */}
        <div
          className="mt-auto flex items-center gap-2 pt-3"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          {/* جابه‌جاییِ گام‌به‌گام — جایگزینِ درگ روی لمس و کیبورد */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMoveEarlier}
              disabled={index === 0 || isOverlay}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
              style={{ border: `1px solid ${BORDER}` }}
              aria-label="یک مرحله به عقب"
              title="یک مرحله به عقب"
            >
              <FiChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={onMoveLater}
              disabled={index === total - 1 || isOverlay}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
              style={{ border: `1px solid ${BORDER}` }}
              aria-label="یک مرحله به جلو"
              title="یک مرحله به جلو"
            >
              <FiChevronLeft size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "rgba(0, 66, 37, 0.07)",
              color: "var(--color-primary, #004225)",
              border: "1px solid rgba(0, 66, 37, 0.18)",
            }}
          >
            <FiEdit2 size={12} />
            ویرایش
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-red-100"
            style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#ef4444" }}
            aria-label={`حذف مرحله ${node.label}`}
            title="حذف مرحله"
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── نسخه‌ی قابلِ کشیدن (داخلِ گرید) ─── */
export default function FlowStepCard(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <StepCardShell
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ─── نسخه‌ی شناور زیرِ انگشت/ماوس هنگام کشیدن ─── */
export function FlowStepCardOverlay(props) {
  return <StepCardShell {...props} isOverlay dragHandleProps={{}} />;
}

/**
 * نسخه‌ی بدونِ drag — برای رندرِ سمتِ سرور.
 *
 * چرا لازم است: dnd-kit شناسه‌های داخلی‌اش (`DndDescribedBy-N`) را با یک شمارنده‌ی
 * ماژولی می‌سازد، نه `useId`. آن شمارنده روی سرور بین درخواست‌ها زنده می‌ماند ولی
 * روی کلاینت از صفر شروع می‌شود، پس اگر گرید را SSR کنیم اتریبیوتِ
 * `aria-describedby` بینِ سرور و کلاینت فرق می‌کند و hydration خطا می‌دهد.
 * مارک‌آپِ این نسخه دقیقاً همان نسخه‌ی sortable است، پس تعویضِ بعد از hydration
 * هیچ پرشِ بصری ندارد.
 */
export function FlowStepCardStatic(props) {
  return (
    <div className="h-full">
      <StepCardShell {...props} dragHandleProps={{}} />
    </div>
  );
}
