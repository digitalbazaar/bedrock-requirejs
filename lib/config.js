/*
 * Bedrock RequireJS Module Configuration
 *
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;
var path = require('path');

config.requirejs = {};
config.requirejs.bower = {};
config.requirejs.bower.componentsUrl = '/bower-components';
config.requirejs.bower.manifestFile = 'bower.json';
config.requirejs.bower.ignore = ['almond', 'requirejs'];
config.requirejs.bower.ignoreConfig = [];
config.requirejs.bower.bowerrc = {};
config.requirejs.bower.bowerrc.directory = 'bower_components';
// main requirejs base config -- anything listed in this config won't be
// overwritten when generating the rest of the config from installed
// bower packages
config.requirejs.config = {
  baseUrl: '/',
  deps: [],
  packages: [],
  paths: {},
  shim: {}
};
config.requirejs.autoload = [];
config.requirejs.config.deps = ['requirejs/events', 'es6-promise'];
config.requirejs.configPrefix = path.join(__dirname, '../config.prefix');
config.requirejs.configSuffix = path.join(__dirname, '../config.suffix');

// optimization config
config.requirejs.optimize = {};
config.requirejs.optimize.config = {
  baseUrl: '.',
  name: 'almond',
  include: ['requirejs/main'],
  insertRequire: ['requirejs/main'],
  paths: {
    almond: path.join(config.requirejs.bower.bowerrc.directory, 'almond/almond')
  },
  out: 'optimized.js',
  preserveLicenseComments: false,
  wrap: true,
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
  }
};
