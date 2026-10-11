import Link from "next/link";
import { ArrowLeft, Compass, Layers3, Tag, SlidersHorizontal } from "lucide-react";
import { getCategoryLabel } from "base/utils/categoryLabel";
import styles from "./ProductExploreNav.module.css";

const titleOf = (entity) => (entity?.title || entity?.name || "").trim();
const pathOf = (...entities) =>
  entities.every((entity) => entity?.slug && titleOf(entity))
    ? `/${entities.map((entity) => encodeURIComponent(entity.slug)).join("/")}`
    : null;

export default function ProductExploreNav({ product }) {
  const { sport, category, brand } = product;
  const categoryLabel = getCategoryLabel({ ...category, sport });
  const links = [
    { key: "sport", hint: "ورزش", label: titleOf(sport), href: pathOf(sport), Icon: Compass },
    { key: "category", hint: "دسته‌بندی", label: categoryLabel, href: pathOf(sport, category), Icon: Layers3 },
    { key: "brand", hint: "برند", label: titleOf(brand), href: pathOf(brand), Icon: Tag },
    {
      key: "collection",
      hint: "بیشتر ببینید",
      label: `${categoryLabel} ${titleOf(brand)}`.trim(),
      href: pathOf(sport, category, brand),
      Icon: SlidersHorizontal,
    },
  ].filter((link) => link.href);

  if (!links.length) return null;

  return (
    <nav className={styles.nav} aria-label="کاوش محصولات مرتبط" dir="rtl">
      <ul className={styles.list}>
        {links.map(({ key, hint, label, href, Icon }) => (
          <li key={key} className={styles.item}>
            <Link
              href={href}
              className={`${styles.link} ${key === "collection" ? styles.collection : ""}`}
            >
              <Icon className={styles.icon} size={17} strokeWidth={1.6} aria-hidden="true" />
              <span className={styles.copy}>
                <span className={styles.hint}>{hint}</span>
                <span className={styles.label}>{label}</span>
              </span>
              <ArrowLeft className={styles.arrow} size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
