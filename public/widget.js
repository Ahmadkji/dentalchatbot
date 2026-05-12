(function () {
  if (window.__clinicWidgetLoaded) return;
  window.__clinicWidgetLoaded = true;

  var script = document.currentScript;
  if (!script) return;

  var clinicId = script.getAttribute('data-clinic-id') || '';
  var origin = new URL(script.src, window.location.href).origin;
  var iframeSrc = origin + '/widget-frame?clinicId=' + encodeURIComponent(clinicId);
  var storageKey = 'clinic_widget_auto_open_seen_' + (clinicId || 'default');

  var defaults = {
    primaryColor: '#059669',
    textOnPrimary: '#ffffff',
    widgetPosition: 'bottom-right',
    widgetSize: 'comfortable',
    autoOpenDelay: 'off',
    tooltipText: 'Need help booking an appointment?',
    showTooltip: true,
  };

  var settings = defaults;
  var isOpen = false;

  function getSize(size) {
    if (size === 'compact') return { width: '340px', height: '560px' };
    if (size === 'large') return { width: '420px', height: '700px' };
    return { width: '380px', height: '640px' };
  }

  function applyPosition(element, position, bottom) {
    element.style.left = '';
    element.style.right = '';

    if (position === 'bottom-left') {
      element.style.left = '20px';
    } else {
      element.style.right = '20px';
    }

    element.style.bottom = bottom;
  }

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open chat widget');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.style.position = 'fixed';
  launcher.style.width = '58px';
  launcher.style.height = '58px';
  launcher.style.border = '0';
  launcher.style.borderRadius = '9999px';
  launcher.style.cursor = 'pointer';
  launcher.style.display = 'flex';
  launcher.style.alignItems = 'center';
  launcher.style.justifyContent = 'center';
  launcher.style.boxShadow = '0 14px 30px rgba(2, 6, 23, 0.26)';
  launcher.style.transition = 'transform 180ms ease, box-shadow 180ms ease';
  launcher.style.zIndex = '2147483000';
  launcher.style.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
  launcher.innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:6px">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block">' +
    '<path d="M12 3C7.03 3 3 6.7 3 11.27c0 2.62 1.33 4.95 3.42 6.47V21l3.08-1.72c.49.1 1 .15 1.5.15 4.97 0 9-3.7 9-8.26S16.97 3 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
    '<span style="font-size:11px;letter-spacing:.02em">Chat</span>' +
    '</span>';

  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.title = 'Clinic chatbot widget';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.maxWidth = 'calc(100vw - 24px)';
  iframe.style.maxHeight = 'calc(100vh - 110px)';
  iframe.style.border = '0';
  iframe.style.borderRadius = '18px';
  iframe.style.boxShadow = '0 26px 56px rgba(2, 6, 23, 0.26)';
  iframe.style.background = '#ffffff';
  iframe.style.transform = 'translateY(12px) scale(0.98)';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.transition = 'opacity 180ms ease, transform 180ms ease';
  iframe.style.zIndex = '2147483000';

  var tooltip = document.createElement('button');
  tooltip.type = 'button';
  tooltip.setAttribute('aria-label', 'Open chatbot');
  tooltip.style.position = 'fixed';
  tooltip.style.padding = '10px 13px';
  tooltip.style.borderRadius = '999px';
  tooltip.style.border = '1px solid rgba(15, 23, 42, 0.1)';
  tooltip.style.background = '#ffffff';
  tooltip.style.color = '#0f172a';
  tooltip.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.16)';
  tooltip.style.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
  tooltip.style.transition = 'opacity 180ms ease, transform 180ms ease';
  tooltip.style.transform = 'translateY(8px)';
  tooltip.style.opacity = '0';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '2147483000';

  function setTooltipVisible(visible) {
    if (!settings.showTooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.transform = 'translateY(8px)';
      return;
    }

    if (visible && !isOpen) {
      tooltip.style.opacity = '1';
      tooltip.style.pointerEvents = 'auto';
      tooltip.style.transform = 'translateY(0px)';
      return;
    }

    tooltip.style.opacity = '0';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.transform = 'translateY(8px)';
  }

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    launcher.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    launcher.setAttribute('aria-label', nextOpen ? 'Close chat widget' : 'Open chat widget');
    iframe.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');

    if (nextOpen) {
      iframe.style.opacity = '1';
      iframe.style.pointerEvents = 'auto';
      iframe.style.transform = 'translateY(0px) scale(1)';
      launcher.style.transform = 'scale(0.97)';
      launcher.style.boxShadow = '0 10px 24px rgba(2, 6, 23, 0.22)';
      setTooltipVisible(false);
      return;
    }

    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.transform = 'translateY(12px) scale(0.98)';
    launcher.style.transform = 'scale(1)';
    launcher.style.boxShadow = '0 14px 30px rgba(2, 6, 23, 0.26)';
  }

  launcher.addEventListener('click', function () {
    setOpen(!isOpen);
  });

  tooltip.addEventListener('click', function () {
    setOpen(true);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen) {
      setOpen(false);
    }
  });

  document.body.appendChild(launcher);
  document.body.appendChild(iframe);
  document.body.appendChild(tooltip);

  function applySettings(nextSettings) {
    settings = Object.assign({}, defaults, nextSettings || {});
    var size = getSize(settings.widgetSize);

    launcher.style.background = settings.primaryColor;
    launcher.style.color = settings.textOnPrimary;
    applyPosition(launcher, settings.widgetPosition, '20px');

    iframe.style.width = size.width;
    iframe.style.height = size.height;
    applyPosition(iframe, settings.widgetPosition, '88px');

    tooltip.textContent = settings.tooltipText || defaults.tooltipText;
    applyPosition(tooltip, settings.widgetPosition, '90px');

    if (settings.widgetPosition === 'bottom-left') {
      tooltip.style.left = '20px';
      tooltip.style.right = '';
    } else {
      tooltip.style.right = '20px';
      tooltip.style.left = '';
    }

    setTooltipVisible(Boolean(settings.showTooltip));

    if (settings.showTooltip) {
      window.setTimeout(function () {
        setTooltipVisible(false);
      }, 6500);
    }

    if (settings.autoOpenDelay !== 'off' && !window.localStorage.getItem(storageKey)) {
      var delay = settings.autoOpenDelay === '10s' ? 10000 : 5000;
      window.setTimeout(function () {
        setOpen(true);
        window.localStorage.setItem(storageKey, 'true');
      }, delay);
    }
  }

  fetch(origin + '/api/widget-settings')
    .then(function (response) {
      return response.ok ? response.json() : defaults;
    })
    .then(function (data) {
      applySettings(data);
    })
    .catch(function () {
      applySettings(defaults);
    });
})();
