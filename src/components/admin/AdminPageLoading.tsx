import styles from './AdminPageLoading.module.css'

export default function AdminPageLoading() {
  return (
    <div className={styles.loading} role="status" aria-label="正在加载页面" aria-busy="true">
      <span className={styles.label}>正在加载…</span>
      <div aria-hidden="true">
        <div className={styles.filters}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={styles.filter} />
          ))}
        </div>
        <div>
          {Array.from({ length: 8 }, (_, row) => (
            <div key={row} className={styles.row}>
              {Array.from({ length: 4 }, (_, column) => (
                <div key={column} className={styles.cell}>
                  <div
                    className={styles.bar}
                    style={{ width: row % 2 === column % 2 ? '65%' : '85%' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
