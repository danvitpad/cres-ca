# Deep Interaction Crawler Reference

## Philosophy

A real user doesn't just look at pages — they CLICK things. Every button, every calendar cell, every list item, every icon can trigger something: a modal, a side panel, a dropdown, a navigation, an API call, a state change. This crawler systematically finds and triggers EVERY interactive element on a page and records what happens.

## Step 1: Discover All Clickable Elements

Run this on every page to find everything that can be interacted with:

```javascript
(function() {
  const clickable = [];
  const seen = new Set();

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const tag = el.tagName.toLowerCase();
    const classes = [...el.classList].filter(c => !c.startsWith('_') && !c.startsWith('css-')).slice(0, 3);
    const classStr = classes.length ? '.' + classes.join('.') : '';
    const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
    const ariaLabel = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
    return tag + classStr + role + ariaLabel;
  }

  function getContext(el) {
    // What section of the page is this in?
    const section = el.closest('header, nav, aside, main, footer, [class*="sidebar"], [class*="toolbar"], [class*="calendar"], [class*="modal"], [class*="dialog"], [class*="panel"]');
    return section ? getSelector(section) : 'page-root';
  }

  // All explicitly clickable elements
  document.querySelectorAll(
    'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="option"], ' +
    '[role="link"], [role="checkbox"], [role="switch"], [role="radio"], ' +
    '[onclick], [ng-click], [data-action], [tabindex]:not([tabindex="-1"]), ' +
    'input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], ' +
    'label[for], summary, [class*="btn"], [class*="button"], [class*="clickable"], [class*="selectable"]'
  ).forEach(el => {
    const key = getSelector(el) + '|' + el.textContent.trim().slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);

    clickable.push({
      selector: getSelector(el),
      text: el.textContent.trim().slice(0, 60),
      tag: el.tagName.toLowerCase(),
      type: el.type || el.getAttribute('role') || 'clickable',
      href: el.href || null,
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      visible: el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden',
      context: getContext(el),
      hasPopup: el.getAttribute('aria-haspopup') || null,
      expanded: el.getAttribute('aria-expanded') || null,
      rect: {
        x: Math.round(el.getBoundingClientRect().x),
        y: Math.round(el.getBoundingClientRect().y),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height)
      }
    });
  });

  // Elements with cursor:pointer that aren't in the list above
  document.querySelectorAll('*').forEach(el => {
    if (getComputedStyle(el).cursor === 'pointer' && el.offsetParent !== null) {
      const key = getSelector(el) + '|' + el.textContent.trim().slice(0, 30);
      if (!seen.has(key) && !el.closest('button, a')) {
        seen.add(key);
        clickable.push({
          selector: getSelector(el),
          text: el.textContent.trim().slice(0, 60),
          tag: el.tagName.toLowerCase(),
          type: 'cursor-pointer',
          visible: true,
          context: getContext(el),
          rect: {
            x: Math.round(el.getBoundingClientRect().x),
            y: Math.round(el.getBoundingClientRect().y),
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height)
          }
        });
      }
    }
  });

  // Group by context (section of page)
  const grouped = {};
  clickable.filter(c => c.visible && !c.disabled).forEach(c => {
    if (!grouped[c.context]) grouped[c.context] = [];
    grouped[c.context].push(c);
  });

  return JSON.stringify({
    total: clickable.length,
    visible: clickable.filter(c => c.visible && !c.disabled).length,
    bySection: grouped,
    // Flat list for systematic clicking
    clickQueue: clickable
      .filter(c => c.visible && !c.disabled)
      .map((c, i) => ({ index: i, selector: c.selector, text: c.text, type: c.type, context: c.context }))
  }, null, 2);
})();
```

## Step 2: Systematic Click-Through Protocol

This is the AGENT'S workflow, not a script. The agent must follow this protocol for every page:

