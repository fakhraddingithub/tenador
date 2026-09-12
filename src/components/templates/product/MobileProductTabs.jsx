"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FiArrowLeft, FiFileText, FiMessageSquare, FiSettings, FiShield } from "react-icons/fi";
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
  const reduceMotion = useReducedMotion();
  const scrollTargetRef = useRef(null);
  const orderedTabs = [...tabs.filter((tab) => tab.id !== "description"), ...tabs.filter((tab) => tab.id === "description")];

  useEffect(() => {
    const request = scrollTargetRef.current;
    if (!openSection || !request) return;

    const { target, initialTop } = request;
    const offset = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
    const startedAt = performance.now();
    let frame;
    let cancelled = false;

    // Track the heading as the previous panel shrinks, rather than scrolling
    // toward an outdated document position after the collapse has finished.
    const followHeading = (now) => {
      if (cancelled || !target.isConnected) return;
      const elapsed = now - startedAt;
      const progress = reduceMotion ? 1 : Math.min(elapsed / 280, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const viewportTop = initialTop + (offset - initialTop) * eased;
      window.scrollTo({
        top: window.scrollY + target.getBoundingClientRect().top - viewportTop,
        behavior: "instant",
      });
      // Keep tracking through the final layout frame of the height animation.
      if (elapsed < (reduceMotion ? 32 : 340)) {
        frame = requestAnimationFrame(followHeading);
      } else {
        scrollTargetRef.current = null;
      }
    };
    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    frame = requestAnimationFrame(followHeading);
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    return () => {
      cancel();
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("wheel", cancel);
    };
  }, [openSection, reduceMotion]);

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
                onClick={(event) => {
                  scrollTargetRef.current = isOpen ? null : {
                    target: event.currentTarget,
                    initialTop: event.currentTarget.getBoundingClientRect().top,
                  };
                  setOpenSection(isOpen ? null : tab.id);
                }}
              >
                <span className={styles.iconBox}>
                  {tab.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tab.iconUrl} alt="" className={styles.icon} />
                  ) : <Icon className={styles.icon} aria-hidden="true" />}
                </span>
                <span className={styles.titleGroup}>
                  <span className={styles.title}>{tab.label}</span>
                  {tab.count > 0 && <span className={styles.count}>{tab.count.toLocaleString("fa-IR")}</span>}
                </span>
                <FiArrowLeft className={styles.chevron} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={`${panelId}-heading`} aria-hidden={!isOpen} inert={!isOpen}>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={tab.id}
                    initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                    animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                    exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                    transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={styles.content}>{renderContent(tab.id)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        );
      })}
    </div>
  );
}
