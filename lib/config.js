/*
 * Bedrock RequireJS Module Configuration
 *
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
var cc = bedrock.util.config.main.computer();
var config = bedrock.config;
var path = require('path');

config.requirejs = {};
config.requirejs.bower = {};
config.requirejs.bower.componentsUrl = '/bower-components';
config.requirejs.bower.ignore = ['almond', 'requirejs'];
config.requirejs.bower.ignoreConfig = [];
config.requirejs.bower.bowerrc = {};
config.requirejs.bower.bowerrc.directory = 'bower_components';
// for manually-configured bower packages; these will generate requirejs
// config entries (packages or shims) just like reading a `bower.json` file
config.requirejs.bower.packages = [];
/* Example:
config.requirejs.bower.packages.push({
  path: <the path to the directory with the `bower` package>,
  // the contents of the `bower.json` file, needs, at a minimum
  // the `name` and `main` javascript file; to generate a requirejs `package`
  // then the moduleType should be set to 'amd'
  manifest: {
    name: 'example',
    moduleType: 'amd',
    main: './example.js',
    // include dependencies as usual; if not included some features that
    // other packages provide such as automatic angular template minification
    // via `bedrock-views` will not work for your package
    dependencies: {
      angular: '~1.3.0'
    }
  }
});
*/

// main requirejs base config -- anything listed in this config won't be
// overwritten when generating the rest of the config from installed
// bower packages
config.requirejs.config = {
  baseUrl: '/',
  config: {},
  deps: [],
  packages: [],
  paths: {},
  shim: {}
};

// any modules to automatically load once requirejs is initialized on
// the client; this will currently be auto-populated with any detected
// bower packages
config.requirejs.autoload = [];
// early dependencies to load before loading `autoload` modules
config.requirejs.config.deps = ['requirejs/events', 'es6-promise'];
// code to use to wrap around the config
config.requirejs.configPrefix = path.join(__dirname, '../config.prefix');
config.requirejs.configSuffix = path.join(__dirname, '../config.suffix');

// optimization config
config.requirejs.optimize = {};
config.requirejs.optimize.config = {
  baseUrl: '.',
  config: {},
  include: ['requirejs/main'],
  insertRequire: ['requirejs/main'],
  name: 'almond',
  packages: [],
  paths: {
    almond: path.join(__dirname, '../bower_components/almond/almond')
  },
  preserveLicenseComments: false,
  optimize: 'uglify2',
  uglify2: {
    compress: {
      global_defs: {
        DEBUG: false
      },
      sequences: false,
      unused: false
    },
    //warnings: true,
    mangle: false
  },
  wrap: true
};
cc('requirejs.optimize.config.out', () => path.join(
  config.paths.cache, 'bedrock-requirejs', 'main.min.js'));

// documentation config
config.docs.ignore.push('/requirejs/main.js');
config.docs.ignore.push('/requirejs/events.js');
