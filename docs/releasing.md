[English](./releasing.md) · [Русский](./releasing.ru.md)

# Immutable release artifacts

Publishing is manual and remains unavailable until a final version, complete acceptance
and remote configuration exist. Local `release` / `prepublishOnly` deliberately fail.
`release:dry-run` is only semantic-release analysis; it never authorizes publication.
No version is changed automatically, no Git tag or GitHub release is created by this pipeline.

## Prerequisites

Commit the intended stable `package.json` version and its `CHANGELOG.md` heading on main.
The repository uses the small `scripts/release` filesystem/CLI module; the package API and
native implementation are independent of this tooling. `release/policy.json` owns the
required acceptance checks. Changing that policy requires review before preparing a candidate.

Configure npm Trusted Publishing for this repository and **release.yml**. The publish job
uses GitHub's **npm-release** environment; additional reviewer/branch protections are optional
repository policy. Explicit manual dispatch by an authorized maintainer is the release approval;
no second reviewer is required by this tooling. Repository administrators control settings and workflow code.
No long-lived npm token is configured. These remote settings and execution have not been
verified by local unit tests. The workflow uses GitHub-hosted runners, Node 22.14.0 and npm
11.21.2 (installed by Bun from the lockfile).

Bun handles installs, scripts and packing. The sole npm adapter is publishing the accepted
`.tgz` through Node: Bun currently cannot generate provenance. `NPM_CONFIG_PROVENANCE=true`
and `--provenance` are explicit; `--ignore-scripts` prevents lifecycle repacking/execution.

## Prepare, test, publish

1. Dispatch **Release → stage=prepare** on main. Reusable CI runs against that same commit
   (JS/package, dependency audit, Android and iOS checks). After successful CI, preparation
   rejects dirty/private/development-version source, packs once through `check:package`,
   inspects those bytes, and uploads **release-candidate** for 90 days. The artifact contains
   `package.tgz` and `manifest.json`: name, version, source commit, SHA256, policy hash,
   repository and prepare run ID. Other CI tarballs are not release candidates.
2. Download **release-candidate** from that specific run. Install its `package.tgz` in the
   locked host fixture and complete the required consumer/device checks. Inspect the exact
   archive without repacking via `RELEASE_TARBALL=/absolute/package.tgz bun run check:package`.
   Native-source-binding checks and actual Debug/Release device QA remain separate from the
   mocked packaged API smoke. Minimum-OS and critical checks must be covered honestly.
3. Commit `release/qa.json` plus nonempty evidence under `release/evidence/` on main. Copy
   candidate identity from its manifest; compute SHA256 for each evidence file. Keep all
   package/runtime/docs/workflow files unchanged after preparation. Any change outside the
   receipt/evidence directory requires a new prepare run. Evidence files must be tracked,
   relative, inside the checkout and match their hashes. Do not commit secrets or test tokens.
4. Dispatch **Release → stage=publish** on main with the **prepare_run_id** and accepted
   **sha256**. The gate checks GitHub's run provenance (repository, workflow, event, main,
   success, source ancestry), manifest and actual tarball bytes, unchanged package source,
   source-pinned policy and complete QA. A separate publish job repeats the
   gate and publishes exactly the downloaded `package.tgz`; it never calls pack/build or
   semantic-release. CI is inherited from the successful prepare run, not a different commit.
5. Verify registry/provenance after publication. An existing name/version cannot be replaced.
   If publication succeeded but the job lost its response, inspect the registry before any
   retry. If the artifact expires, prepare a new candidate and revalidate its identity; do
   not reconstruct it and silently reuse the old receipt.

## QA receipt contract

The receipt is a reviewed assertion by the named responsible person, not a cryptographic
proof that a phone was tested. Hashes protect identity and accidental substitution. The
reviewer must inspect evidence content and the actual profile. Every ID in
`release/policy.json.requiredChecks` must have exactly one passing row, a nonempty profile
and evidence list; any nonpassing additional row or unresolved `gaps` blocks publication.
For device rows, record host/runtime/ReactLynx, OS/device, build configuration and artifact
hashes in evidence. `native-source-bindings` proves the installed native roots; minimum
checks cover the declared OS floor. Independent review evidence records findings/resolution.

Example shape only — **not release acceptance** (replace every placeholder with real data):

```json
{
    "schemaVersion": 1,
    "name": "@lynx-lab/app-lifecycle",
    "version": "<final version>",
    "sourceCommit": "<40 hex source commit>",
    "sha256": "<64 hex tarball SHA256>",
    "prepareRunId": "<prepare run ID>",
    "acceptedBy": "<responsible reviewer>",
    "acceptedAt": "<ISO date>",
    "gaps": [],
    "checks": [
        {
            "id": "android-release-r8",
            "status": "pass",
            "profile": "<host/runtime, Android version/device, Release/R8>",
            "evidence": [
                { "path": "release/evidence/android-release.json", "sha256": "<64 hex>" }
            ]
        }
    ]
}
```

Documentation-only reuse is allowed after explicit comparison of the old and new archives:
retain the prior device evidence and a hashed equivalence report proving unchanged runtime,
native code and declarations, name both archive hashes, and explain the accepted scope in the
new receipt's evidence. Do not relabel old runs as testing a new tarball. Version/metadata or
runtime changes need their applicable checks; an unresolved critical gap cannot be waived
by an equivalence report. No real QA receipt is generated automatically or included here.

## Sources

- [Bun publishing and provenance limitation](https://bun.sh/docs/pm/cli/publish)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub artifact downloads](https://github.com/actions/download-artifact)
- [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

The publish job reruns `check:audit` before publication to catch newly reported advisories
and expired exceptions even when the prepare artifact is still retained. The npm adapter
resolves the existing audited semantic-release → @semantic-release/npm → npm 11.21.2
dependency, checks its exact version, and invokes only its CLI tarball publisher.

## Finalize Git identity after publication

After registry/provenance success is confirmed, create the version tag on the exact
`manifest.sourceCommit`, never on the later QA commit. Verify an existing tag points there;
do not move or force-push it. Push the tag/create GitHub release only with explicit release
authorization. This manual finalization is needed by native podspec source URLs using version
tags; the workflow does not perform it. Decide SemVer and commit version/changelog before prepare.
