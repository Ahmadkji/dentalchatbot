(function () {
  if (window.__clinicWidgetLoaded) return;
  window.__clinicWidgetLoaded = true;

  var script = document.currentScript;
  if (!script) {
    console.error('[clinic-widget] Widget script loaded without document.currentScript. The embed cannot bootstrap.');
    return;
  }

  var clinicSlug = script.getAttribute('data-clinic-slug') || '';
  var oldClinicId = script.getAttribute('data-clinic-id') || ''; // Legacy support
  var origin = new URL(script.src, window.location.href).origin;
  var widgetContext = {
    clinicSlug: clinicSlug || null,
    hostOrigin: window.location.origin,
    pageUrl: window.location.href,
    scriptSrc: script.src,
  };

  function logWidget(level, message, details) {
    var logger = console[level] || console.log;
    try {
      logger.call(console, '[clinic-widget] ' + message, details || widgetContext);
    } catch (error) {
      console.log('[clinic-widget] ' + message, details || widgetContext);
    }
  }

  function logWidgetError(message, error, details) {
    var payload = details ? Object.assign({}, widgetContext, details) : Object.assign({}, widgetContext);
    if (error instanceof Error) {
      payload.errorName = error.name;
      payload.errorMessage = error.message;
      if (error.stack) payload.stack = error.stack;
      if (error.status !== undefined) payload.status = error.status;
      if (error.responseBody !== undefined) payload.responseBody = error.responseBody;
    } else if (error !== undefined && error !== null) {
      payload.error = error;
    }
    logWidget('error', message, payload);
  }

  // ── Legacy embed warning ────────────────────────────────────────
  // If only the old data-clinic-id attribute is present (no data-clinic-slug),
  // show a setup warning instead of trying to keep the old public flow alive.
  if (!clinicSlug && oldClinicId) {
    console.warn('[clinic-widget] This embed code is outdated. Please regenerate the embed snippet from your clinic dashboard to get the new slug-based code.');
    var warningDiv = document.createElement('div');
    warningDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:12px 16px;border-radius:8px;font:13px system-ui,sans-serif;z-index:2147483000;max-width:300px;';
    warningDiv.textContent = 'Chat widget setup is incomplete. Please contact the clinic to refresh the embed code.';
    document.body.appendChild(warningDiv);
    return;
  }

  if (!clinicSlug) {
    logWidgetError('Widget script missing data-clinic-slug. The embed code is incomplete.', new Error('Missing clinic slug'));
    return;
  }

  logWidget('info', 'Widget bootstrap started.', widgetContext);

  var storageKey = 'clinic_widget_auto_open_seen_' + clinicSlug;
  var sessionKey = 'clinic_widget_session_v2_' + clinicSlug;
  var visitorIdKey = 'clinic_widget_visitor_' + clinicSlug;

  function createVisitorId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'v_' + window.crypto.randomUUID();
      }
    } catch (e) {}
    return 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ── Visitor ID (durable per slug per browser) ──────────────────
  var visitorId = '';
  try {
    visitorId = window.localStorage.getItem(visitorIdKey) || '';
    if (!visitorId) {
      visitorId = createVisitorId();
      window.localStorage.setItem(visitorIdKey, visitorId);
    }
  } catch (e) {
    logWidgetError('localStorage unavailable while creating visitor ID. Falling back to memory-only visitor state.', e);
    visitorId = createVisitorId();
  }

  var iframeSrc = ''; // Will be set after config bootstrap
  var widgetAccessToken = ''; // Will be set after config bootstrap
  var widgetConfig = null;

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
  var autoOpenTimer = null;
  var tooltipHideTimer = null;

  function logWidgetEvent(eventType, metadata) {
    if (!widgetAccessToken) return;
    var session = readSession();

    fetch(origin + '/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'widget',
        eventType: eventType,
        clinicSlug: clinicSlug,
        widgetAccessToken: widgetAccessToken,
        visitorId: visitorId,
        conversationId: session ? session.conversationId : null,
        publicSessionToken: session ? session.publicSessionToken : null,
        metadata: metadata || null
      })
    }).catch(function () {
      // Analytics should never block widget UX.
    });
  }

  function isMobile() {
    return window.innerWidth < 640;
  }

  function getSize(size) {
    if (isMobile()) return { width: '100%', height: '100%' };
    if (size === 'compact') return { width: '340px', height: '560px' };
    if (size === 'large') return { width: '420px', height: '700px' };
    return { width: '380px', height: '640px' };
  }

  function applyPosition(element, position, bottom) {
    element.style.left = '';
    element.style.right = '';

    if (isMobile()) {
      element.style.left = '0';
      element.style.right = '0';
      element.style.bottom = '0';
      return;
    }

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
  launcher.innerHTML =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block">' +
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

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
  iframe.addEventListener('load', function () {
    logWidget('info', 'Widget iframe loaded.', {
      clinicSlug: clinicSlug,
      iframeSrc: iframe.src,
    });
  });
  iframe.addEventListener('error', function () {
    logWidgetError('Widget iframe failed to load.', new Error('Iframe load error'), {
      clinicSlug: clinicSlug,
      iframeSrc: iframe.src,
    });
  });

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
    var nextOpen = !isOpen;
    setOpen(nextOpen);
    logWidgetEvent(nextOpen ? 'widget_opened' : 'widget_closed', { source: 'launcher' });
  });

  tooltip.addEventListener('click', function () {
    setOpen(true);
    logWidgetEvent('widget_opened', { source: 'tooltip' });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen) {
      setOpen(false);
    }
  });

  // ── Session storage (host page is the durable owner) ──────────

  function readSession() {
    try {
      var raw = window.localStorage.getItem(sessionKey);
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.conversationId || !session.publicSessionToken) return null;
      return session;
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (e) {
      // localStorage unavailable — session lives only in memory for this tab
    }
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(sessionKey);
    } catch (e) {
      // ignore
    }
  }

  // ── postMessage handler ───────────────────────────────────────

  window.addEventListener('message', function (event) {
    // Security: verify origin and source
    if (event.origin !== origin) {
      if (event.data && typeof event.data.type === 'string' && event.data.type.indexOf('clinic_widget:') === 0) {
        logWidgetError('Ignored widget message from unexpected origin.', new Error('Origin mismatch'), {
          eventOrigin: event.origin,
          expectedOrigin: origin,
          messageType: event.data.type,
        });
      }
      return;
    }
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) {
      if (event.data && typeof event.data.type === 'string' && event.data.type.indexOf('clinic_widget:') === 0) {
        logWidgetError('Ignored widget message from unexpected source window.', new Error('Source mismatch'), {
          eventOrigin: event.origin,
          messageType: event.data.type,
        });
      }
      return;
    }
    if (!event.data || typeof event.data.type !== 'string') {
      logWidgetError('Received widget message without a valid type.', new Error('Invalid widget message payload'), {
        eventOrigin: event.origin,
      });
      return;
    }

    if (event.data.type === 'clinic_widget:ready') {
      logWidget('info', 'Widget iframe reported ready.', { clinicSlug: clinicSlug });
      // Iframe is ready — hydrate it with stored session
      var session = readSession();
      iframe.contentWindow.postMessage({
        type: 'clinic_widget:hydrate',
        payload: {
          conversationId: session ? session.conversationId : null,
          publicSessionToken: session ? session.publicSessionToken : null,
          clinicSlug: clinicSlug,
          widgetAccessToken: widgetAccessToken,
          visitorId: visitorId,
          widgetConfig: widgetConfig
        }
      }, origin);
      return;
    }

    if (event.data.type === 'clinic_widget:state_updated') {
      var payload = event.data.payload;
      if (!payload || !payload.conversationId || !payload.publicSessionToken) {
        logWidgetError('Widget state update payload was missing conversation data.', new Error('Invalid state_updated payload'), {
          messageType: event.data.type,
        });
        return;
      }

      // Only store if newer than current
      var current = readSession();
      if (current && current.updatedAt && payload.updatedAt) {
        if (new Date(payload.updatedAt).getTime() <= new Date(current.updatedAt).getTime()) return;
      }

      writeSession({
        conversationId: payload.conversationId,
        publicSessionToken: payload.publicSessionToken,
        clinicSlug: payload.clinicSlug || clinicSlug,
        updatedAt: payload.updatedAt,
        version: 2
      });
      return;
    }

    if (event.data.type === 'clinic_widget:start_new_session') {
      logWidget('info', 'Widget requested a new session.', { clinicSlug: clinicSlug });
      clearSession();
      iframe.contentWindow.postMessage({
        type: 'clinic_widget:clear_session',
        payload: { clinicSlug: clinicSlug }
      }, origin);
      return;
    }

    // ── Inline token refresh: iframe received a fresh token from API ──
    if (event.data.type === 'clinic_widget:access_token_refreshed') {
      var newToken = event.data.payload && event.data.payload.widgetAccessToken;
      if (newToken) {
        logWidget('info', 'Widget access token refreshed inline.', { clinicSlug: clinicSlug });
        widgetAccessToken = newToken;
      } else {
        logWidgetError('Widget access token refresh event did not include a token.', new Error('Missing refreshed token'));
      }
      return;
    }

    if (event.data.type === 'clinic_widget:close_requested') {
      logWidget('info', 'Widget iframe requested close.', { clinicSlug: clinicSlug });
      setOpen(false);
      logWidgetEvent('widget_closed', { source: 'iframe_header' });
      return;
    }

    // ── Token refresh: iframe reports token expired ──────────────
    if (event.data.type === 'clinic_widget:token_expired') {
      logWidget('info', 'Widget token expired; refreshing bootstrap config.', { clinicSlug: clinicSlug });
      // Re-bootstrap: fetch fresh config with a new token
      fetch(origin + '/api/widget/config?slug=' + encodeURIComponent(clinicSlug))
        .then(function (response) {
          if (!response.ok) {
            return response.text().then(function (body) {
              var error = new Error('Refresh failed: ' + response.status);
              error.status = response.status;
              error.responseBody = body;
              throw error;
            });
          }
          return response.json();
        })
        .then(function (config) {
          logWidget('info', 'Widget config refresh succeeded.', {
            clinicSlug: clinicSlug,
            widgetPosition: config.widgetPosition,
          });
          widgetAccessToken = config.widgetAccessToken || '';
          widgetConfig = config;
          // Send the fresh token back to the iframe
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'clinic_widget:token_refresh',
              payload: {
                widgetAccessToken: widgetAccessToken,
                widgetConfig: widgetConfig
              }
            }, origin);
          }
        })
        .catch(function (err) {
          logWidgetError('Token refresh failed.', err, { clinicSlug: clinicSlug });
          // Tell iframe the refresh failed so it can show an error
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'clinic_widget:token_refresh',
              payload: { widgetAccessToken: '' }
            }, origin);
          }
        });
      return;
    }
  });

  // ── Config bootstrap: fetch public config, then set up UI ──────

  logWidget('info', 'Fetching widget config.', {
    clinicSlug: clinicSlug,
    configUrl: origin + '/api/widget/config?slug=' + encodeURIComponent(clinicSlug),
  });

  fetch(origin + '/api/widget/config?slug=' + encodeURIComponent(clinicSlug))
    .then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          var error = new Error('Config fetch failed: ' + response.status);
          error.status = response.status;
          error.responseBody = body;
          throw error;
        });
      }
      return response.json();
    })
    .then(function (config) {
      logWidget('info', 'Widget config loaded successfully.', {
        clinicSlug: clinicSlug,
        widgetPosition: config.widgetPosition,
        quickPromptCount: Array.isArray(config.quickPrompts) ? config.quickPrompts.length : 0,
      });
      widgetAccessToken = config.widgetAccessToken || '';
      widgetConfig = config;
      iframeSrc = origin + '/widget-frame?clinicSlug=' + encodeURIComponent(clinicSlug) + '&mode=embedded&handoff=1&sourcePage=' + encodeURIComponent(window.location.origin + window.location.pathname);
      iframe.src = iframeSrc;
      // Only add DOM elements after successful bootstrap
      logWidget('info', 'Appending widget DOM elements after successful bootstrap.', {
        clinicSlug: clinicSlug,
        iframeSrc: iframeSrc,
      });
      document.body.appendChild(launcher);
      document.body.appendChild(iframe);
      document.body.appendChild(tooltip);
      applySettings(config);
      logWidgetEvent('widget_loaded', { source: 'bootstrap' });
    })
    .catch(function (err) {
      logWidgetError('Failed to load widget config.', err, {
        clinicSlug: clinicSlug,
        configUrl: origin + '/api/widget/config?slug=' + encodeURIComponent(clinicSlug),
      });
      // Don't add any DOM — no launcher, no iframe, no tooltip.
      // The widget is simply not available for this clinic/domain.
    });

  function applySettings(nextSettings) {
    settings = Object.assign({}, defaults, nextSettings || {});
    var size = getSize(settings.widgetSize);

    launcher.style.background = settings.primaryColor;
    launcher.style.color = settings.textOnPrimary;

    if (isMobile()) {
      launcher.style.position = 'fixed';
      launcher.style.bottom = '16px';
      if (settings.widgetPosition === 'bottom-left') {
        launcher.style.left = '16px';
        launcher.style.right = '';
      } else {
        launcher.style.right = '16px';
        launcher.style.left = '';
      }
    } else {
      applyPosition(launcher, settings.widgetPosition, '20px');
    }

    if (isMobile()) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.left = '0';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.top = '0';
      iframe.style.maxWidth = '100%';
      iframe.style.maxHeight = '100%';
      iframe.style.borderRadius = '0';
      iframe.style.boxShadow = 'none';
    } else {
      iframe.style.top = '';
      iframe.style.width = size.width;
      iframe.style.height = size.height;
      iframe.style.maxWidth = 'calc(100vw - 24px)';
      iframe.style.maxHeight = 'calc(100vh - 110px)';
      iframe.style.borderRadius = '18px';
      iframe.style.boxShadow = '0 26px 56px rgba(2, 6, 23, 0.26)';
      applyPosition(iframe, settings.widgetPosition, '88px');
    }

    if (isMobile()) {
      tooltip.style.display = 'none';
    } else {
      tooltip.style.display = '';
      tooltip.textContent = settings.tooltipText || defaults.tooltipText;
      applyPosition(tooltip, settings.widgetPosition, '90px');

      if (settings.widgetPosition === 'bottom-left') {
        tooltip.style.left = '20px';
        tooltip.style.right = '';
      } else {
        tooltip.style.right = '20px';
        tooltip.style.left = '';
      }
    }

    setTooltipVisible(Boolean(settings.showTooltip));

    if (settings.showTooltip) {
      if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
      tooltipHideTimer = window.setTimeout(function () {
        setTooltipVisible(false);
        tooltipHideTimer = null;
      }, 6500);
    }

    if (settings.autoOpenDelay !== 'off' && !isOpen) {
      var shouldAutoOpen = false;

      try {
        shouldAutoOpen = !window.localStorage.getItem(storageKey);
      } catch (e) {
        shouldAutoOpen = false;
      }

      if (shouldAutoOpen) {
        if (autoOpenTimer) clearTimeout(autoOpenTimer);
        var delay = settings.autoOpenDelay === '10s' ? 10000 : 5000;
        autoOpenTimer = window.setTimeout(function () {
          setOpen(true);
          try {
            window.localStorage.setItem(storageKey, 'true');
          } catch (e) {
            // ignore
          }
          autoOpenTimer = null;
        }, delay);
      }
    }
  }

  // Re-apply settings on resize (orientation change, window resize)
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (!settings) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      applySettings(settings);
    }, 150);
  }, { passive: true });

  // Remove old fetch that hit /api/widget-settings directly.
  // Config is now loaded via bootstrap in the .then chain above.
})();
