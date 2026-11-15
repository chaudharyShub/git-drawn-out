<p align="center">
  <a href="https://git-drawn-out.vercel.app"><img src="assets/images/og-image.png" alt="Git, Drawn Out: a commit graph with main, feature, origin and HEAD" width="720"></a>
</p>

<h1 align="center">Git, Drawn Out</h1>

<p align="center">
  A visual field guide to Git. Commits, branches, HEAD, remotes and stash, drawn as diagrams you can play with.
  <br><br>
  <a href="https://git-drawn-out.vercel.app"><b>Live demo →</b></a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-BF1A5A">
  <img alt="No build step" src="https://img.shields.io/badge/build-none-1E66C8">
  <img alt="Deployed on Vercel" src="https://img.shields.io/badge/deployed%20on-Vercel-151A28">
</p>

## What's inside

- **Mental model.** Commits, branches and HEAD as a few kinds of pointers.
- **Playground.** Step through commands and watch the commit graph change.
- **Three areas.** Working folder, staging area and commits.
- **Under the hood.** What actually lives in `.git`.
- **Concepts and commands.** Reset and reflog, detached HEAD, stash, and the commands worth knowing.

The graph colors carry meaning: **blue** = branch, **pink** = HEAD, **green** = remote, **amber** = stash.

## Why this exists

I made this guide for myself while learning Git, because diagrams made it click in a way the docs didn't. Later I thought, why not make it public? If it helps you too, that's a win.

## Run locally

It's a single static page with no build step. Clone the repo and open `index.html` in a browser.

```bash
git clone https://github.com/chaudharyShub/git-drawn-out.git
cd git-drawn-out
```

## Project structure

```
git-drawn-out/
├── index.html            # the guide
├── 404.html              # "Detached HEAD" not-found page
├── css/
│   ├── tokens.css        # colors (light + dark), fonts — shared by every page
│   ├── main.css          # styles for the guide
│   └── 404.css           # styles for the 404 page
├── js/
│   └── main.js           # commit-graph renderer, playground and hero animation
├── assets/
│   ├── icons/            # favicon.svg, favicon-32, apple-touch-icon, 192/512 app icons
│   └── images/           # og-image.png (social preview)
├── design/               # HTML sources for the images (not deployed)
├── docs/                 # notes, e.g. the shared Shubham Works footer (not deployed)
├── site.webmanifest      # app name and icons for "Add to Home Screen"
├── robots.txt
├── sitemap.xml
├── vercel.json           # clean URLs and cache headers
└── LICENSE
```

## Deploy

Hosted on [Vercel](https://vercel.com) as a static site. Every push to `main` deploys to production, and other branches get preview URLs.

## License

[MIT](LICENSE) © Shubham Chaudhary
