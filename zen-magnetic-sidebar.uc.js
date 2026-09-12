// ==UserScript==
// @name           Zen Magnetic Sidebar
// @description    Moves each window's tab sidebar and window controls to the screen edge nearest to the window
// @include        main
// ==/UserScript==

(() => {
  const PREFS = "magnetic_sidebar.";
  const pref = (name, fallback) => Services.prefs.getBoolPref(name, fallback);

  // ---- Geometry, all in desktop pixels ----

  const screens = Cc["@mozilla.org/gfx/screenmanager;1"].getService(Ci.nsIScreenManager);
  const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });

  const windowRect = () => {
    const win = window.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
    const [x, y, w, h] = [{}, {}, {}, {}];
    win.getPositionAndSize(x, y, w, h);
    const k = win.devicePixelsPerDesktopPixel;
    return box(x.value / k, y.value / k, w.value / k, h.value / k);
  };

  const screenRect = ({ left, top, right, bottom }) => {
    const [l, t, w, h] = [{}, {}, {}, {}];
    screens.screenForRect(left, top, right - left, bottom - top).GetRectDisplayPix(l, t, w, h);
    return box(l.value, t.value, w.value, h.value);
  };

  // Gecko cannot enumerate monitors, but screenForRect() returns the screen nearest to a
  // point, so we hop from neighbour to neighbour until no screen lies beyond the edge.
  const desktopEdge = (screen, dir) => {
    for (;;) {
      const x = dir < 0 ? screen.left - 1 : screen.right;
      const y = Math.round((screen.top + screen.bottom) / 2);
      const next = screenRect(box(x, y, 1, 1));
      const beyond = dir < 0 ? next.right <= screen.left : next.left >= screen.right;
      if (!beyond) return dir < 0 ? screen.left : screen.right;
      screen = next;
    }
  };

  // true = right edge is nearer, false = left, null = equidistant
  const nearestEdgeIsRight = () => {
    const win = windowRect();
    const screen = screenRect(win);
    const toLeft = win.left - desktopEdge(screen, -1);
    const toRight = desktopEdge(screen, +1) - win.right;
    return toLeft === toRight ? null : toRight < toLeft;
  };

  // ---- Per-window overrides of Zen's cached "sidebar is on the right" ----

  const init = () => {
    const tabs = gZenVerticalTabsManager;
    const nativeWindowsButtons = tabs.isWindowsStyledButtons; // read before shadowing
    let magnetRight = null;

    const sidebarOnRight = () =>
      pref(PREFS + "move_tabs", true) && magnetRight !== null
        ? magnetRight
        : pref("zen.tabs.vertical.right-side", false);
    const windowsStyledButtons = () =>
      pref(PREFS + "move_window_controls", true) ? sidebarOnRight() : nativeWindowsButtons;

    // Zen caches the pref in four places per window; shadow them all with live getters.
    const shadow = (obj, prop, get) => Object.defineProperty(obj, prop, { configurable: true, get });
    shadow(tabs, "_prefsRightSide", sidebarOnRight);
    shadow(tabs, "isWindowsStyledButtons", windowsStyledButtons);
    shadow(gZenCompactModeManager, "sidebarIsOnRight", sidebarOnRight);
    shadow(gBrowser.tabContainer, "_sidebarPositionStart", () => !sidebarOnRight());

    let applied;
    const apply = () => {
      magnetRight = nearestEdgeIsRight();
      const state = [sidebarOnRight(), windowsStyledButtons()].join();
      if (state === applied) return;
      applied = state;
      document.documentElement.toggleAttribute("zen-window-buttons-reversed", !windowsStyledButtons());
      tabs._updateEvent(); // sets zen-right-side and relocates the window controls
    };

    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 100); // MozUpdateWindowPos fires on every step of a drag
    };

    window.windowRoot.addEventListener("MozUpdateWindowPos", schedule); // chrome-only, non-bubbling
    window.addEventListener("resize", schedule);
    window.addEventListener("sizemodechange", schedule);
    Services.prefs.addObserver(PREFS, schedule);
    window.addEventListener("unload", () => Services.prefs.removeObserver(PREFS, schedule), { once: true });

    apply();
  };

  gZenStartup.promiseInitialized.then(init);
})();
