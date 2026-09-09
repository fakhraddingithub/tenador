/** Keep the purchased product and variant readable in narrow order summaries. */
export default function FlowProductIdentity({ name, variantLabel }) {
  return (
    <div className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-start">
      <bdi dir="auto" className="block text-xs font-semibold leading-relaxed text-gray-800">
        {name || "محصول انتخاب‌شده"}
      </bdi>
      {variantLabel && (
        <bdi dir="auto" className="mt-0.5 block text-xs leading-relaxed text-gray-600">
          {variantLabel}
        </bdi>
      )}
    </div>
  );
}
