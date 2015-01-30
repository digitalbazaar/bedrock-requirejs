/*
 * Bedrock RequireJS Module
 *
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var async = require('async');
var bedrock = require('bedrock');
var fs = require('fs');
var path = require('path');
var primary = require('bower-requirejs/lib/primary');
var requirejs = require('requirejs');
var temp = require('temp');

// load config defaults
require('./config');

// module API
var api = {};
module.exports = api;

var logger = bedrock.loggers.get('app');
var packages;

bedrock.events.on('bedrock.init', function() {
  // TODO: should read .bowerrc to init
  // bedrock.config.requirejs.bower.bowerrc here

  // serve bower components
  bedrock.config.express.static.push({
    route: bedrock.config.requirejs.bower.componentsUrl,
    path: bedrock.config.requirejs.bower.bowerrc.directory
  });

  // load any bedrock configs
  var pkgs = api.readBowerPackagesSync();
  for(var name in pkgs) {
    pkgs[name].requireBedrockConfig();
  }
});

// add routes
bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  var autoload = bedrock.config.requirejs.autoload.slice();
  var config = api.buildConfigSync({autoload: autoload});

  // serve RequireJS config as `main.js`
  var configJS = api.wrapConfigSync({config: config, autoload: autoload});
  app.get('/requirejs/main.js', function(req, res) {
    res.contentType('application/javascript');
    res.send(200, configJS);
  });

  // serve module that provides a simple event emitter API
  var eventsJS = fs.readFileSync(
    path.join(__dirname, 'events.js'), {encoding: 'utf8'});
  app.get('/requirejs/events.js', function(req, res) {
    res.contentType('application/javascript');
    res.send(200, eventsJS);
  });
}

// TODO: provide async api.buildConfig as well?

/**
 * Builds a RequireJS config from bedrock.config.
 *
 * @param options the options to use:
 *          [componentsUrl] the components URL to use, defaults to:
 *            bedrock.config.requirejs.bower.componentsUrl.
 *          [autoload] an array of autoload modules to populate based
 *            on all entries added to the config, but not including
 *            any there were present in the base config; to add these,
 *            prepopulate the autoload option.
 *
 * @return the RequireJS config.
 */
api.buildConfigSync = function(options) {
  options = options || {};

  // build requirejs config
  var config = bedrock.tools.clone(bedrock.config.requirejs.config);
  config.packages = config.packages || [];
  config.paths = config.paths || {};
  config.shim = config.shim || {};

  var pkgs = api.readBowerPackagesSync();
  for(var name in pkgs) {
    var pkg = pkgs[name];
    _addPackageToConfig(pkgs, pkg, config, options);
  }

  return config;
};

/**
 * Wraps a RequireJS config in a JS function for consumption by RequireJS.
 *
 * @param [options] the options to use:
 *          [config] the config to wrap, if none is provided the default will
 *            be built.
 *          [autoload] an array of autoload modules to populate and require.
 *
 * @return the wrapped config as a string.
 */
api.wrapConfigSync = function(options) {
  options = options || {};
  var config = options.config || api.buildConfigSync(options);
  var prefix = fs.readFileSync(
    bedrock.config.requirejs.configPrefix, {encoding: 'utf8'});
  var suffix = fs.readFileSync(
    bedrock.config.requirejs.configSuffix, {encoding: 'utf8'});
  return prefix + _configToJavaScript(config, options.autoload) + suffix;
};

/**
 * Wraps a RequireJS config in a JS function for consumption by RequireJS.
 *
 * @param [options] the options to use:
 *          [config] the config to wrap, if none is provided the default will
 *            be built.
 *          [autoload] an array of autoload modules to populate and require.
 * @param callback(err, config) called once the operation completes.
 */
api.wrapConfig = function(options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options = null;
  }
  options = options || {};
  async.auto({
    config: function(callback) {
      if(options.config) {
        return callback(null, options.config);
      }
      api.buildConfig(options, callback);
    },
    prefix: function(callback) {
      fs.readFile(
        bedrock.config.requirejs.configPrefix, {encoding: 'utf8'},
        callback);
    },
    suffix: function(callback) {
      fs.readFile(
        bedrock.config.requirejs.configSuffix, {encoding: 'utf8'},
        callback);
    },
    assemble: ['config', 'prefix', 'suffix', function(callback, results) {
      callback(
        null,
        results.prefix +
        _configToJavaScript(results.config, options.autoload) +
        results.suffix);
    }]
  }, function(err, results) {
    callback(err, results.assemble);
  });
};

