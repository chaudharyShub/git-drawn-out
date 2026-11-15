# Design sources

HTML templates the site's images are rendered from. They aren't deployed (see `.vercelignore`).

| Template | Output |
|---|---|
| `og-image.html` | `assets/images/og-image.png` (1200×630 social preview) |
| `cover-wide.html` | Blog post cover for dev.to and Hashnode (1000:420, rendered at 2× = 2000×840). Not kept in the repo; render it when you need it. |
| `icon.html` | `assets/icons/*` (favicon and app icons) |

## Re-render

Uses headless Microsoft Edge (Chrome works the same with its own path). Run from the repo root:

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

# Social preview
"$EDGE" --headless=new --hide-scrollbars --virtual-time-budget=5000 \
  --window-size=1200,630 --screenshot="assets/images/og-image.png" "file:///$PWD/design/og-image.html"

# Blog cover (1000:420, rendered at 2x)
"$EDGE" --headless=new --hide-scrollbars --virtual-time-budget=5000 --force-device-scale-factor=2 \
  --window-size=1000,420 --screenshot="$USERPROFILE/Desktop/cover-1000x420.png" "file:///$(pwd -W)/design/cover-wide.html"

# Icon master (512px, transparent). Headless browsers won't go below ~500px wide,
# so render at 512 and downscale for the 192/180/32 sizes.
"$EDGE" --headless=new --hide-scrollbars --default-background-color=00000000 \
  --window-size=512,512 --screenshot="assets/icons/icon-512.png" "file:///$PWD/design/icon.html"
```

`apple-touch-icon.png` uses square corners (change `rx="7"` to `rx="0"` in `icon.html` before rendering), because iOS rounds the corners itself.

If you change the icon, also update `assets/icons/favicon.svg`, which is the same drawing.
