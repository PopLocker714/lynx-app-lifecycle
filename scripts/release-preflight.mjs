throw new Error(
    'Direct publication is disabled. Commit the final version/changelog, use release.yml prepare, ' +
        'test that immutable artifact, commit release/qa.json and evidence, then dispatch publish. ' +
        'See docs/releasing.md; no local bypass variable is supported.'
)