api.readBowerPackagesSync = function() {
  // return cached packages
  if(packages) {
    return packages;
  }
  var pkgs = {};
  packages = pkgs;

  var componentsDir = bedrock.config.requirejs.bower.bowerrc.directory;
  if(!fs.existsSync(componentsDir)) {
    logger.warning('bedrock-requirejs could not read bower packages; "' +
      componentsDir + '" does not exist.');
    return pkgs;
  }
  logger.debug('bedrock-requirejs reading bower packages from "' +
    componentsDir + '"...');

  /* Note: Here we read manifests from what is installed, not from the main
  bower.json manifest. This is simpler than tracing dependencies and will
  capture new packages that may not be in bower.json yet, but has the drawback
  of potentially introducing errors when installing from bower.json that aren't
  seen otherwise. */
  fs.readdirSync(componentsDir).forEach(function(file) {
    // check for bower.json
    var filename;
    try {
      filename = _getBowerManifestFile(file);
    } catch(e) {
      logger.warning('bedrock-requirejs skipped "' + file + '" when ' +
        'loading packages; could not find a bower manifest file.');
      return;
    }

    // build package, read bower.json
    var pkg = {
      path: path.dirname(filename),
      manifest: {}
    };
    try {
      pkg.manifest = _readJsonFile(filename);
    } catch(e) {
      logger.warning('bedrock-requirejs skipped "' + file + '" when ' +
        'loading packages; could not read the bower manifest file.', e);
      return;
    }
    logger.debug('bedrock-requirejs read bower manifest from "' +
      filename + '".');
    pkgs[pkg.manifest.name] = pkg;

    // find main files by filename or extension
    pkg.findMainFiles = function(options) {
      if(typeof options === 'string') {
        options = {extension: options};
      }
      var rval = [];
      var main = pkg.manifest.main || [];
      if(!Array.isArray(main)) {
        main = [main];
      }
      for(var i = 0; i < main.length; ++i) {
        if((options.filename && path.basename(main[i]) === options.filename) ||
          options.extension && path.extname(main[i]) === options.extension) {
          rval.push(main[i]);
        }
      }
      return rval;
    };

    // require the bedrock config from the package, if possible
    pkg.requireBedrockConfig = function() {
      if(!pkg.bedrock || !pkg.bedrock.config) {
        return false;
      }
      // ensure dependencies are met before loading config
      var deps = pkg.bedrock.dependencies || {};
      for(var dep in deps) {
        // TODO: check version as well
        if(!(dep in pkgs)) {
          return false;
        }
      }
      var configFile = path.resolve(path.join(pkg.path, pkg.bedrock.config));
      require(configFile)(bedrock);
      return true;
    };

    // skip bedrock.json
    if(_isPackageBedrockConfigIgnored(pkg.manifest.name)) {
      return;
    }

    // load bedrock.json
    filename = path.resolve(path.join(pkg.path, 'bedrock.json'));
    if(!fs.existsSync(filename)) {
      return;
    }
    try {
      pkg.bedrock = _readJsonFile(filename);
    } catch(e) {
      logger.warning('bedrock-requirejs could not read bedrock.json from ' +
        'bower package "' + pkg.manifest.name + '".', e);
      return;
    }
    logger.debug(
      'bedrock-requirejs read bedrock.json from bower package "' +
      pkg.manifest.name + '".');
  });

  return pkgs;
};

/**
 * Optimizes all modules found in the default RequireJS config into a
 * single file. An auto module loader is also prepended to the optimized
 * file such that only one request needs to be made be a user agent to
 * obtain all RequireJS modules and execute them.
 *
 * @param [options] the options to use.
 *          [onBuildRead] called for each module that is read prior to
 *            optimizing it, allowing transforms to be performed on the
 *            module information; useful for converting annotations
 *            into source.
 * @param callback(err) called once the operation completes.
 */
api.optimize = function(options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options = null;
  }
  options = options || {};

  // create main config
  var autoload = bedrock.config.requirejs.autoload.slice();
  var mainConfig = api.buildConfigSync({
    autoload: autoload,
    componentsUrl: bedrock.config.requirejs.bower.bowerrc.directory
  });

  // write main config file for consumption by requirejs lib
  var mainConfigFile;
  try {
    mainConfigFile = _writeTempConfig(
      api.wrapConfigSync({config: mainConfig, autoload: autoload}));
  } catch(e) {
    return callback(e);
  }

  // create optimize config
  var buildConfig = bedrock.tools.clone(
    bedrock.config.requirejs.optimize.config);
  buildConfig.mainConfigFile = mainConfigFile;
  buildConfig.paths.requirejs = __dirname,
  buildConfig.paths['requirejs/main'] = path.join(
    path.dirname(mainConfigFile), path.basename(mainConfigFile, '.js'));
  buildConfig.onBuildRead = function(moduleName, path, contents) {
    if(options.onBuildRead) {
      return options.onBuildRead.apply(null, arguments);
    }
    return contents;
  };

  requirejs.optimize(buildConfig, function(buildResponse) {
    logger.info('RequireJS optimization complete.');
    console.log('Output: ', buildResponse);
    //buildResponse is just a text output of the modules
    //included. Load the built file for the contents.
    //Use config.out to get the optimized file contents.
    //var contents = fs.readFileSync(config.out, 'utf8');
    callback();
  }, function(err) {
    logger.error('RequireJS optimization failed', err);
    callback(err);
  });
};

