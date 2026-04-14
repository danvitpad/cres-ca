# Visual Extraction Reference

## Design Tokens Extraction (Run First on Any Page)

Extracts the site's complete design system: colors, fonts, spacing, shadows, radii, breakpoints.

```javascript
(function() {
  const tokens = { colors: new Set(), fonts: new Set(), fontSizes: new Set(), spacing: new Set(), radii: new Set(), shadows: new Set(), borders: new Set(), transitions: new Set() };

  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const s = getComputedStyle(el);

    // Colors
    [s.color, s.backgroundColor, s.borderColor, s.outlineColor].forEach(c => {
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' && c !== 'inherit') tokens.colors.add(c);
    });

    // Fonts
    tokens.fonts.add(s.fontFamily);
    tokens.fontSizes.add(s.fontSize);

    // Spacing (padding/margin — only non-zero)
    [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft,
     s.marginTop, s.marginRight, s.marginBottom, s.marginLeft,
     s.gap, s.rowGap, s.columnGap].forEach(v => {
      if (v && v !== '0px' && v !== 'normal' && v !== 'auto') tokens.spacing.add(v);
    });

    // Radii
    if (s.borderRadius && s.borderRadius !== '0px') tokens.radii.add(s.borderRadius);

    // Shadows
    if (s.boxShadow && s.boxShadow !== 'none') tokens.shadows.add(s.boxShadow);

    // Borders
    if (s.borderWidth && s.borderWidth !== '0px') {
      tokens.borders.add(`${s.borderWidth} ${s.borderStyle} ${s.borderColor}`);
    }

    // Transitions / animations
    if (s.transition && s.transition !== 'all 0s ease 0s' && s.transition !== 'none 0s ease 0s') tokens.transitions.add(s.transition);
    if (s.animationName && s.animationName !== 'none') tokens.transitions.add(`animation: ${s.animationName} ${s.animationDuration} ${s.animationTimingFunction}`);
  });

  // Convert Sets to sorted arrays
  const result = {};
  for (const [key, val] of Object.entries(tokens)) {
    result[key] = [...val].sort();
  }

  // Extract CSS custom properties from :root
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
    } catch(e) { /* cross-origin sheet */ }
  }
  result.cssVariables = cssVars;

  return JSON.stringify(result, null, 2);
})();
```

## Per-Component Deep Extraction

For each visually distinct component, extract its exact computed styles. Run this on a specific element by passing a CSS selector.

```javascript
(function(selector) {
  const el = document.querySelector(selector);
  if (!el) return JSON.stringify({ error: 'Element not found: ' + selector });

  function extractStyles(element, depth = 0, maxDepth = 4) {
    if (depth > maxDepth) return null;
    const s = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const node = {
      tag: element.tagName.toLowerCase(),
      classes: [...element.classList].join(' '),
      text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3
        ? element.textContent.trim().slice(0, 80) : null,
      rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      styles: {
        // Layout
        display: s.display,
        position: s.position,
        flexDirection: s.flexDirection !== 'row' ? s.flexDirection : undefined,
        alignItems: s.alignItems !== 'normal' ? s.alignItems : undefined,
        justifyContent: s.justifyContent !== 'normal' ? s.justifyContent : undefined,
        gap: s.gap !== 'normal' ? s.gap : undefined,
        gridTemplateColumns: s.gridTemplateColumns !== 'none' ? s.gridTemplateColumns : undefined,
        overflow: s.overflow !== 'visible' ? s.overflow : undefined,

        // Box model
        width: s.width, height: s.height,
        padding: s.padding !== '0px' ? s.padding : undefined,
        margin: s.margin !== '0px' ? s.margin : undefined,
        border: s.borderWidth !== '0px' ? `${s.borderWidth} ${s.borderStyle} ${s.borderColor}` : undefined,
        borderRadius: s.borderRadius !== '0px' ? s.borderRadius : undefined,
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : undefined,

        // Typography
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing !== 'normal' ? s.letterSpacing : undefined,
        textTransform: s.textTransform !== 'none' ? s.textTransform : undefined,
        color: s.color,

        // Background
        backgroundColor: s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : undefined,
        backgroundImage: s.backgroundImage !== 'none' ? s.backgroundImage : undefined,

        // Effects
        opacity: s.opacity !== '1' ? s.opacity : undefined,
        transform: s.transform !== 'none' ? s.transform : undefined,
        transition: (s.transition && s.transition !== 'all 0s ease 0s') ? s.transition : undefined,
        cursor: s.cursor !== 'auto' ? s.cursor : undefined,
      },
      children: []
    };

    // Remove undefined values
    node.styles = Object.fromEntries(Object.entries(node.styles).filter(([,v]) => v !== undefined));

    // Recurse into children
    for (const child of element.children) {
      const childNode = extractStyles(child, depth + 1, maxDepth);
      if (childNode) node.children.push(childNode);
    }
    return node;
  }

  return JSON.stringify(extractStyles(el), null, 2);
})('SELECTOR_HERE');
```

