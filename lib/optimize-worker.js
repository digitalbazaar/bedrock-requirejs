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
      const code = fs.readFileSync(msg.file, {encoding: 'utf8'});
      const result = UglifyJS.minify(code, msg.options);
      if(result.error) {
        throw result.error;
      }
      fs.writeFileSync(msg.file, result.code, {encoding: 'utf8'});
    } catch(e) {
      process.send({type: 'error', error: e});
      return;
    }
  }
  process.send({type: 'ready'});
});

process.send({type: 'ready'});
