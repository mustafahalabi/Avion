# App icons & build resources

`electron-builder` reads packaging resources (icons, entitlements, installer
backgrounds) from this directory (`directories.buildResources: assets`).

Drop in platform icons to brand the installers — without them electron-builder
falls back to the default Electron icon:

| File              | Platform | Notes                                  |
| ----------------- | -------- | -------------------------------------- |
| `icon.icns`       | macOS    | 512×512 (1024 retina) recommended      |
| `icon.ico`        | Windows  | multi-size .ico (256×256 down to 16)   |
| `icon.png`        | Linux    | 512×512                                |
| `entitlements.mac.plist` | macOS | only needed for signed/notarised builds |

Generate all three from a single 1024×1024 PNG with a tool such as
[`electron-icon-builder`](https://www.npmjs.com/package/electron-icon-builder).
