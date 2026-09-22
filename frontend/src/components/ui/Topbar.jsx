import styles from "./Topbar.module.css";

export function Topbar({ status, modelInfo, provider, setProvider, providers, onClear }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>ॐ</div>
        <div>
          <div className={styles.brandTitle}>IKS ARCHIVE</div>
          <div className={styles.brandSub}>Indian Knowledge Systems — Retrieval Interface</div>
        </div>
      </div>

      <div className={styles.right}>
        {providers && (
          <select
            className={styles.providerSelect}
            value={provider || providers.active}
            onChange={e => setProvider(e.target.value)}
            title="Switch AI provider"
          >
            {Object.entries(providers.available).map(([key, val]) => (
              <option key={key} value={key}>
                {key.toUpperCase()} — {val.model}
              </option>
            ))}
          </select>
        )}

        {modelInfo && (
          <div className={styles.modelPill}>
            {modelInfo.model}
          </div>
        )}

        <div className={`${styles.statusPill} ${status === "online" ? styles.online : styles.offline}`}>
          <span className={styles.statusDot} />
          {status === "checking" ? "Connecting…" : status === "online" ? "Active" : "Offline"}
        </div>

        <button className={styles.clearBtn} onClick={onClear}>Clear</button>
      </div>
    </header>
  );
}
