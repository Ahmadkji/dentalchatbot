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
  launcher.textContent = 'Chat';
  launcher.style.position = 'fixed';
  launcher.style.width = '56px';
  launcher.style.height = '56px';
  launcher.style.border = '0';
  launcher.style.borderRadius = '9999px';
  launcher.style.font = '600 14px sans-serif';
  launcher.style.cursor = 'pointer';
  launcher.style.boxShadow = '0 12px 28px rgba(0,0,0,0.18)';
  launcher.style.zIndex = '2147483000';

  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.title = 'Clinic chatbot widget';
  iframe.style.position = 'fixed';
  iframe.style.maxWidth = 'calc(100vw - 24px)';
  iframe.style.maxHeight = 'calc(100vh - 110px)';
  iframe.style.border = '0';
  iframe.style.borderRadius = '16px';
  iframe.style.boxShadow = '0 24px 48px rgba(0,0,0,0.18)';
  iframe.style.background = '#ffffff';
  iframe.style.zIndex = '2147483000';
  iframe.style.display = 'none';

  var tooltip = document.createElement('div');
  tooltip.style.position = 'fixed';
  tooltip.style.padding = '10px 12px';
  tooltip.style.borderRadius = '12px';
  tooltip.style.background = '#ffffff';
  tooltip.style.color = '#0f172a';
  tooltip.style.border = '1px solid rgba(15, 23, 42, 0.08)';
  tooltip.style.boxShadow = '0 10px 24px rgba(15,23,42,0.12)';
  tooltip.style.font = '500 12px sans-serif';
  tooltip.style.zIndex = '2147483000';
  tooltip.style.display = 'none';

  function toggleWidget() {
    var isHidden = iframe.style.display === 'none';
    iframe.style.display = isHidden ? 'block' : 'none';
    tooltip.style.display = 'none';
  }

  launcher.addEventListener('click', toggleWidget);
  tooltip.addEventListener('click', toggleWidget);

  document.body.appendChild(launcher);
  document.body.appendChild(iframe);
  document.body.appendChild(tooltip);

  function applySettings(settings) {
    var merged = Object.assign({}, defaults, settings || {});
    var size = getSize(merged.widgetSize);

    launcher.style.background = merged.primaryColor;
    launcher.style.color = merged.textOnPrimary;
    applyPosition(launcher, merged.widgetPosition, '20px');

    iframe.style.width = size.width;
    iframe.style.height = size.height;
    applyPosition(iframe, merged.widgetPosition, '88px');

    tooltip.textContent = merged.tooltipText || defaults.tooltipText;
    applyPosition(tooltip, merged.widgetPosition, '88px');
    if (merged.widgetPosition === 'bottom-left') {
      tooltip.style.left = '20px';
      tooltip.style.right = '';
    } else {
      tooltip.style.right = '20px';
      tooltip.style.left = '';
    }

    if (merged.showTooltip) {
      tooltip.style.display = 'block';
      setTimeout(function () {
        if (iframe.style.display === 'none') {
          tooltip.style.display = 'none';
        }
      }, 5000);
    }

    if (merged.autoOpenDelay !== 'off' && !window.localStorage.getItem(storageKey)) {
      var delay = merged.autoOpenDelay === '10s' ? 10000 : 5000;
      setTimeout(function () {
        iframe.style.display = 'block';
        tooltip.style.display = 'none';
        window.localStorage.setItem(storageKey, 'true');
      }, delay);
    }
  }

  fetch(origin + '/api/widget-settings')
    .then(function (response) { return response.ok ? response.json() : defaults; })
    .then(applySettings)
    .catch(function () { applySettings(defaults); });
})();
