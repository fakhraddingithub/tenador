"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { FiChevronDown, FiFileText, FiMessageSquare, FiSettings, FiShield } from "react-icons/fi";
import styles from "./MobileProductTabs.module.css";

const icons = { health: FiShield, description: FiFileText, attributes: FiSettings, reviews: FiMessageSquare };
const mobileQuery = "(max-width: 639px)";
const subscribe = (callback) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getSnapshot = () => window.matchMedia(mobileQuery).matches;
const getServerSnapshot = () => false;

export function useMobileProductLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function MobileProductTabs({ tabs, renderContent }) {
  const [openSection, setOpenSection] = useState("description");
  const instanceId = useId();
  const orderedTabs = [...tabs.filter((tab) => tab.id !== "description"), ...tabs.filter((tab) => tab.id === "description")];

  return (
    <div className={styles.accordion} dir="rtl">
      {orderedTabs.map((tab) => {
        const Icon = icons[tab.id] || FiFileText;
        const isOpen = openSection === tab.id;
        const panelId = `${instanceId}-${tab.id}`;
        return (
          <section key={tab.id} className={styles.section} data-open={isOpen}>
            <h3 className={styles.heading}>
              <button
                id={`${panelId}-heading`}
                type="button"
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenSection(isOpen ? null : tab.id)}
              >
                <span className={styles.iconBox}>
                  {tab.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tab.iconUrl} alt="" className={styles.icon} />
                  ) : <Icon className={styles.icon} aria-hidden="true" />}
                </span>
                <span className={styles.title}>{tab.label}</span>
                {tab.count > 0 && <span className={styles.count}>{tab.count.toLocaleString("fa-IR")}</span>}
                <FiChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={`${panelId}-heading`} hidden={!isOpen} className={styles.content}>
              {isOpen ? renderContent(tab.id) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
