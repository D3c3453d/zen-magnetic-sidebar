# Magnetic Sidebar for Zen Browser

Keeps the vertical tab sidebar on the screen edge nearest to the window, **per window**:
a window on the left monitor gets its sidebar on the left, a window on the right monitor
gets it on the right. The window controls (close / minimize / maximize) are placed relative
to the sidebar too: by default they stay out of it, in the main toolbar; optionally they
move into the sidebar header. The sidebar placement can also be inverted in the settings.

The side is re-evaluated whenever the window is moved, resized, maximized or restored.
When both edges are equally far away (for example, a window maximized on a single monitor)
the mod defers to Zen's own `zen.tabs.vertical.right-side` setting.

Zen's `zen.tabs.vertical.right-side` and `zen.view.experimental-force-window-controls-left`
preferences are global, so the mod never writes them. Instead it overrides, inside each
window, the values Zen has cached from those preferences and asks Zen to re-layout.

## Requirements

- Zen Browser with vertical tabs (the default layout). Tested on Zen 1.22 / Windows.
- A JS-capable mod loader: [Sine](https://github.com/CosmoCreeper/Sine) or
  [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig). Zen's built-in Mods store
  only supports CSS and cannot run this mod.

## Installation

### Sine

1. In `about:config` set `sine.allow-unsafe-js` to `true` (required for mods that are not
   in the Sine store).
2. In Sine, install the mod from its repository URL:
   `https://github.com/D3c3453d/zen-magnetic-sidebar`
3. Restart Zen.

### fx-autoconfig

1. Copy `zen-magnetic-sidebar.uc.js` into `<profile>/chrome/JS/`
   (find the profile folder in `about:profiles`).
2. Clear the startup cache (`about:support` → "Clear startup cache…") and restart Zen.

## Settings

Available in Sine's mod settings, or in `about:config`:

| Preference | Type | Default | Effect |
|---|---|---|---|
| `magnetic_sidebar.move_tabs` | Boolean | `true` | Move the tab sidebar to the nearest screen edge (per-window `zen.tabs.vertical.right-side`). |
| `magnetic_sidebar.invert_tabs` | Boolean | `false` | Invert: keep the sidebar on the side away from the nearest edge. |
| `magnetic_sidebar.move_window_controls` | Boolean | `true` | Let the mod place the window controls (per-window `zen.view.experimental-force-window-controls-left`). |
| `magnetic_sidebar.controls_outside_sidebar` | Boolean | `true` | Keep the window controls out of the sidebar, in the main toolbar. Off moves them into the sidebar header, on the sidebar's side. |

Turning both `move_*` options off restores Zen's default behaviour without a restart.

## Limitations

- Wayland does not expose window positions, so the mod cannot tell where a window is
  and leaves Zen's global setting in effect.
- macOS has not been tested.

## License

[MIT](LICENSE)
