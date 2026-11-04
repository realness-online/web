export default {
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'none',
    arrowParens: 'avoid',
    printWidth: 120,
    sortPackageJson: false,
    overrides: [{ files: ['*.md', '*.mdx'], options: { printWidth: 80 } }],
    ignorePatterns: ['node_modules/', 'agent/', 'runtime/', 'examples/', 'bin/specs/fixtures/']
  }
}
