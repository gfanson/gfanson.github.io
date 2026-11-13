/* Family blog lock: decrypts content encrypted at build time by _scripts/encrypt_blog.rb.
 * The derived key (never the password) is kept in sessionStorage so other posts
 * open without asking again until the browser tab is closed. */
(function () {
  'use strict';
  var payloadEl = document.getElementById('blog-payload');
  var gate = document.getElementById('password-gate');
  var target = document.getElementById('blog-protected');

  // Local `jekyll serve` builds aren't encrypted: show the content as is.
  if (!payloadEl) { if (gate) gate.hidden = true; return; }

  var form = document.getElementById('password-form');
  var input = document.getElementById('password-input');
  var errorEl = document.getElementById('error-message');
  var button = form.querySelector('button');
  var payload = JSON.parse(payloadEl.textContent);
  var storeKey = 'blogKey:' + payload.salt;

  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function session(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }

  function decrypt(key, bytes) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  }
  function importRaw(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt']);
  }
  function deriveKey(password) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64(payload.salt), iterations: payload.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }

  function loadImages(key) {
    var imgs = Array.prototype.slice.call(target.querySelectorAll('img[data-enc-src]'));
    var next = 0;
    function worker() {
      var img = imgs[next++];
      if (!img) return Promise.resolve();
      return fetch(img.getAttribute('data-enc-src'))
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (buf) { return decrypt(key, new Uint8Array(buf)); })
        .then(function (plain) {
          img.src = URL.createObjectURL(new Blob([plain], { type: img.getAttribute('data-type') || '' }));
        })
        .catch(function () { img.alt = (img.alt || 'Photo') + ' (could not load)'; })
        .then(worker);
    }
    var workers = [];
    for (var i = 0; i < 4; i++) workers.push(worker());
    return Promise.all(workers);
  }

  function unlock(key) {
    return decrypt(key, b64(payload.data)).then(function (plain) {
      target.innerHTML = new TextDecoder().decode(plain);
      gate.hidden = true;
      target.hidden = false;
      loadImages(key);
      return key;
    });
  }

  function showGate() {
    gate.hidden = false;
    input.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!input.value) return;
    errorEl.textContent = '';
    button.disabled = true;
    button.textContent = 'Unlocking…';
    deriveKey(input.value)
      .then(unlock)
      .then(function (key) { return crypto.subtle.exportKey('raw', key); })
      .then(function (raw) { session(function (s) { s.setItem(storeKey, toB64(raw)); }); })
      .catch(function () {
        errorEl.textContent = 'Incorrect password.';
        input.select();
      })
      .then(function () { button.disabled = false; button.textContent = 'Enter'; });
  });

  if (!window.crypto || !crypto.subtle) {
    gate.hidden = false;
    errorEl.textContent = 'This browser can’t open the blog. Try an up-to-date Safari, Chrome or Firefox.';
    form.hidden = true;
    return;
  }

  var saved = session(function (s) { return s.getItem(storeKey); });
  if (saved) {
    importRaw(b64(saved)).then(unlock).catch(function () {
      session(function (s) { s.removeItem(storeKey); });
      showGate();
    });
  } else {
    showGate();
  }
})();
