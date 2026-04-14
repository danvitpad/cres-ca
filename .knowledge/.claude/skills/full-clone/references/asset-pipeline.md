# Asset Pipeline Reference

## Extract & Download All Assets

Collects every asset URL on the page: fonts, images, SVGs, icons, videos.

### 1. Collect All Asset URLs

```javascript
(function() {
  const assets = {
    fonts: new Set(),
    images: new Set(),
    svgInline: [],
    icons: new Set(),
    videos: new Set(),
    cssFiles: new Set(),
    jsFiles: new Set()
  };

  const origin = location.origin;

  // --- Fonts from @font-face rules ---
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          const src = rule.style.getPropertyValue('src');
          const urls = src.match(/url\(["']?([^"')]+)["']?\)/g);
          if (urls) {
            urls.forEach(u => {
              const url = u.replace(/url\(["']?|["']?\)/g, '');
              assets.fonts.add(new URL(url, sheet.href || origin).href);
            });
          }
        }
        // CSS file imports
        if (rule instanceof CSSImportRule && rule.href) {
          assets.cssFiles.add(rule.href);
        }
      }
    } catch(e) { /* cross-origin */ }
  }

  // Also check <link> preload fonts
  document.querySelectorAll('link[rel="preload"][as="font"], link[rel="prefetch"][as="font"]').forEach(el => {
    assets.fonts.add(new URL(el.href, origin).href);
  });

  // Google Fonts / external font links
  document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"], link[href*="use.typekit"]').forEach(el => {
    assets.fonts.add(el.href);
  });

  // --- Images ---
  document.querySelectorAll('img[src]').forEach(el => {
    assets.images.add(new URL(el.src, origin).href);
    if (el.srcset) {
      el.srcset.split(',').forEach(s => {
        const url = s.trim().split(' ')[0];
        if (url) assets.images.add(new URL(url, origin).href);
      });
    }
  });

  // Background images in CSS
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const urls = bg.match(/url\(["']?([^"')]+)["']?\)/g);
      if (urls) {
        urls.forEach(u => {
          const url = u.replace(/url\(["']?|["']?\)/g, '');
          if (!url.startsWith('data:')) assets.images.add(new URL(url, origin).href);
        });
      }
    }
  });

  // <picture> sources
  document.querySelectorAll('source[srcset]').forEach(el => {
    el.srcset.split(',').forEach(s => {
      const url = s.trim().split(' ')[0];
      if (url) assets.images.add(new URL(url, origin).href);
    });
  });

  // --- Inline SVGs ---
  document.querySelectorAll('svg').forEach((svg, i) => {
    const svgString = new XMLSerializer().serializeToString(svg);
    // Only save unique SVGs (by viewBox + path content)
    const vb = svg.getAttribute('viewBox') || `${svg.clientWidth}x${svg.clientHeight}`;
    const paths = svg.querySelectorAll('path').length;
    assets.svgInline.push({
      index: i,
      viewBox: vb,
      pathCount: paths,
      size: svgString.length,
      context: svg.closest('button, a, [class*="icon"], [class*="logo"]')?.className?.toString().slice(0, 60) || 'standalone',
      markup: svgString.length < 3000 ? svgString : '[too large — extract separately]'
    });
  });

  // SVG files loaded via <img> or <use>
  document.querySelectorAll('img[src$=".svg"], use[href], use[xlink\\:href]').forEach(el => {
    const url = el.src || el.getAttribute('href') || el.getAttribute('xlink:href');
    if (url) assets.icons.add(new URL(url, origin).href);
  });

  // --- Favicon / Apple touch icons ---
  document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]').forEach(el => {
    assets.icons.add(new URL(el.href, origin).href);
  });

  // --- Videos ---
  document.querySelectorAll('video source[src], video[src]').forEach(el => {
    assets.videos.add(new URL(el.src, origin).href);
  });

  // --- External CSS/JS ---
  document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
    assets.cssFiles.add(el.href);
  });

  // Convert Sets to arrays
  const result = {};
  for (const [key, val] of Object.entries(assets)) {
    result[key] = Array.isArray(val) ? val : [...val];
  }
  result.summary = {
    fonts: result.fonts.length,
    images: result.images.length,
    inlineSvgs: result.svgInline.length,
    icons: result.icons.length,
    videos: result.videos.length
  };

  return JSON.stringify(result, null, 2);
})();
```

