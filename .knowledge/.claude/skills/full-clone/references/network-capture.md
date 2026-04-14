# Network Capture Reference

## Full Network Interception Script

Inject this via browser MCP's `evaluate_script` before interacting with any page.
It captures ALL fetch and XHR requests with full request/response data.

```javascript
(function() {
  if (window.__netCapture) return; // Already injected
  window.__netCapture = { requests: [], id: 0 };

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const id = ++window.__netCapture.id;
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const opts = args[1] || {};
    const entry = {
      id,
      type: 'fetch',
      method: opts.method || 'GET',
      url,
      headers: opts.headers ? Object.fromEntries(
        opts.headers instanceof Headers ? opts.headers.entries() :
        Array.isArray(opts.headers) ? opts.headers :
        Object.entries(opts.headers)
      ) : {},
      body: null,
      status: null,
      responseBody: null,
      timestamp: Date.now()
    };

    // Capture request body
    if (opts.body) {
      try {
        entry.body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
      } catch { entry.body = String(opts.body); }
    }

    try {
      const res = await origFetch.apply(this, args);
      entry.status = res.status;
      const clone = res.clone();
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          entry.responseBody = await clone.json();
        } else {
          const text = await clone.text();
          entry.responseBody = text.slice(0, 5000); // Limit text responses
        }
      } catch(e) { entry.responseBody = '[parse error]'; }
      entry.responseHeaders = Object.fromEntries(res.headers.entries());
      window.__netCapture.requests.push(entry);
      return res;
    } catch(err) {
      entry.error = err.message;
      window.__netCapture.requests.push(entry);
      throw err;
    }
  };

  // Intercept XHR
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__capture = {
      id: ++window.__netCapture.id,
      type: 'xhr',
      method, url,
      headers: {},
      timestamp: Date.now()
    };
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this.__capture) this.__capture.headers[name] = value;
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this.__capture) {
      try {
        this.__capture.body = body ? JSON.parse(body) : null;
      } catch { this.__capture.body = body; }

      this.addEventListener('load', () => {
        this.__capture.status = this.status;
        try {
          this.__capture.responseBody = JSON.parse(this.responseText);
        } catch { this.__capture.responseBody = this.responseText?.slice(0, 5000); }
        window.__netCapture.requests.push(this.__capture);
      });
      this.addEventListener('error', () => {
        this.__capture.error = 'Network error';
        window.__netCapture.requests.push(this.__capture);
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[NetCapture] Intercepting all fetch/XHR requests');
})();
```

## Collecting Results

After interacting with the page:
```javascript
JSON.stringify(window.__netCapture.requests, null, 2);
```

## Filtering API Calls Only

```javascript
JSON.stringify(
  window.__netCapture.requests.filter(r =>
    !r.url.match(/\.(js|css|png|jpg|svg|woff|ico)/) &&
    !r.url.includes('analytics') &&
    !r.url.includes('tracking')
  ),
  null, 2
);
```

## Inferring API Schema from Responses

After capturing, run this to generate a schema summary:
```javascript
(function() {
  function inferType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return val.length ? `${inferType(val[0])}[]` : 'any[]';
    if (typeof val === 'object') {
      return '{' + Object.entries(val).map(([k,v]) => `${k}:${inferType(v)}`).join(', ') + '}';
    }
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return 'date';
      if (/^[0-9a-f-]{36}$/.test(val)) return 'uuid';
      if (val.includes('@')) return 'email';
    }
    return typeof val;
  }

  return JSON.stringify(
    window.__netCapture.requests
      .filter(r => r.responseBody && typeof r.responseBody === 'object')
      .map(r => ({
        endpoint: `${r.method} ${r.url}`,
        requestSchema: r.body ? inferType(r.body) : null,
        responseSchema: inferType(r.responseBody)
      })),
    null, 2
  );
})();
```