## Hover / Focus / Active State Capture

Captures visual changes on hover, focus, and active states for interactive elements.

```javascript
(function() {
  const interactiveElements = document.querySelectorAll(
    'a, button, input, textarea, select, [role="button"], [tabindex], ' +
    '[class*="hover"], [class*="btn"], [class*="link"], [class*="card"]'
  );

  const stateChanges = [];

  interactiveElements.forEach((el, i) => {
    if (i > 100) return; // Limit to 100 elements
    const baseStyles = {
      color: getComputedStyle(el).color,
      backgroundColor: getComputedStyle(el).backgroundColor,
      borderColor: getComputedStyle(el).borderColor,
      boxShadow: getComputedStyle(el).boxShadow,
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
      textDecoration: getComputedStyle(el).textDecoration,
      outline: getComputedStyle(el).outline,
    };

    // Check CSS rules for :hover, :focus, :active pseudo-classes
    const hoverRules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && (
            rule.selectorText.includes(':hover') ||
            rule.selectorText.includes(':focus') ||
            rule.selectorText.includes(':active')
          )) {
            try {
              if (el.matches(rule.selectorText.replace(/:hover|:focus|:active|:focus-visible|:focus-within/g, ''))) {
                const props = {};
                for (let j = 0; j < rule.style.length; j++) {
                  const prop = rule.style[j];
                  props[prop] = rule.style.getPropertyValue(prop);
                }
                const pseudo = rule.selectorText.match(/:(\w+(-\w+)?)\s*$/)?.[1] || 'hover';
                hoverRules.push({ pseudo, props });
              }
            } catch(e) {}
          }
        }
      } catch(e) { /* cross-origin */ }
    }

    if (hoverRules.length > 0) {
      stateChanges.push({
        selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].slice(0,2).join('.') : ''),
        text: el.textContent.trim().slice(0, 40),
        baseStyles,
        pseudoStates: hoverRules
      });
    }
  });

  return JSON.stringify(stateChanges, null, 2);
})();
```

## Animation Keyframes Extraction

Extracts all @keyframes defined in stylesheets.

```javascript
(function() {
  const keyframes = {};

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSKeyframesRule) {
          const frames = {};
          for (const kf of rule.cssRules) {
            const props = {};
            for (let i = 0; i < kf.style.length; i++) {
              const prop = kf.style[i];
              props[prop] = kf.style.getPropertyValue(prop);
            }
            frames[kf.keyText] = props;
          }
          keyframes[rule.name] = frames;
        }
      }
    } catch(e) { /* cross-origin */ }
  }

  // Also find elements using these animations
  const usage = {};
  document.querySelectorAll('*').forEach(el => {
    const s = getComputedStyle(el);
    if (s.animationName && s.animationName !== 'none') {
      const sel = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].slice(0,2).join('.');
      usage[s.animationName] = usage[s.animationName] || [];
      usage[s.animationName].push({
        selector: sel,
        duration: s.animationDuration,
        timing: s.animationTimingFunction,
        delay: s.animationDelay,
        iteration: s.animationIterationCount,
        direction: s.animationDirection,
        fillMode: s.animationFillMode,
      });
    }
  });

  return JSON.stringify({ keyframes, usage }, null, 2);
})();
```

## Responsive Breakpoints Detection

Detects media queries used by the site to understand responsive behavior.

```javascript
(function() {
  const breakpoints = new Set();
  const mediaRules = [];

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSMediaRule) {
          breakpoints.add(rule.conditionText);
          // Count how many rules are inside this media query
          mediaRules.push({
            query: rule.conditionText,
            ruleCount: rule.cssRules.length
          });
        }
      }
    } catch(e) {}
  }

  // Deduplicate and sort by rule count (most important breakpoints first)
  const grouped = {};
  mediaRules.forEach(r => {
    grouped[r.query] = (grouped[r.query] || 0) + r.ruleCount;
  });

  return JSON.stringify(
    Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([query, count]) => ({ query, ruleCount: count })),
    null, 2
  );
})();
```
