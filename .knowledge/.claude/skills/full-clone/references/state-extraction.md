# State Extraction Reference

## Component State Machine Mapping

For interactive components (dropdowns, modals, tabs, accordions, etc.), map every state and transition.

### Extract All Interactive Elements

```javascript
(function() {
  const interactive = {
    dropdowns: [],
    modals: [],
    tabs: [],
    accordions: [],
    toggles: [],
    tooltips: [],
    carousels: [],
    other: []
  };

  // Dropdowns / Select menus
  document.querySelectorAll(
    '[role="listbox"], [role="combobox"], [role="menu"], [data-radix-dropdown-menu], ' +
    '[data-radix-select], [data-headlessui-state], .dropdown, [aria-haspopup]'
  ).forEach(el => {
    interactive.dropdowns.push({
      trigger: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 50),
      role: el.getAttribute('role'),
      expanded: el.getAttribute('aria-expanded'),
      selector: buildSelector(el),
      type: el.dataset.radixDropdownMenu ? 'radix' :
            el.dataset.headlessuiState !== undefined ? 'headlessui' : 'custom'
    });
  });

  // Modals / Dialogs
  document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], dialog, [data-radix-dialog], ' +
    '.modal, [aria-modal="true"]'
  ).forEach(el => {
    interactive.modals.push({
      title: el.querySelector('[role="heading"], h1, h2, h3')?.textContent.trim(),
      open: el.getAttribute('data-state') === 'open' || el.open || getComputedStyle(el).display !== 'none',
      selector: buildSelector(el)
    });
  });

  // Tabs
  document.querySelectorAll('[role="tablist"]').forEach(tablist => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map(tab => ({
      label: tab.textContent.trim(),
      selected: tab.getAttribute('aria-selected') === 'true',
      controls: tab.getAttribute('aria-controls'),
      selector: buildSelector(tab)
    }));
    interactive.tabs.push({ tabs, selector: buildSelector(tablist) });
  });

  // Accordions
  document.querySelectorAll(
    '[data-radix-accordion], [data-headlessui-state], details, .accordion'
  ).forEach(el => {
    const items = [...el.querySelectorAll(
      '[data-radix-accordion-item], details, .accordion-item'
    )].map(item => ({
      title: item.querySelector('button, summary, [data-radix-accordion-trigger]')?.textContent.trim(),
      open: item.open || item.getAttribute('data-state') === 'open'
    }));
    interactive.accordions.push({ items, selector: buildSelector(el) });
  });

  // Toggle/Switch elements
  document.querySelectorAll('[role="switch"], [data-radix-toggle]').forEach(el => {
    interactive.toggles.push({
      label: el.getAttribute('aria-label') || el.closest('label')?.textContent.trim(),
      checked: el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked',
      selector: buildSelector(el)
    });
  });

  // Carousels / Sliders
  document.querySelectorAll(
    '[role="region"][aria-roledescription="carousel"], .carousel, .swiper, .slick-slider, ' +
    '[data-embla], .splide'
  ).forEach(el => {
    interactive.carousels.push({
      slides: el.querySelectorAll('.slide, .swiper-slide, .slick-slide, [data-embla-slide]').length,
      hasArrows: !!el.querySelector('[aria-label*="prev"], [aria-label*="next"], .arrow, .nav-btn'),
      hasDots: !!el.querySelector('.dots, .pagination, [role="tablist"]'),
      autoplay: el.dataset.autoplay === 'true' || el.classList.contains('autoplay'),
      selector: buildSelector(el)
    });
  });

  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    const classes = [...el.classList].filter(c => !c.startsWith('__')).slice(0, 3).join('.');
    return el.tagName.toLowerCase() + (classes ? '.' + classes : '') +
      (el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '');
  }

  return JSON.stringify(interactive, null, 2);
})();
```

### Click Through All States

After identifying interactive elements, systematically click through each one:

