# Form Extraction Reference

## Extract All Forms on a Page

Run via browser MCP to capture every form's structure, validation, and submit behavior:

```javascript
(function() {
  const forms = [...document.querySelectorAll('form')];

  // Also find "virtual forms" — divs with inputs + submit buttons
  const virtualForms = [...document.querySelectorAll('[role="form"], [data-form], .form')]
    .filter(el => !el.closest('form'));

  function extractFields(container) {
    const fields = [];

    // Standard inputs
    container.querySelectorAll('input, textarea, select').forEach(el => {
      const field = {
        tag: el.tagName.toLowerCase(),
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || el.id || el.getAttribute('data-name'),
        placeholder: el.placeholder,
        required: el.required || el.getAttribute('aria-required') === 'true',
        pattern: el.pattern,
        minLength: el.minLength > 0 ? el.minLength : null,
        maxLength: el.maxLength > 0 ? el.maxLength : null,
        min: el.min || null,
        max: el.max || null,
        defaultValue: el.defaultValue || el.value,
        label: null,
        options: null,
        autocomplete: el.autocomplete
      };

      // Find associated label
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) field.label = label.textContent.trim();
      }
      if (!field.label) {
        const parentLabel = el.closest('label');
        if (parentLabel) field.label = parentLabel.textContent.trim().replace(el.value, '').trim();
      }

      // Select options
      if (el.tagName === 'SELECT') {
        field.options = [...el.options].map(o => ({ value: o.value, label: o.textContent.trim() }));
      }

      fields.push(field);
    });

    // Custom dropdowns (divs that act as selects)
    container.querySelectorAll('[role="listbox"], [role="combobox"], [data-radix-select-trigger]').forEach(el => {
      fields.push({
        tag: 'custom-select',
        type: 'select',
        name: el.getAttribute('name') || el.getAttribute('aria-label') || 'unknown',
        label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 50),
        required: el.getAttribute('aria-required') === 'true',
        options: 'dynamic — click to populate'
      });
    });

    // Checkboxes/toggles that might be custom
    container.querySelectorAll('[role="checkbox"], [role="switch"]').forEach(el => {
      if (!el.closest('input')) {
        fields.push({
          tag: 'custom-toggle',
          type: el.getAttribute('role'),
          name: el.getAttribute('name') || el.getAttribute('aria-label'),
          label: el.getAttribute('aria-label') || el.textContent.trim(),
          checked: el.getAttribute('aria-checked') === 'true'
        });
      }
    });

    return fields;
  }

  function extractForm(container, index) {
    return {
      index,
      action: container.action || null,
      method: container.method || 'implicit',
      id: container.id || null,
      className: container.className?.toString().slice(0, 100),
      fields: extractFields(container),
      submitButton: (() => {
        const btn = container.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
        return btn ? { text: btn.textContent.trim(), type: btn.type } : null;
      })(),
      hasFileUpload: !!container.querySelector('input[type="file"]'),
      hasPasswordField: !!container.querySelector('input[type="password"]'),
      enctype: container.enctype || null
    };
  }

  return JSON.stringify({
    standardForms: forms.map((f, i) => extractForm(f, i)),
    virtualForms: virtualForms.map((f, i) => extractForm(f, forms.length + i)),
    totalInputs: document.querySelectorAll('input, textarea, select').length
  }, null, 2);
})();
```

## Extract Form Validation Rules

After finding forms, check for client-side validation:

```javascript
(function() {
  // Check for popular validation libraries
  const validators = {
    zod: !!window.z,
    yup: !!window.Yup,
    reactHookForm: !!document.querySelector('[data-rhf]'),
    formik: !!document.querySelector('[data-formik]'),
    html5: [...document.querySelectorAll('[required], [pattern], [min], [max]')].length > 0
  };

  // Check for inline error messages (submit the form empty to trigger validation)
  const errorSelectors = [
    '[role="alert"]',
    '.error', '.error-message', '.field-error',
    '[data-error]', '[aria-invalid="true"]',
    '.text-red-500', '.text-destructive'
  ];

  const errors = errorSelectors.flatMap(sel =>
    [...document.querySelectorAll(sel)].map(el => ({
      selector: sel,
      text: el.textContent.trim(),
      nearField: el.closest('[data-field], .form-field, .field')?.getAttribute('data-field')
    }))
  ).filter(e => e.text);

  return JSON.stringify({ validators, visibleErrors: errors }, null, 2);
})();
```

## Capture Form Submit Behavior

Monitor what happens when a form is submitted:

```javascript
// Inject BEFORE the user submits the form
(function() {
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      console.log('[FormCapture] Submit:', {
        action: form.action,
        method: form.method,
        data,
        timestamp: Date.now()
      });
    }, { capture: true });
  });

  // Also watch for programmatic submissions via fetch/XHR
  // (already captured by network-capture.md interceptor)
  console.log('[FormCapture] Monitoring form submissions');
})();
```
