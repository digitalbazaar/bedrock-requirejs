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
var less = require('less');

// module API
var api = {};
module.exports = api;

var logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock.modules.init', function() {
  // TODO: should read .bowerrc to init
  // bedrock.config.requirejs.bower.bowerrc here
});

// add routes
bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  var autoload = bedrock.config.requirejs.autoload.slice();
  var config = api.buildConfigSync({autoload: autoload});

  // serve RequireJS config as `main.js`
  var configJS = api.wrapConfigSync(config);
  app.get('/requirejs/main.js', function(req, res) {
    res.contentType('application/javascript');
    res.send(200, configJS);
  });

  // serve module that loads autoload modules
  var autoloadJS = 'define(' + JSON.stringify(autoload) + ', function() {});';
  app.get('/requirejs/autoload.js', function(req, res) {
    res.contentType('application/javascript');
    res.send(200, autoloadJS);
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
  // TODO: this is somewhat hacky -- required to preserve functions
  if(bedrock.config.requirejs.config.callback) {
    config.callback = bedrock.config.requirejs.config.callback;
  }

  var pkgs = _readPackagesSync();
  for(var name in pkgs) {
    var pkg = pkgs[name];
    _addPackageToConfig(pkgs, pkg, config, options);
  }

  return config;
};

/**
 * Wraps a RequireJS config in a JS function for consumption by RequireJS.
 *
 * @param [config] the config to wrap, if none is provided the default will
 *          be built.
 * @return the wrapped config as a string.
 */
api.wrapConfigSync = function(config) {
  if(!config) {
    config = api.buildConfigSync();
  }
  var start = fs.readFileSync(
    bedrock.config.requirejs.configWrapperStart, {encoding: 'utf8'});
  var end = fs.readFileSync(
    bedrock.config.requirejs.configWrapperEnd, {encoding: 'utf8'});
  return start + _configToJavaScript(config) + end;
};

/**
 * Wraps a RequireJS config in a JS function for consumption by RequireJS.
 *
 * @param [config] the config to wrap, if none is provided the default will
 *          be built.
 * @param callback(err, config) called once the operation completes.
 */
api.wrapConfig = function(config, callback) {
  if(typeof config === 'function') {
    callback = config;
    config = null;
  }
  async.auto({
    config: function(callback) {
      if(config) {
        return callback(null, config);
      }
      api.buildConfig(callback);
    },
    start: function(callback) {
      fs.readFile(
        bedrock.config.requirejs.configWrapperStart, {encoding: 'utf8'},
        callback);
    },
    end: function(callback) {
      fs.readFile(
        bedrock.config.requirejs.configWrapperEnd, {encoding: 'utf8'},
        callback);
    },
    assemble: ['config', 'start', 'end', function(callback, results) {
      callback(null, results.start + _configToJavaScript(results.config) +
        results.end);
    }]
  }, function(err, results) {
    callback(err, results.assemble);
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

function _readBowerManifest(filename) {
  return JSON.parse(fs.readFileSync(filename, {encoding: 'utf8'}));
}

function _readPackagesSync() {
  var pkgs = {};

  var componentsDir = bedrock.config.requirejs.bower.bowerrc.directory;
  if(!fs.existsSync(componentsDir)) {
    return pkgs;
  }

  /* Note: Here we read manifests from what is installed, not from the main
  bower.json manifest. This is simpler than tracing dependencies and will
  capture new packages that may not be in bower.json yet, but has the drawback
  of potentially introducing errors when installing from bower.json that aren't
  seen otherwise. */
  fs.readdirSync(componentsDir).forEach(function(file) {
    var filename;
    try {
      filename = _getBowerManifestFile(file);
    } catch(e) {
      logger.warning('skipped "' + file + '" when loading packages; ' +
        'could not find a bower manifest file.');
    }
    var pkg = {
      path: path.dirname(filename),
      manifest: {}
    };
    pkg.manifest = _readBowerManifest(filename);
    pkgs[pkg.manifest.name] = pkg;
  });

  return pkgs;
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

  var componentsUrl = (options.componentsUrl ||
    bedrock.config.requirejs.bower.componentsUrl);

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
  var main = _findMainFiles(pkg, '.js');
  if(main.length > 0) {
    return main[0];
  }
  return primary(pkg.manifest.name, {canonicalDir: pkg.path});
}

function _configToJavaScript(config) {
  var callback = config.callback;
  if(callback) {
    delete config.callback;
    config.callback = {};
  }
  var js = JSON.stringify(config, null, 2);
  if(callback) {
    js = js.replace('"callback": {}', '"callback": ' + callback.toString());
  }
  return js;
}

function _findMainFiles(pkg, extension) {
  var rval = [];
  var main = pkg.manifest.main || [];
  if(!Array.isArray(main)) {
    main = [main];
  }
  for(var i = 0; i < main.length; ++i) {
    if(path.extname(main[i]) === extension) {
      rval.push(main[i]);
    }
  }
  return rval;
}

function _isPackageIgnored(name) {
  return bedrock.config.requirejs.bower.ignore.indexOf(name) !== -1;
}

function _compileLess(options, callback) {
  var pkgs = _readPackagesSync();

  if(Object.keys(pkgs).length === 0) {
    // nothing to compile
    return;
  }

  // create less source
  var src = '';
  for(var name in pkgs) {
    var pkg = pkgs[name];

    // find less files first, then css files
    var extension = '.less';
    var files = _findMainFiles(pkg, extension);
    if(files.length === 0) {
      extension = '.css';
      files = _findMainFiles(pkg, extension);
    }

    if(!files) {
      // nothing to import
      return;
    }

    files.forEach(function(file) {
      src += '@import ';
      if(extension === '.css') {
        src += '(less) ';
      }
      src += path.join(pkg.path, pkg.name, file) + ';\n';
    });
  }

  // TODO: expose in bedrock.config.requirejs
  var opts = {
    strictMath: true,
    sourceMap: false,
    outputSourceFiles: false
  };
  less.render(src, opts, function(err, output) {
    if(err) {
      return callback(err);
    }
    // output.css = string of css
    // output.map = string of sourcemap
    // output.imports = array of string filenames of the imports referenced
    // TODO: write output to disk per options.file
    callback(null, output);
  });
}
