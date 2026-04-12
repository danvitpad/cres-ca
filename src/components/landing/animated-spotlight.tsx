/** --- YAML
 * name: AnimatedSpotlight
 * description: Fresha-style animated gradient spotlight using original SVG blobs with CSS keyframe rotation
 * --- */

'use client';

import styles from './animated-spotlight.module.css';

export function AnimatedSpotlight() {
  return (
    <div className={styles.container} aria-hidden>
      {/* Main rotation — pink blob */}
      <div className={`${styles.rotation} ${styles.rotationMain}`}>
        <span
          className={`${styles.spotlight} ${styles.spotlightImg1}`}
        />
      </div>

      {/* Satellite rotation — lavender blob */}
      <div className={`${styles.rotation} ${styles.rotationSatellite}`}>
        <span
          className={`${styles.spotlight} ${styles.spotlightImg2}`}
        />
      </div>
    </div>
  );
}
