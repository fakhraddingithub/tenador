import Image from "next/image";

const assurances = [
  { icon: "authenticity", label: "ضمانت اصل بودن کالا" },
  { icon: "seven-day-return", label: "۷ روز ضمانت بازگشت کالا" },
  { icon: "installments", label: "امکان پرداخت قسطی" },
  { icon: "nationwide-delivery", label: "ارسال به سراسر کشور" },
];

export default function ProductAssurance() {
  return (
    <ul
      aria-label="مزایای خرید از تنادور"
      dir="rtl"
      className="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-gray-100 bg-gray-100 p-0 md:grid-cols-4"
    >
      {assurances.map(({ icon, label }) => (
        <li
          key={icon}
          className="flex min-w-0 items-center justify-start gap-1.5 bg-white px-2 py-2.5 sm:gap-2 sm:px-4 md:justify-center"
        >
          <Image
            src={`/images/purchase-assurance/${icon}.svg`}
            width={40}
            height={40}
            alt=""
            aria-hidden="true"
            unoptimized
            className="size-8 shrink-0 sm:size-10"
          />
          <span className="min-w-0 text-xs leading-6 font-medium text-gray-700">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