```
FOR each page in sitemap:

  1. NAVIGATE to page, wait for networkidle
  2. INJECT network capture script (references/network-capture.md)
  3. RUN the clickable discovery script above
  4. SCREENSHOT the page in its default state

  5. FOR each clickable element (sorted by context: header → main → sidebar → footer):

     a. RECORD current page state:
        - URL
        - Visible modals/panels (document.querySelectorAll('[role="dialog"]:not([hidden]), .modal:visible'))
        - Scroll position

     b. CLICK the element

     c. WAIT 500ms for any animation/transition/network call

     d. DETECT what changed:
        - New modal/dialog appeared? → SCREENSHOT it, extract its component tree, extract its form fields
        - Side panel opened? → SCREENSHOT it, extract its content
        - Dropdown appeared? → SCREENSHOT it, list all options
        - Navigation happened (URL changed)? → Record the destination, go back
        - Calendar view changed? → SCREENSHOT the new view
        - Content updated (table filtered, list sorted)? → Record the change
        - Toast/notification appeared? → Record the message
        - New API call triggered? → Record it from network capture
        - Nothing visible changed? → Record as "no visible effect"

     e. IF a modal/panel/dropdown opened:
        - Find all clickable elements INSIDE it (run discovery script scoped to the modal)
        - Recursively click through those too (max depth: 3)
        - IMPORTANT: for forms in modals, don't submit — just extract fields and validation
        - Close the modal/panel (click X, press Escape, or click backdrop)

     f. VERIFY page returned to original state after closing

     g. RECORD the interaction:
        {
          trigger: "selector and text of clicked element",
          result: "modal | panel | dropdown | navigation | content-update | toast | api-call | none",
          screenshot: "path if screenshot taken",
          apiCalls: ["list of API calls triggered"],
          formFields: ["if a form appeared"],
          childInteractions: ["if recursed into modal/panel"]
        }

  6. SAVE all interactions to docs/clone-research/pages/<page>-interactions.json
```

## Step 3: Calendar-Specific Deep Crawl

Calendars are especially complex. Special handling:

```
FOR calendar components:

  1. IDENTIFY calendar type:
     - Day view / Week view / Month view / Timeline view
     - Check for view switcher buttons

  2. FOR each view type available:
     a. Switch to that view, screenshot
     b. Extract the grid structure:
        - Time slots (what intervals: 15min, 30min, 1hr?)
        - Day headers
        - Existing events/appointments (extract their data)

  3. CLICK on empty time slots:
     - Does it open a "create appointment" modal? → Extract the full form
     - Does it start a drag-to-select? → Record the behavior
     - Does it show a quick-add popup? → Screenshot and extract

  4. CLICK on existing events/appointments:
     - Does it open a detail view? → Extract all fields shown
     - Does it open an edit form? → Extract the form (compare with create form)
     - Can you drag to reschedule? → Record the drag behavior
     - Can you resize (change duration)? → Record

  5. TEST navigation:
     - Next/prev day/week/month buttons
     - "Today" button
     - Date picker jump

  6. TEST filters:
     - Staff/resource filter
     - Service type filter
     - Status filter

  7. RECORD everything in the page spec under "## Calendar Behavior"
```

## Step 4: Complex Widget Deep Crawl

For other complex components, apply similar depth:

### Data Tables
```
- Click every column header (sortable?)
- Click row actions (edit, delete, view, more menu)
- Test pagination (first, prev, next, last, page number)
- Test search/filter inputs
- Test bulk select (select all checkbox → what actions appear?)
- Test row click (does it navigate? expand? select?)
- Test column resize/reorder if available
```

### Navigation / Sidebar
```
- Click every menu item
- Test collapsible sections (expand/collapse)
- Test nested menus (hover or click to expand?)
- Test active state indicators
- Test mobile menu (hamburger → drawer)
- Test badge/notification counts on menu items
```

### Forms with Dynamic Behavior
```
- Test conditional fields (select option A → new fields appear)
- Test auto-complete/search inputs (type text → dropdown with results)
- Test file upload UI (drag area, file picker, preview)
- Test multi-step forms (next/prev/step indicator)
- Test inline validation (blur field → error appears)
- Test dependent dropdowns (select country → cities populate)
```

## Step 5: Interaction Map Output

After crawling all pages, generate `docs/clone-research/INTERACTION_MAP.md`:

```markdown
# Interaction Map

## Global Interactions (available on all/most pages)
- Header: logo → / | notifications bell → dropdown (3 items) | profile avatar → dropdown (5 items)
- Sidebar: 8 menu items, 2 collapsible groups

## Page: /dashboard
Total interactive elements: 47
- Calendar section: 24 clickable elements
  - Empty slot click → CreateAppointmentModal (12 form fields)
  - Event click → EventDetailPanel (view mode, edit button)
  - View switcher: Day | 3-Day | Week | Month
  - Date nav: prev/next/today
- Stats cards: 4 cards, each clickable → navigates to detail page
- Recent activity: 10 list items, each → detail view
- Quick actions toolbar: 5 buttons, each → different modal

## Page: /appointments/new
Type: multi-step form (4 steps)
Step 1: Select service (grid of cards, click to select)
Step 2: Select staff (list with availability indicators)
Step 3: Select date/time (calendar + time slot grid)
Step 4: Client details (form: name, phone, email, notes)
→ Submit: POST /api/appointments → redirect to /appointments/:id

## User Flows
- Create appointment: /dashboard → click slot → modal → fill form → submit → event appears
- Reschedule: click event → detail panel → "reschedule" button → date picker → confirm
- Cancel: click event → detail panel → "cancel" → confirmation dialog → event removed
```
