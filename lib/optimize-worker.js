/*
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var fs = require('fs');
var UglifyJS = require('uglify-js');

process.on('uncaughtError', function(err) {
  process.send({type: 'error', error: err});
});

process.on('message', function(msg) {
  if(msg.type === 'exit') {
    process.disconnect();
    process.exit();
  }
  if(msg.type === 'uglify2') {
    try {
      var result = UglifyJS.minify(msg.file, msg.options);
      fs.writeFileSync(msg.file, result.code, {encoding: 'utf8'});
    } catch(e) {
      process.send({type: 'error', error: e});
      return;
    }
  }
  process.send({type: 'ready'});
});

process.send({type: 'ready'});
