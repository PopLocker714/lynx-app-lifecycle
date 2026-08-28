# Contributing

> **English** · [Русский](./CONTRIBUTING.ru.md)

## Commits decide the version

Versions are never set by hand. `semantic-release` reads the commit history and decides,
so a commit prefix is a version claim.

| Prefix | Bump | CHANGELOG section |
|---|---|---|
| `feat:` | minor | ✨ Features |
| `fix:` | patch | 🐛 Bug Fixes |
| `perf:` | patch | 💨 Performance Improvements |
| `refactor:` | patch | 🔄 Code Refactors |
| `docs:` | patch | 📚 Documentation |
| `chore:` | patch | 🛠️ Other changes |
| `BREAKING CHANGE:` in the body | major | its own section |

A commit with no recognised prefix triggers no release.

## Local checks

```sh
bun run typecheck
bun run lint
bun run test
bun run build
node scripts/check-publishable.mjs
```

That last one is mandatory and not decorative: Autolink compiles the native sources on the
consumer's machine, so a tarball missing `android/` or `ios/` is a dead library, and the
only place you would find out is inside someone else's app.

Compiling the Android half without a host app:

```sh
cd android-check && gradle :lynx-app-lifecycle:assembleRelease
```

## Documentation comes in two languages

Every doc file has an English original and a Russian counterpart: `README.md` and
`README.ru.md`, `CONTRIBUTING.md` and `CONTRIBUTING.ru.md`. Both READMEs ship in the npm
tarball and both are enforced by `check-publishable.mjs`.

Editing one without the other is an unfinished change. The Russian version is a full
translation, not a shortened summary.

## Release

Actions → Release → Run workflow. Manual only, `main` only.

Tick `dry_run` to compute the next version and preview the changelog without publishing
anything.

## Device check

Unit tests exercise the TypeScript half against a fake. They never touch the native half,
so any release that changes `android/` or `ios/` needs a real run inside a Lynx app on
both platforms.

What to check: the module is found at all (otherwise see the README section on silent
failures), the buffer length matches what was requested, and two consecutive calls return
different bytes.
