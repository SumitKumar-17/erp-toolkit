# Contributing

You don't need any of this to just use the extension — see the [README](./README.md#-installation) for that. This is only for people making changes to the code.

## Building from source

```bash
git clone https://github.com/SumitKumar-17/erp-toolkit.git
cd erp-toolkit
npm install
npm run build-dev     # rebuilds extension/ on every change (npm start to watch)
npm run build-prod    # minified production build
```

Either command outputs to the same `extension/` folder — reload it from `chrome://extensions` after each build.

CI automatically rebuilds `extension/`, bumps the patch version, and cuts a GitHub Release with a zipped build attached on every push to `main` — see `.github/workflows/build.yml`.

## Making a change

- Run `npm run pretty` before committing (Prettier + Tailwind class sorting).
- Keep `src/models/Messages.ts` in sync if you change how the popup and content scripts talk to each other.
- For anything touching the popup UI, include a before/after screenshot in your PR description.

## Opening a PR

Describe what changed and why. Small, focused PRs are easier to review than large ones.
