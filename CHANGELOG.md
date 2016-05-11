# bedrock-requirejs ChangeLog

## [Unreleased]

## [2.0.2] - 2016-05-11

### Added
- Add warning for missing dependencies.

## [2.0.1] - 2016-03-15

### Changed
- Update bedrock dependencies.

## [2.0.0] - 2016-03-02

### Changed
- Update deps for npm v3 compatibility.

## [1.1.1] - 2016-02-16

### Changed
- Switched from underscore to lodash.
- Updated dependencies.

## [1.1.0] - 2015-11-25

### Added
- Custom bower packages configurations can now specify manifest as a path
  to a `bower.json` file.

## [1.0.1] - 2015-09-28

### Changed
- Only process dependency package if loaded, otherwise ignore it.

## [1.0.0] - 2015-04-08

### Added
- Feature to allow custom configuration of bower packages.

### Changed
- **BREAKING**: Changed frontend event names from `bedrock.requirejs.*` to
  `bedrock-requirejs.*`. Changed `bedrock-requirejs.bootstrap` to
  `bedrock-requirejs.init`.

### Fixed
- Various path handling issues for optimized and un-optimized setups.

## [0.1.3] - 2015-02-23

### Added
- Add ability for non-bower installed packages to use components at runtime and
  during optimization. For example, if you have a project with
  `components/example/` you can add it with the following config code:

```javascript
config.requirejs.config.packages.push({
  name: 'example'
  main: 'example.js'
  location: 'bower-components/example'
});
config.requirejs.optimize.config.packages.push({
  name: 'example'
  main: 'example.js'
  location: path.join(..., 'components/example')
});
config.express.static.push({
  route: '/bower-components/example',
  path: path.join(..., 'components/example')
});
config.requirejs.autoload.push('example');
```

## [0.1.2] - 2015-02-16

### Changed
- Fix bower installation.

## [0.1.1] - 2015-02-16

### Changed
- Use path to invoke bower.

## 0.1.0 - 2015-02-16

- See git history for changes.

[Unreleased]: https://github.com/digitalbazaar/bedrock-requirejs/compare/2.0.2...HEAD
[2.0.2]: https://github.com/digitalbazaar/bedrock-requirejs/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/digitalbazaar/bedrock-requirejs/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/digitalbazaar/bedrock-requirejs/compare/1.1.1...2.0.0
[1.1.1]: https://github.com/digitalbazaar/bedrock-requirejs/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/digitalbazaar/bedrock-requirejs/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/digitalbazaar/bedrock-requirejs/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.3...1.0.0
[0.1.3]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.0...0.1.1
