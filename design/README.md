# Design sources

HTML templates the site's images are rendered from. They aren't deployed (see `.vercelignore`).

| Template | Output |
|---|---|
| `og-image.html` | `assets/images/og-image.png` (1200×630 social preview) |
| `icon.html` | `assets/icons/*` (favicon and app icons) |

## Re-render

Uses headless Microsoft Edge (Chrome works the same with its own path). Run from the repo root:

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

# Social preview
"$EDGE" --headless=new --hide-scrollbars --virtual-time-budget=5000 \
  --window-size=1200,630 --screenshot="assets/images/og-image.png" "file:///$PWD/design/og-image.html"

# Icon master (512px, transparent). Headless browsers won't go below ~500px wide,
# so render at 512 and downscale for the 192/180/32 sizes.
"$EDGE" --headless=new --hide-scrollbars --default-background-color=00000000 \
  --window-size=512,512 --screenshot="assets/icons/icon-512.png" "file:///$PWD/design/icon.html"
```

`apple-touch-icon.png` uses square corners (change `rx="7"` to `rx="0"` in `icon.html` before rendering), because iOS rounds the corners itself.

If you change the icon, also update `assets/icons/favicon.svg`, which is the same drawing.
