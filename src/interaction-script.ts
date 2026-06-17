export const INTERACTION_SCRIPT_JS = `(function () {
  var PATTERNS = [
    { s: 'ins.adsbygoogle',                  l: 'Google AdSense' },
    { s: '[data-ad-slot]',                   l: 'Ad Slot' },
    { s: '[data-ad-client]',                 l: 'Google Ad' },
    { s: '[id^="div-gpt-ad"]',               l: 'DFP / GAM' },
    { s: '[id^="gpt_unit"]',                 l: 'GPT Ad Unit' },
    { s: '[data-google-query-id]',           l: 'Google Ad' },
    { s: '[data-ad-unit]',                   l: 'Ad Unit' },
    { s: '[id*="criteo"]',                   l: 'Criteo' },
    { s: '[class*="criteo"]',                l: 'Criteo' },
    { s: '[id*="taboola"]',                  l: 'Taboola' },
    { s: '[class*="taboola"]',               l: 'Taboola' },
    { s: '[id*="outbrain"]',                 l: 'Outbrain' },
    { s: '[id*="prebid"]',                   l: 'Prebid' },
    { s: 'iframe[src*="doubleclick.net"]',   l: 'DoubleClick' },
    { s: 'iframe[src*="googlesyndication"]', l: 'Google Ad' },
    { s: '[id^="ad-"]',                      l: 'Ad Slot' },
    { s: '[id^="ad_"]',                      l: 'Ad Slot' },
    { s: '[id*="adslot"]',                   l: 'Ad Slot' },
    { s: '[id*="ad-slot"]',                  l: 'Ad Slot' },
    { s: '[id*="adunit"]',                   l: 'Ad Unit' },
    { s: '[id*="leaderboard"]',              l: 'Leaderboard' },
    { s: '[id*="skyscraper"]',               l: 'Skyscraper' },
    { s: '[id*="billboard"]',                l: 'Billboard' },
    { s: '[id*="mrec"]',                     l: 'MREC' },
    { s: '.ad-slot',                         l: 'Ad Slot' },
    { s: '.adslot',                          l: 'Ad Slot' },
    { s: '.ad-unit',                         l: 'Ad Unit' },
    { s: '.leaderboard',                     l: 'Leaderboard' },
    { s: '.mrec',                            l: 'MREC' },
    { s: '.ad-container',                    l: 'Ad Container' },
    { s: '[class*="ad-banner"]',             l: 'Banner Ad' },
    { s: '[class*="banner-ad"]',             l: 'Banner Ad' },
    { s: '[class*="sponsored"]',             l: 'Sponsored' },
  ];

  var stamped = [];

  function scan() {
    var slots = [];
    var idx = stamped.length;

    PATTERNS.forEach(function (p) {
      try {
        document.querySelectorAll(p.s).forEach(function (el) {
          if (stamped.indexOf(el) !== -1) return;
          var rect = el.getBoundingClientRect();
          if (rect.width < 10) return;

          stamped.push(el);
          el.setAttribute('data-ap-slot', String(idx));
          el.setAttribute('data-ap-label', p.l);

          if (!el.style.minHeight) el.style.minHeight = '32px';
          el.style.outline = '2px dashed rgba(21,114,237,0.6)';
          el.style.outlineOffset = '2px';
          el.style.position = el.style.position || 'relative';
          el.style.cursor = 'pointer';

          var badge = document.createElement('div');
          badge.setAttribute('data-ap-badge', '1');
          badge.style.cssText = 'position:absolute;top:0;left:0;font:10px/1.6 monospace;'
            + 'background:rgba(21,114,237,0.88);color:#fff;padding:0 7px;z-index:2147483647;'
            + 'pointer-events:none;white-space:nowrap;';
          badge.textContent = p.l + ' → click to select';
          el.insertBefore(badge, el.firstChild);

          el.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            parent.postMessage({
              type: 'ap:click',
              selector: '[data-ap-slot="' + this.getAttribute('data-ap-slot') + '"]',
              label: this.getAttribute('data-ap-label') || p.l,
            }, '*');
          }, true);

          var name = el.id ? '#' + el.id
            : (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\\s+/)[0]
              : el.tagName.toLowerCase());

          slots.push({
            selector: '[data-ap-slot="' + idx + '"]',
            label: p.l,
            name: name,
          });
          idx++;
        });
      } catch (_) {}
    });

    if (slots.length) {
      parent.postMessage({ type: 'ap:slots', slots: slots }, '*');
    } else {
      parent.postMessage({ type: 'ap:slots', slots: [] }, '*');
    }
  }

  var pickActive = false, pickHovered = null;

  function stopPick() {
    pickActive = false;
    document.body.style.cursor = '';
    if (pickHovered) {
      pickHovered.style.outline = pickHovered._apSavedOutline || '';
      pickHovered = null;
    }
    document.removeEventListener('mouseover', onPickHover, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKey, true);
  }

  function onPickHover(e) {
    if (!pickActive || e.target.getAttribute('data-ap-badge')) return;
    if (pickHovered && pickHovered !== e.target) {
      pickHovered.style.outline = pickHovered._apSavedOutline || '';
    }
    pickHovered = e.target;
    if (!pickHovered._apSavedOutline) pickHovered._apSavedOutline = pickHovered.style.outline;
    pickHovered.style.outline = '3px solid rgba(255,85,0,0.8)';
    e.stopPropagation();
  }

  function onPickClick(e) {
    if (!pickActive) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target;
    if (el.getAttribute('data-ap-badge') || el.getAttribute('data-ap-slot')) {
      stopPick();
      parent.postMessage({ type: 'ap:pick-done' }, '*');
      return;
    }
    var idx2 = stamped.length;
    stamped.push(el);
    el.setAttribute('data-ap-slot', String(idx2));
    el.setAttribute('data-ap-label', 'Custom Slot');
    el.style.minHeight = el.style.minHeight || '32px';
    el.style.outline = '2px dashed rgba(21,114,237,0.6)';
    el.style.position = el.style.position || 'relative';
    el.style.cursor = 'pointer';
    var badge2 = document.createElement('div');
    badge2.setAttribute('data-ap-badge', '1');
    badge2.style.cssText = 'position:absolute;top:0;left:0;font:10px/1.6 monospace;'
      + 'background:rgba(21,114,237,0.88);color:#fff;padding:0 7px;z-index:2147483647;'
      + 'pointer-events:none;white-space:nowrap;';
    badge2.textContent = 'Custom Slot → click to select';
    el.insertBefore(badge2, el.firstChild);
    el.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      parent.postMessage({ type: 'ap:click',
        selector: '[data-ap-slot="' + this.getAttribute('data-ap-slot') + '"]',
        label: 'Custom Slot' }, '*');
    }, true);
    var name2 = el.id ? '#' + el.id
      : (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/)[0]
        : el.tagName.toLowerCase());
    var rect3 = el.getBoundingClientRect();
    stopPick();
    parent.postMessage({
      type: 'ap:slot-added',
      slot: { selector: '[data-ap-slot="' + idx2 + '"]', label: 'Custom Slot', name: name2 },
      rect: { w: Math.round(rect3.width), h: Math.round(rect3.height) },
    }, '*');
    parent.postMessage({ type: 'ap:pick-done' }, '*');
  }

  function onPickKey(e) {
    if (e.key === 'Escape') { stopPick(); parent.postMessage({ type: 'ap:pick-done' }, '*'); }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-ap-placement]')) return;
    e.preventDefault();
  }, true);
  try { window.open = function () { return null; }; } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(scan, 500); });
  } else {
    setTimeout(scan, 500);
  }
  setTimeout(scan, 3500);

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;

    if (e.data.type === 'ap:rescan') { scan(); return; }

    if (e.data.type === 'ap:start-pick') {
      pickActive = true;
      document.body.style.cursor = 'crosshair';
      document.addEventListener('mouseover', onPickHover, true);
      document.addEventListener('click', onPickClick, true);
      document.addEventListener('keydown', onPickKey, true);
      return;
    }

    if (e.data.type === 'ap:cancel-pick') { stopPick(); return; }

    if (e.data.type === 'ap:insert') {
      var target = document.querySelector(e.data.selector);
      if (!target) return;

      var prev = target.querySelector('[data-ap-placement]');
      if (prev) prev.remove();
      var prevStash = target.querySelector('[data-ap-stash]');
      if (prevStash) prevStash.remove();

      target.setAttribute('data-ap-filled', '1');
      target.style.outlineColor = 'rgba(255,85,0,0.6)';
      target.style.outlineStyle = 'dashed';
      target.style.minHeight = '';

      var badge3 = target.querySelector('[data-ap-badge]');
      if (badge3) {
        badge3.style.background = 'rgba(255,85,0,0.88)';
        badge3.textContent = '✓ SeenThis ad placed';
      }

      var stash = document.createElement('div');
      stash.setAttribute('data-ap-stash', '1');
      stash.style.display = 'none';
      Array.from(target.childNodes).forEach(function (n) {
        if (n !== badge3) stash.appendChild(n);
      });
      target.appendChild(stash);

      var wrapper = document.createElement('div');
      wrapper.setAttribute('data-ap-placement', e.data.id);
      if (e.data.size) {
        wrapper.style.cssText = 'width:' + e.data.size.w + 'px;height:' + e.data.size.h
          + 'px;overflow:hidden;display:block;';
      }
      var tmp = document.createElement('div');
      tmp.innerHTML = e.data.tagHtml;
      (function transplant(src, dst) {
        Array.from(src.childNodes).forEach(function (n) {
          if (n.nodeName === 'SCRIPT') {
            var s = document.createElement('script');
            Array.from(n.attributes).forEach(function (a) { s.setAttribute(a.name, a.value); });
            if (n.textContent) s.textContent = n.textContent;
            dst.appendChild(s);
          } else {
            var c = n.cloneNode(false);
            dst.appendChild(c);
            if (n.childNodes.length) transplant(n, c);
          }
        });
      })(tmp, wrapper);

      if (badge3) {
        badge3.insertAdjacentElement('afterend', wrapper);
      } else {
        target.insertBefore(wrapper, target.firstChild);
      }
      return;
    }

    if (e.data.type === 'ap:remove') {
      var placement = document.querySelector('[data-ap-placement="' + e.data.id + '"]');
      if (!placement) return;
      var slot2 = placement.closest('[data-ap-slot]');
      if (slot2) {
        var stash2 = slot2.querySelector('[data-ap-stash]');
        if (stash2) {
          Array.from(stash2.childNodes).forEach(function (n) { slot2.insertBefore(n, stash2); });
          stash2.remove();
        }
        placement.remove();
        slot2.removeAttribute('data-ap-filled');
        slot2.style.outlineColor = 'rgba(21,114,237,0.6)';
        slot2.style.outlineStyle = 'dashed';
        slot2.style.minHeight = '32px';
        var b = slot2.querySelector('[data-ap-badge]');
        if (b) {
          b.style.background = 'rgba(21,114,237,0.88)';
          b.textContent = (slot2.getAttribute('data-ap-label') || 'Ad Slot') + ' → click to select';
        }
      } else {
        placement.remove();
      }
      return;
    }

    if (e.data.type === 'ap:get-html') {
      var root = document.documentElement.cloneNode(true);
      var s = root.querySelector('#__ad-placer__');
      if (s) s.remove();
      root.querySelectorAll('[data-ap-badge],[data-ap-stash]').forEach(function (el) { el.remove(); });
      root.querySelectorAll('[data-ap-slot]').forEach(function (el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.cursor = '';
        el.style.minHeight = '';
        el.removeAttribute('data-ap-slot');
        el.removeAttribute('data-ap-label');
        el.removeAttribute('data-ap-filled');
      });
      root.querySelectorAll('[data-ap-placement]').forEach(function (el) {
        el.removeAttribute('data-ap-placement');
      });
      parent.postMessage({ type: 'ap:html-result', html: '<!DOCTYPE html>' + root.outerHTML }, '*');
      return;
    }
  });
})();`
