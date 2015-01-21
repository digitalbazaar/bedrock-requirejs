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
  // serve RequireJS config as `main.js`
  var config = api.wrapConfigSync();
  app.get('/requirejs/main.js', function(req, res) {
    res.contentType('application/javascript');
    res.send(200, config);
  });
}

// TODO: provide async api.buildConfig as well?

/**
 * Builds a RequireJS config from bedrock.config.
 *
 * @param options the options to use:
 *          [componentsUrl] the components URL to use, defaults to:
 *            bedrock.config.requirejs.bower.componentsUrl.
 *
 * @return the RequireJS config.
 */
api.buildConfigSync = function(options) {
  options = options || {};

  // build requirejs config
  var config = bedrock.tools.clone(bedrock.config.requirejs.config);
  config.packages = config.packages || [];
  config.paths = config.paths || {};
  config.shim = config.shims || {};

  var componentsDir = bedrock.config.requirejs.bower.bowerrc.directory;
  if(!fs.existsSync(componentsDir)) {
    // no components to parse
    return config;
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
      logger.warning('skipped "' + file + '" when building RequireJS ' +
        'config; could not find a bower manifest file.');
    }
    var pkg = {
      path: path.dirname(filename),
      manifest: {}
    };
    pkg.manifest = _readBowerManifest(filename);
    _applyPackage(pkg, config, options);
  });

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
  return start + JSON.stringify(config, null, 2) + end;
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
      callback(null, results.start + JSON.stringify(results.config, null, 2) +
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

function _applyPackage(pkg, config, options) {
  // skip entry if already configured
  if(pkg.manifest.name in config.paths) {
    return;
  }

  var primaryJS = _getPrimaryJS(pkg);
  if(!primaryJS) {
    logger.warning('skipped "' + pkg.manifest.name + '" when building ' +
      'RequireJS config; could not find a main JavaScript file.');
    return;
  }

  var moduleType = pkg.manifest.moduleType || [];
  if(!Array.isArray(moduleType)) {
    moduleType = [moduleType];
  }

  // add `paths` entry
  var componentsUrl = (options.componentsUrl ||
    bedrock.config.requirejs.bower.componentsUrl);
  config.paths[pkg.manifest.name] = path.join(
    componentsUrl, pkg.manifest.name, primaryJS);

  // nothing else to do if module type is undefined or AMD is supported
  if(moduleType.length === 0 || moduleType.indexOf('amd') !== -1) {
    return;
  }

  // add `packages` entry
  if(moduleType.indexOf('node') !== -1) {
    config.packages.push({
      name: pkg.manifest.name,
      main: primaryJS,
      location: path.join(componentsUrl, pkg.manifest.name)
    });
    return;
  }

  // add `shim` entry
  config.shim[pkg.manifest.name] = {
    exports: pkg.manifest.name,
    deps: Object.keys(pkg.manifest.dependencies || {})
  };
}

function _getPrimaryJS(pkg) {
  var main = _findMainFiles(pkg, '.js');
  if(main[0]) {
    return main[0];
  }
  return primary(pkg.manifest.name, {canonicalDir: pkg.path});
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

function _compileLess(options, callback) {
  // TODO: code here is very similar to RequireJS config building,
  // abstract into its own function w/transform function as an option?
  var componentsDir = bedrock.config.requirejs.bower.bowerrc.directory;
  if(!fs.existsSync(componentsDir)) {
    // nothing to compile
    return;
  }

  var src = '';

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
      logger.warning('skipped "' + file + '" when compiling less; ' +
        'could not find a bower manifest file.');
    }
    var pkg = {
      path: path.dirname(filename),
      manifest: {}
    };
    pkg.manifest = _readBowerManifest(filename);

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
  });

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