```
For each dropdown:
  1. Click trigger → screenshot open state
  2. List all options
  3. Click an option → capture what changes (table filters? value display?)
  4. Close → screenshot closed state

For each tab:
  1. Click each tab in sequence
  2. Screenshot the content panel for each
  3. Note the transition animation (opacity, slide, none)
  4. Capture any API calls triggered by tab switch

For each modal:
  1. Click the trigger button → screenshot modal
  2. Extract modal content (form fields, text, buttons)
  3. Click cancel/close → verify it closes
  4. Capture the open/close animation (if any)

For each accordion:
  1. Click each item header
  2. Screenshot expanded content
  3. Note: does opening one close others? (single vs multi)
  4. Capture the expand/collapse animation
```

### URL State Mapping

Many dashboard pages store state in the URL:

```javascript
(function() {
  // Current URL params
  const params = Object.fromEntries(new URL(location.href).searchParams);

  // Check for client-side routing state
  const routerState = {
    nextRouter: window.__NEXT_DATA__ ? {
      query: window.__NEXT_DATA__.query,
      page: window.__NEXT_DATA__.page
    } : null,
    historyState: history.state
  };

  // Detect which UI elements modify URL params
  const stateDrivers = [];

  // Find search inputs
  document.querySelectorAll('input[type="search"], input[name="search"], input[name="q"]').forEach(el => {
    stateDrivers.push({ type: 'search', param: el.name || 'search', selector: buildSelector(el) });
  });

  // Find pagination controls
  document.querySelectorAll('[aria-label*="page"], .pagination a, [data-page]').forEach(el => {
    stateDrivers.push({
      type: 'pagination',
      param: 'page',
      current: el.getAttribute('aria-current') === 'page' ? el.textContent.trim() : null
    });
  });

  // Find sort controls
  document.querySelectorAll('[aria-sort], th[data-sort], button[data-sort]').forEach(el => {
    stateDrivers.push({
      type: 'sort',
      field: el.dataset.sort || el.textContent.trim(),
      direction: el.getAttribute('aria-sort')
    });
  });

  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    return el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].slice(0,2).join('.') : '');
  }

  return JSON.stringify({ currentParams: params, routerState, stateDrivers }, null, 2);
})();
```

### Data Table Extraction

Dashboard tables are complex — extract their full structure:

```javascript
(function() {
  const tables = [...document.querySelectorAll('table, [role="grid"], [role="table"]')];

  return JSON.stringify(tables.map(table => {
    // Headers
    const headers = [...table.querySelectorAll('th, [role="columnheader"]')].map(th => ({
      text: th.textContent.trim(),
      sortable: !!th.querySelector('button, [aria-sort]') || th.style.cursor === 'pointer',
      width: getComputedStyle(th).width
    }));

    // Rows (first 5 for pattern detection)
    const rows = [...table.querySelectorAll('tbody tr, [role="row"]')].slice(0, 5).map(tr => {
      const cells = [...tr.querySelectorAll('td, [role="gridcell"]')].map(td => {
        const hasCheckbox = !!td.querySelector('input[type="checkbox"], [role="checkbox"]');
        const hasAvatar = !!td.querySelector('img[class*="avatar"], [class*="avatar"]');
        const hasBadge = !!td.querySelector('[class*="badge"], [class*="tag"], [class*="chip"]');
        const hasActions = !!td.querySelector('button, [role="menuitem"]');

        return {
          text: td.textContent.trim().slice(0, 100),
          type: hasCheckbox ? 'checkbox' : hasAvatar ? 'avatar+text' :
                hasBadge ? 'badge' : hasActions ? 'actions' : 'text'
        };
      });
      return cells;
    });

    // Pagination
    const paginationArea = table.closest('section, .card, [class*="table"]');
    const pagination = paginationArea?.querySelector('.pagination, [aria-label*="pagination"]');

    return {
      headers,
      sampleRows: rows,
      rowCount: table.querySelectorAll('tbody tr, [role="row"]').length,
      hasCheckboxColumn: !!headers.find(h => h.text === '' || h.text === 'Select'),
      hasActionsColumn: !!headers.find(h => h.text.toLowerCase().includes('action')),
      hasPagination: !!pagination,
      hasSearch: !!paginationArea?.querySelector('input[type="search"]')
    };
  }), null, 2);
})();
```
