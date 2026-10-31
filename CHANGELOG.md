# Changelog

All notable changes to this project will be documented in this file.

## v2.1.0

[compare changes](https://github.com/PKief/changelog-machine/compare/v2.0.0...v2.1.0)

### Enhancements

- Delegate version updates to configurable commands ([0c7c2b7e](https://github.com/PKief/changelog-machine/commit/0c7c2b7e603253d4c06593b37423f4e04c164cf1))

### Contributors

- Philipp Kief

## v2.0.0

[compare changes](https://github.com/PKief/changelog-machine/compare/v1.1.0...v2.0.0)

### Breaking Changes

- Redesign changelog generation with incremental updates ([c9b0eeed](https://github.com/PKief/changelog-machine/commit/c9b0eeed6b0dd8f9e3b4ad5cf530dc0327832c27))
  - Replace the printMarkdown API and JSON configuration with the new CLI and functional ESM API; require Node 22 or newer.

### Enhancements

- Add animated progress indicator for long-running operations ([c0ce5e1b](https://github.com/PKief/changelog-machine/commit/c0ce5e1bcad6ecec1c543cdf4ca17263deb02389))
- Exclude release bookkeeping messages from changelog generation ([8f9cb07c](https://github.com/PKief/changelog-machine/commit/8f9cb07c7bfe16e77f50bc45002aa84721aa7bd5))
- Ensure commit order is preserved in changelog and add tests for release commit reading ([87213bf4](https://github.com/PKief/changelog-machine/commit/87213bf462af119ba1be76498ff379cf7967ac9d))
- Capitalize commit messages and breaking notes in changelog ([b62db0c6](https://github.com/PKief/changelog-machine/commit/b62db0c6922c574130adf25f0dee571547e13180))
- Update README for clarity and improved usage instructions ([97981257](https://github.com/PKief/changelog-machine/commit/979812570c122e5b117f8e8324d43578b67a9d8c))
- Implement author grouping and caching for contributor resolution ([613459b2](https://github.com/PKief/changelog-machine/commit/613459b227b6d778eb6e2a7af50ec20dccd04292))
- Add issue linking functionality in commit messages and render output ([2d3dd849](https://github.com/PKief/changelog-machine/commit/2d3dd84944ff6275748d3d58d65d92065fd6f03c))
- Enhance contributor resolution with progress reporting and update tests ([6062c33e](https://github.com/PKief/changelog-machine/commit/6062c33e7c5b279b1b857e9e30fd7d58a109214a))
- Upgrade Node.js version requirements and dependencies to 24+ ([c5c22b3b](https://github.com/PKief/changelog-machine/commit/c5c22b3b7636fdcf57c0beb92f9edaafdfdccf6b))
- Update changelog on bump and simplify releases ([a4be7433](https://github.com/PKief/changelog-machine/commit/a4be7433c54f62e4ee1e2317eddad8b4e5a88068))

### Documentation

- Explain incremental changelogs and version workflows ([533ba373](https://github.com/PKief/changelog-machine/commit/533ba373d9250e8b48573a9265e8bda929ad08cc))

### Tests

- Refactor CLI integration tests for improved structure and readability ([cb9684e6](https://github.com/PKief/changelog-machine/commit/cb9684e63f7594f87b606875534254a1374a7413))

### CI

- Validate supported Node versions and publish tagged releases ([606779f9](https://github.com/PKief/changelog-machine/commit/606779f9dabeb3f8a8e149cb56384c561efccf9a))

### Chores

- Update license copyright year ([f4386a40](https://github.com/PKief/changelog-machine/commit/f4386a40da9be1496312586cfdd9b2cb9817f961))
- Reorganize changelog structure and enhance formatting ([20523e72](https://github.com/PKief/changelog-machine/commit/20523e72a0a38e4f0e03fe8af8183dcbf9ca653c))

### Contributors

- Philipp Kief

## v1.1.0

[compare changes](https://github.com/PKief/changelog-machine/compare/v1.0.2...v1.1.0)

### Enhancements

- Add meta information ([#3](https://github.com/PKief/changelog-machine/pull/3))

### Fixes

- Handle missing package.json or version attribute ([#4](https://github.com/PKief/changelog-machine/pull/4))

## v1.0.2

[compare changes](https://github.com/PKief/changelog-machine/compare/v1.0.1...v1.0.2)

### Fixes

- Fix wrong HEAD reference in link ([e4387c4](https://github.com/PKief/changelog-machine/commit/e4387c4))

## v1.0.1

[compare changes](https://github.com/PKief/changelog-machine/compare/v1.0.0...v1.0.1)

### Enhancements

- Add display name ([3ec29b0](https://github.com/PKief/changelog-machine/commit/3ec29b0))

### Chores

- Update meta info ([c09294a](https://github.com/PKief/changelog-machine/commit/c09294a))
