import styles from "./EmptyState.module.css";

const SUGGESTIONS = [
  { tag: "Philosophy",  text: "What is the significance of the Vedas in Indian Knowledge Systems?", q: "What is the significance of the Vedas in Indian Knowledge Systems?" },
  { tag: "Science",     text: "Aryabhata's contributions to mathematics & astronomy",              q: "Explain the contributions of Aryabhata to Indian mathematics and astronomy." },
  { tag: "Vedic",       text: "The six Vedangas and their roles",                                  q: "What are the six Vedangas and what role does each one play?" },
  { tag: "Linguistics", text: "Panini's Ashtadhyayi explained",                                   q: "Explain Panini's Ashtadhyayi and its importance in the history of linguistics." },
  { tag: "Medicine",    text: "Ayurveda — Charaka & Sushruta Samhitas",                           q: "What is Ayurveda? Explain the Charaka Samhita and Sushruta Samhita." },
  { tag: "Yoga",        text: "Patanjali's Yoga Sutras and the eight limbs",                      q: "Explain the Yoga Sutras of Patanjali and the eight limbs of yoga." },
];

export function EmptyState({ onSuggest }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.seal}>🪔</div>
      <div>
        <div className={styles.title}>Knowledge Retrieval Terminal</div>
        <div className={styles.sub}>
          Query the IKS archive. Topics span Vedic sciences, philosophy,<br />
          mathematics, astronomy, Ayurveda, linguistics, and classical arts.
        </div>
      </div>

      <div className={styles.grid}>
        {SUGGESTIONS.map(({ tag, text, q }) => (
          <button key={tag} className={styles.card} onClick={() => onSuggest(q)}>
            <span className={styles.tag}>{tag}</span>
            <span className={styles.cardText}>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
