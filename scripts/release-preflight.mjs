throw new Error(
    'Publication blocked: semantic-release currently repacks after version/changelog preparation, ' +
        'so consumer QA cannot prove the final published tarball. Implement prepare -> immutable tarball ' +
        '-> consumer QA -> publish the same tarball before enabling releases. See CONTRIBUTING.md.'
)
