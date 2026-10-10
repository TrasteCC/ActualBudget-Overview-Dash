# Contributing

Issues and pull requests are welcome. Keep changes small and focused; open an issue first for
anything larger than a fix.

## Setup

```bash
npm install
DEMO=1 npm run dev          # made-up data, no Actual server needed
```

To work against a real budget, copy `.env.example` to `.env.local` and fill in your server.

Before opening a pull request:

```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Rules

- **No personal data, ever.** Screenshots, fixtures and examples come from `DEMO=1`. Never commit
  real transactions, account names, Sync IDs or server URLs.
- Secret scanning runs as a pre-commit hook: `pip install pre-commit && pre-commit install`
  (uses [gitleaks](https://github.com/gitleaks/gitleaks)).
- Every rule the dashboard applies is configuration (env or the settings page), not code.
- `@actual-app/api` is pinned to the Actual release it was tested with. Image tags follow that
  version: a release is a `vYY.M.x` git tag matching the pinned API.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
