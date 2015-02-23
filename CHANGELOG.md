# bedrock-requirejs ChangeLog

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


[Unreleased]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.2...HEAD
[0.1.2]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/digitalbazaar/bedrock-requirejs/compare/0.1.0...0.1.1
