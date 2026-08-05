export default function HomeSectionHeading({ title, highlight, subtitle, id }) {
  return (
    <div className="relative">
      <h2 id={id} className="text-2xl font-black leading-tight text-gray-900 md:text-4xl">
        {title.split(" ").map((word, index) => (
          <span key={`${word}-${index}`} className={word === highlight ? "text-[var(--color-primary)]" : ""}>
            {word}{" "}
          </span>
        ))}
      </h2>
      <p className="mt-2 max-w-md border-r-2 border-[var(--color-primary)]/20 pr-3 text-sm font-light italic text-gray-500 md:mt-4 md:border-r-4 md:pr-4 md:text-lg">
        {subtitle}
      </p>
    </div>
  );
}