### 2. Font Family Mapping

Maps every font-family used on the page to where it's loaded from, so we can replicate the exact font stack.

```javascript
(function() {
  const fontMap = {};

  // Collect all used font families from elements
  document.querySelectorAll('*').forEach(el => {
    const family = getComputedStyle(el).fontFamily;
    if (family && !fontMap[family]) {
      fontMap[family] = {
        usedBy: el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].slice(0,2).join('.') : ''),
        weights: new Set(),
        styles: new Set()
      };
    }
    if (fontMap[family]) {
      fontMap[family].weights.add(getComputedStyle(el).fontWeight);
      fontMap[family].styles.add(getComputedStyle(el).fontStyle);
    }
  });

  // Collect @font-face declarations
  const fontFaces = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          fontFaces.push({
            family: rule.style.getPropertyValue('font-family').replace(/["']/g, ''),
            weight: rule.style.getPropertyValue('font-weight') || '400',
            style: rule.style.getPropertyValue('font-style') || 'normal',
            src: rule.style.getPropertyValue('src'),
            display: rule.style.getPropertyValue('font-display') || 'auto'
          });
        }
      }
    } catch(e) {}
  }

  // Convert sets
  for (const key of Object.keys(fontMap)) {
    fontMap[key].weights = [...fontMap[key].weights];
    fontMap[key].styles = [...fontMap[key].styles];
  }

  return JSON.stringify({ usedFamilies: fontMap, fontFaces }, null, 2);
})();
```

### 3. Download Script Generator

After collecting URLs, generate a bash script to download all assets locally.

```javascript
(function() {
  // This assumes you've run the asset collection script and have the result
  const assets = JSON.parse(document.querySelector('#__asset_data')?.textContent || '{}');

  // In practice, use the output from step 1 directly
  const commands = [];
  const dirs = ['public/fonts', 'public/images', 'public/icons', 'public/svg'];

  commands.push('#!/bin/bash');
  commands.push('# Auto-generated asset download script');
  commands.push(dirs.map(d => `mkdir -p ${d}`).join('\n'));
  commands.push('');

  // Generate curl/wget commands grouped by type
  // In reality, the agent will use fetch/download tools instead of bash
  return JSON.stringify({
    instructions: [
      'For each font URL: download to public/fonts/, preserve filename',
      'For each image URL: download to public/images/, preserve filename',
      'For each SVG icon URL: download to public/icons/, preserve filename',
      'For each inline SVG: save markup to public/svg/<context-name>.svg',
      'Update Tailwind config with exact font-family stacks',
      'Create @font-face declarations in globals.css',
      'Replace all external image URLs with local /images/ paths'
    ]
  }, null, 2);
})();
```

### 4. Tailwind Theme Generator

Generate a Tailwind config extension from extracted design tokens.

```javascript
(function() {
  // Requires the design tokens from visual-extraction.md to have been captured
  // This maps raw computed values to a Tailwind theme extension

  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) {
              cssVars[prop] = rootStyles.getPropertyValue(prop).trim();
            }
          }
        }
      }
    } catch(e) {}
  }

  // Group CSS variables by probable category
  const theme = { colors: {}, spacing: {}, borderRadius: {}, fontFamily: {}, fontSize: {}, boxShadow: {} };

  for (const [varName, value] of Object.entries(cssVars)) {
    const name = varName.replace('--', '').replace(/-/g, '_');
    if (value.match(/^(#|rgb|hsl)/)) {
      theme.colors[name] = `var(${varName})`;
    } else if (value.match(/^\d+(\.\d+)?(px|rem|em)$/)) {
      theme.spacing[name] = `var(${varName})`;
    } else if (varName.includes('radius')) {
      theme.borderRadius[name] = `var(${varName})`;
    } else if (varName.includes('shadow')) {
      theme.boxShadow[name] = `var(${varName})`;
    }
  }

  // Clean empty categories
  for (const key of Object.keys(theme)) {
    if (Object.keys(theme[key]).length === 0) delete theme[key];
  }

  return JSON.stringify({
    tailwindExtend: theme,
    cssVariables: cssVars,
    instruction: 'Add cssVariables to globals.css :root, add tailwindExtend to tailwind.config extend'
  }, null, 2);
})();
```
