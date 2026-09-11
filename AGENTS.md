# Project conventions

- This is a build-free static HTML/CSS/ES-module portfolio. Three.js, GSAP, Lenis and fonts are vendored locally.
- Keep asset references relative (`./` and `../`) so GitHub Pages project subpaths work. Keep `.nojekyll` at the publishing root.
- Local preview: `python3 -m http.server 8642` from the repository root. ES modules require HTTP; do not use file://.
- Syntax checks: `node --check js/main.js && node --check js/webgl.js && node --check js/playground.js && node --check js/art.js`.
- Browser checks: verify widths 320, 390, 768, 1024 and 1440; scene buttons; mobile menu; project details; project category filters and email copy; reduced motion and JavaScript-disabled readability. Test under `/portfolio/` as well as `/`.
- GitHub Pages needs no build: publish the branch root through Settings > Pages > Deploy from a branch.
- Project cards are explicitly labeled concept studies, not shipped work. Timeline employers and contact details remain illustrative placeholders. Replace with verified personal content before public launch.
- The Touch the Math section was removed at the user's request. playground.js is not imported or executed; do not reintroduce the lab. The replacement is the #approach bento section.
