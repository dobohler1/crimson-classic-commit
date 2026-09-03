/* Crimson Classic traffic-source capture (v1, 2026-09-03).
   Records first-touch utm_* / fbclid / referrer in localStorage, then stamps every
   Stripe payment link on the page with client_reference_id=src-<source>-<campaign>
   so the source lands on the Stripe checkout session and in the ledger.
   Cloudflare Web Analytics drops query strings, so this is the only place UTMs survive. */
(function () {
  var KEY = 'cc_src', TTL = 30 * 24 * 3600 * 1000;
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.t && Date.now() - o.t < TTL) return o; } catch (_) {}
    return null;
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }
  function host(u) { try { return new URL(u).hostname.replace(/^(www|l|m|lm)\./, ''); } catch (_) { return ''; } }

  var p = new URLSearchParams(location.search);
  var s = p.get('utm_source'), m = p.get('utm_medium'), c = p.get('utm_campaign'), n = p.get('utm_content');
  if (!s && p.get('fbclid')) { s = 'facebook'; m = m || 'paid'; }
  if (!s) {
    var rh = host(document.referrer);
    if (rh && rh !== location.hostname.replace(/^www\./, '')) { s = rh; m = m || 'referral'; }
  }
  var cur = load();
  if (s && !cur) { cur = { s: s, m: m || '', c: c || '', n: n || '', t: Date.now() }; save(cur); }
  else if (s && cur && (s !== cur.s || (c || '') !== cur.c)) { cur.last = s + '/' + (c || ''); save(cur); }
  window.ccSrc = cur;

  function refId() {
    var o = cur || { s: 'direct', c: '' };
    var tag = (o.s + '-' + (o.c || 'none')).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return ('src-' + tag).slice(0, 200);
  }
  window.ccStripeUrl = function (u) {
    if (!/^https:\/\/(buy|donate)\.stripe\.com\//.test(u) || u.indexOf('client_reference_id=') > -1) return u;
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(refId());
  };
  function tagLinks() {
    var as = document.querySelectorAll('a[href*="stripe.com/"]');
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute('href');
      if (h) as[i].setAttribute('href', window.ccStripeUrl(h));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagLinks); else tagLinks();
})();
