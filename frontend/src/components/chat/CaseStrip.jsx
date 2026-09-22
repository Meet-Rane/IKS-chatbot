import styles from "./CaseStrip.module.css";

export function CaseStrip() {
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className={styles.strip}>
      <span className={styles.meta}>Case ref: IKS-2026 · Subject: Indian Knowledge Systems · {date}</span>
      <span className={styles.stamp}>OPEN</span>
    </div>
  );
}
