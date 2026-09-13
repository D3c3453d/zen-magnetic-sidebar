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

  const tabs = gZenVerticalTabsManager;
  const root = document.documentElement;
  let magnetRight = null;
  let zenRightSide, nativeWindowsButtons;

  // `!==` on booleans is XOR.
  const sidebarOnRight = () =>
    pref(PREFS + "move_tabs", true) && magnetRight !== null
      ? magnetRight !== pref(PREFS + "invert_tabs", false)
      : zenRightSide();
  // Zen nests the window controls into the sidebar header only when their style matches
  // the sidebar's side, so declaring the opposite style keeps them in the toolbar instead.
  const windowsStyledButtons = () =>
    pref(PREFS + "move_window_controls", true)
      ? sidebarOnRight() !== pref(PREFS + "controls_outside_sidebar", true)
      : nativeWindowsButtons;

  // Re-layout only when the DOM disagrees with the wanted state: Zen's _updateEvent() is costly.
  const apply = () => {
    if (window.windowState === window.STATE_MINIMIZED) return; // Windows parks minimized windows at -32000,-32000
    magnetRight = nearestEdgeIsRight();
    const right = sidebarOnRight() && tabs._prefsVerticalTabs;
    const reversed = !windowsStyledButtons();
    if (right === root.hasAttribute("zen-right-side") && reversed === root.hasAttribute("zen-window-buttons-reversed")) return;
    root.toggleAttribute("zen-window-buttons-reversed", reversed);
    tabs._updateEvent(); // sets zen-right-side and relocates the window controls
  };

  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 100); // MozUpdateWindowPos fires on every step of a drag
  };

  const install = () => {
    nativeWindowsButtons = tabs.isWindowsStyledButtons; // read before shadowing
    // Keep Zen's own getter reachable: it owns the weakly registered pref observer that makes
    // Zen re-layout every window when the pref changes. Read it once first, because the first
    // read replaces the property with the final getter and would clobber our shadow.
    void tabs._prefsRightSide;
    zenRightSide = Object.getOwnPropertyDescriptor(tabs, "_prefsRightSide").get;
    magnetRight = nearestEdgeIsRight();

    // Zen caches the side in four places per window; shadow them all with live getters.
    const shadow = (obj, prop, get) => Object.defineProperty(obj, prop, { configurable: true, get });
    shadow(tabs, "_prefsRightSide", sidebarOnRight);
    shadow(tabs, "isWindowsStyledButtons", windowsStyledButtons);
    shadow(gZenCompactModeManager, "sidebarIsOnRight", sidebarOnRight);
    shadow(gBrowser.tabContainer, "_sidebarPositionStart", () => !sidebarOnRight());

    window.windowRoot.addEventListener("MozUpdateWindowPos", schedule); // chrome-only, non-bubbling
    window.addEventListener("resize", schedule);
    window.addEventListener("sizemodechange", schedule);
    Services.prefs.addObserver(PREFS, schedule);
    window.addEventListener("unload", () => Services.prefs.removeObserver(PREFS, schedule), { once: true });
  };

  if (tabs._multiWindowFeature) {
    // Zen has already laid out this window.
    install();
    apply();
  } else {
    // Hook in right after Zen defines its pref getters and before its first layout, so the
    // window opens with the sidebar already on the right side instead of jumping there.
    const { initializePreferences } = tabs;
    tabs.initializePreferences = function (...args) {
      initializePreferences.apply(this, args);
      install();
    };
  }
})();
