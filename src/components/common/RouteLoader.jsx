"use client";

import Image from "next/image";
import styles from "./RouteLoader.module.css";

export default function RouteLoader() {
  return (
    <div className={styles.overlay} role="status" aria-label="در حال بارگذاری">
      <div className={styles.panel}>
        <Image
          src="/logo/logo.svg"
          alt="تنادور"
          width={180}
          height={72}
          priority
          className={styles.logo}
        />
        <span className={styles.loader} aria-hidden="true" />
      </div>
    </div>
  );
}
