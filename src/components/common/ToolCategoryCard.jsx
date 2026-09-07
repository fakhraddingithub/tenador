import Image from 'next/image';
import Link from 'next/link';
import { FiGrid } from 'react-icons/fi';
import styles from './ToolCategoryCard.module.css';

export function toolCategoryTitle(category) {
  const title = category.title?.trim() || '';
  const sport = category.sportTitle?.trim();
  return sport && !title.endsWith(sport) ? title + ' ' + sport : title;
}

export default function ToolCategoryCard({ category, href, onClick }) {
  const content = (
    <>
      {category.image && (
        <Image
          src={category.image}
          alt=""
          fill
          sizes="(max-width: 767px) 50vw, 25vw"
          className={styles.background}
        />
      )}
      <span className={styles.shade} aria-hidden="true" />
      <span className={styles.warmGlow} aria-hidden="true" />
      <span className={styles.goldGlow} aria-hidden="true" />
      <span className={styles.caption}>
        <span className={styles.icon} aria-hidden="true">
          {category.icon ? (
            <Image src={category.icon} alt="" width={36} height={36} />
          ) : (
            <FiGrid size={32} />
          )}
        </span>
        <span className={styles.title}>{toolCategoryTitle(category)}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={styles.card}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick} className={styles.card}>{content}</button>
  );
}