function _getBowerManifestFile(pkg) {
  var dir = bedrock.config.requirejs.bower.bowerrc.directory;
  // check for bower.json, then .bower.json, then components.json
  var filename;
  ['bower.json', '.bower.json', 'components.json'].forEach(function(type) {
    if(filename) {
      return;
    }
    filename = path.join(dir, pkg, type);
    if(!fs.existsSync(filename)) {
      filename = null;
    }
  });
  if(!filename) {
    throw new Error('No bower manifest file found for package "' + pkg + '".');
  }
  return filename;
}

function _readJsonFile(filename) {
  return JSON.parse(fs.readFileSync(filename, {encoding: 'utf8'}));
}

function _addPackageToConfig(pkgs, pkg, config, options) {
  // skip entry if already configured
  if(pkg.manifest.name in config.paths) {
    return;
  }
  // skip if in ignore list
  if(_isPackageIgnored(pkg.manifest.name)) {
    return;
  }

  var primaryJS = _getPrimaryJS(pkg);
  if(!primaryJS) {
    logger.warning('skipped "' + pkg.manifest.name + '" when building ' +
      'RequireJS config; could not find a main JavaScript file.');
    return;
  }

  if(options.autoload) {
    // add autoload entry
    options.autoload.push(pkg.manifest.name);
  }

  var moduleType = pkg.manifest.moduleType || [];
  if(!Array.isArray(moduleType)) {
    moduleType = [moduleType];
  }

  var componentsUrl = ('componentsUrl' in options ?
    options.componentsUrl : bedrock.config.requirejs.bower.componentsUrl);

  // add `packages` entry
  if(moduleType.indexOf('amd') !== -1 || moduleType.indexOf('node') !== -1) {
    // do not override existing entry
    if(config.packages.filter(function(e) {
      return (e.name === pkg.manifest.name);
    }).length === 0) {
      config.packages.push({
        name: pkg.manifest.name,
        main: primaryJS,
        location: path.join(componentsUrl, pkg.manifest.name)
      });
    }
    return;
  }

  // add `paths` entry
  config.paths[pkg.manifest.name] = path.join(
    componentsUrl, pkg.manifest.name,
    path.dirname(primaryJS), path.basename(primaryJS, '.js'));

  // do not override existing shim
  if(config.shim[pkg.manifest.name]) {
    return;
  }

  // add `shim` entry
  var shim;
  if(moduleType.indexOf('globals') !== -1) {
    shim = config.shim[pkg.manifest.name] = {
      exports: pkg.manifest.name
    };
  }

  // add `shim` dependencies
  var deps = Object.keys(pkg.manifest.dependencies || {});
  deps = deps.filter(function(dep) {
    // include as a RequireJS dependency if there's JS or it's not ignored
    var pkg = pkgs[dep] || {};
    return _getPrimaryJS(pkg) && !_isPackageIgnored(pkg.manifest.name);
  });
  if(deps.length > 0) {
    if(!shim) {
      shim = config.shim[pkg.manifest.name] = {};
    }
    shim.deps = deps;
  }
}

function _getPrimaryJS(pkg) {
  var main = pkg.findMainFiles('.js');
  if(main.length > 0) {
    return main[0];
  }
  return primary(pkg.manifest.name, {canonicalDir: pkg.path});
}

function _configToJavaScript(config, autoload) {
  // FIXME: remove promise.polyfill() once done automatically by es6-promise
  // build callback
  var callback = [
    'function(events, promise) {',
    '    promise.polyfill();',
    '    var deps = ' + JSON.stringify(config.deps) + ';',
    '    var args = {};',
    '    for(var i = 0; i < arguments.length; ++i) {',
    '      args[deps[i]] = arguments[i];',
    '    }',
    '    events.emit("bedrock.requirejs.bootstrap", args);',
    '    require(' + JSON.stringify(autoload) + ', function() {',
    '      events.emit("bedrock.requirejs.ready");',
    '    });',
    '  }'].join('\n');
  config.callback = {};
  var js = JSON.stringify(config, null, 2);
  return js.replace('"callback": {}', '"callback": ' + callback);
}

function _writeTempConfig(config) {
  // clean up temp files at exit
  temp.track();
  var info = temp.openSync({prefix: 'bedrock-requirejs.', suffix: '.js'});
  var data = new Buffer(config, 'utf8');
  fs.writeSync(info.fd, data, 0, data.length, 0);
  fs.closeSync(info.fd);
  return info.path;
}

function _isPackageIgnored(name) {
  return bedrock.config.requirejs.bower.ignore.indexOf(name) !== -1;
}

function _isPackageBedrockConfigIgnored(name) {
  return bedrock.config.requirejs.bower.ignoreConfig.indexOf(name) !== -1;
}
