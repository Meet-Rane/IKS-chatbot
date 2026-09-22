import styles from "./ThinkingBubble.module.css";

export function ThinkingBubble() {
  return (
    <div className={styles.message}>
      <div className={`${styles.avatar} ${styles.agent}`}>IKS</div>
      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.sender}>IKS Archive</span>
        </div>
        <div className={styles.bubble}>
          <div className={styles.dots}>
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
