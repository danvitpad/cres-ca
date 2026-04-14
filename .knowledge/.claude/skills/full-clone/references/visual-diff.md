# Visual Diff Reference

## Screenshot Comparison Workflow

Use Playwright MCP to take screenshots of the original and clone side-by-side, then compare.

### 1. Capture Original Screenshots

For each page in the sitemap, take screenshots at 3 breakpoints:

```
For each page URL:
  1. Navigate to original URL
  2. Take full-page screenshot at 1440px width → docs/clone-research/screenshots/original/<page>-desktop.png
  3. Take full-page screenshot at 768px width  → docs/clone-research/screenshots/original/<page>-tablet.png
  4. Take full-page screenshot at 390px width  → docs/clone-research/screenshots/original/<page>-mobile.png
  5. For pages with scroll-triggered animations, take viewport-only screenshots at key scroll positions
```

### 2. Capture Clone Screenshots

After building each page, take the same screenshots of the clone:

```
For each built page:
  1. Navigate to localhost clone URL
  2. Take full-page screenshot at 1440px width → docs/clone-research/screenshots/clone/<page>-desktop.png
  3. Take full-page screenshot at 768px width  → docs/clone-research/screenshots/clone/<page>-tablet.png
  4. Take full-page screenshot at 390px width  → docs/clone-research/screenshots/clone/<page>-mobile.png
```

### 3. Visual Comparison Script

Use Playwright to render both screenshots side-by-side and identify differences:

```javascript
// Run via Playwright browser_evaluate or as a Node script
// This creates a visual diff overlay you can inspect

(function() {
  // Assuming both screenshots are loaded as images
  // In practice, use Playwright's screenshot comparison or visual inspection

  const checklist = {
    layout: [
      'Header height and alignment matches',
      'Navigation items match exactly (text, spacing, order)',
      'Main content width and centering matches',
      'Sidebar width and position matches',
      'Footer layout matches',
      'Grid/flex gaps match'
    ],
    typography: [
      'Font family matches on all text',
      'Font sizes match (headings, body, captions)',
      'Font weights match (bold, medium, regular)',
      'Line heights match',
      'Letter spacing matches',
      'Text colors match exactly'
    ],
    colors: [
      'Background colors match on all sections',
      'Border colors match',
      'Button colors match (default, hover, active, disabled)',
      'Link colors match',
      'Badge/tag colors match',
      'Gradient directions and stops match'
    ],
    spacing: [
      'Padding inside cards/containers matches',
      'Margins between sections match',
      'Gap between grid/flex items matches',
      'Icon-to-text spacing matches',
      'Form field spacing matches'
    ],
    components: [
      'Button styles match (size, radius, padding, shadow)',
      'Input field styles match (height, border, radius, focus ring)',
      'Card styles match (shadow, radius, border)',
      'Badge/chip styles match',
      'Avatar sizes and shapes match',
      'Table cell padding and borders match',
      'Dropdown/select appearance matches',
      'Modal overlay and dialog styles match'
    ],
    interactions: [
      'Hover effects match (color change, shadow, scale)',
      'Focus rings match (color, offset, width)',
      'Active/pressed states match',
      'Transition durations and easing match',
      'Scroll behavior matches (smooth, snap)',
      'Loading spinners/skeletons match'
    ],
    responsive: [
      'Breakpoint layout changes match original',
      'Mobile menu behavior matches',
      'Elements hide/show at correct breakpoints',
      'Font size scaling matches',
      'Spacing reduction on mobile matches'
    ]
  };

  return JSON.stringify(checklist, null, 2);
})();
```

### 4. Pixel-Level Comparison via Canvas

If you need a numeric diff score, use this approach:

```javascript
// Load two screenshots as images and compare pixel-by-pixel
// Run in Playwright browser context

async function compareScreenshots(img1Url, img2Url) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const img1 = await loadImage(img1Url);
  const img2 = await loadImage(img2Url);

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);
  canvas.width = width;
  canvas.height = height;

  // Draw img1 and get pixels
  ctx.drawImage(img1, 0, 0);
  const data1 = ctx.getImageData(0, 0, width, height).data;

  // Draw img2 and get pixels
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img2, 0, 0);
  const data2 = ctx.getImageData(0, 0, width, height).data;

  let diffPixels = 0;
  const totalPixels = width * height;
  const diffMap = ctx.createImageData(width, height);

  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i+1] - data2[i+1]);
    const bDiff = Math.abs(data1[i+2] - data2[i+2]);

    const diff = (rDiff + gDiff + bDiff) / 3;

    if (diff > 10) { // Threshold: ignore tiny anti-aliasing differences
      diffPixels++;
      diffMap.data[i] = 255;     // Red
      diffMap.data[i+1] = 0;
      diffMap.data[i+2] = 0;
      diffMap.data[i+3] = Math.min(255, diff * 3); // Intensity
    } else {
      // Show original dimmed
      diffMap.data[i] = data1[i] * 0.3;
      diffMap.data[i+1] = data1[i+1] * 0.3;
      diffMap.data[i+2] = data1[i+2] * 0.3;
      diffMap.data[i+3] = 255;
    }
  }

  ctx.putImageData(diffMap, 0, 0);
  const diffDataUrl = canvas.toDataURL('image/png');

  return {
    matchPercent: ((1 - diffPixels / totalPixels) * 100).toFixed(2) + '%',
    diffPixels,
    totalPixels,
    diffImageDataUrl: diffDataUrl
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

### 5. Region-Based Comparison

For more actionable feedback, compare specific regions:

```javascript
// Define regions to compare independently
const regions = [
  { name: 'header', selector: 'header, [class*="header"], nav' },
  { name: 'hero', selector: '[class*="hero"], main > section:first-child' },
  { name: 'sidebar', selector: 'aside, [class*="sidebar"]' },
  { name: 'footer', selector: 'footer, [class*="footer"]' },
  { name: 'main-content', selector: 'main, [role="main"]' }
];

// For each region:
// 1. Find the element on both original and clone
// 2. Get bounding rect
// 3. Take element-level screenshot (Playwright supports this natively)
// 4. Compare just that region
// This gives you per-component accuracy scores
```

### 6. Automated QA Report Template

After running comparisons, generate a structured report:

```markdown
# Visual QA Report

## Overall Match: XX.X%

### Per-Page Results

| Page | Desktop | Tablet | Mobile | Issues |
|------|---------|--------|--------|--------|
| /home | 97.2% | 95.1% | 93.4% | Hero image sizing |
| /dashboard | 98.1% | 96.3% | 91.2% | Table overflow on mobile |

### Per-Component Results

| Component | Match | Issue |
|-----------|-------|-------|
| Header | 99.1% | - |
| Sidebar | 97.4% | Icon color off |
| DataTable | 95.2% | Row height 2px shorter |
| Footer | 99.8% | - |

### Action Items (sorted by impact)

1. **HIGH** — Hero section: image aspect ratio differs (original 16:9, clone 4:3)
2. **MEDIUM** — DataTable: row padding 12px vs original 14px
3. **LOW** — Footer: social icon spacing 8px vs original 10px
```
