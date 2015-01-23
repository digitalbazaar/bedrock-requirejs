/*!
 * Bedrock RequireJS Events AMD module.
 *
 * This module provide a minimal (incomplete implementation) of
 * node's EventEmitter API.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 *
 * @author Dave Longley
 */
define([], function() {

'use strict';

var api = {};

var _listeners = {};

/**
 * Emits an event and its subsequent arguments to any listeners.
 *
 * @param event the event to emit (a string).
 */
api.emit = function(event) {
  var listeners = _listeners[event] || [];
  for(var i = 0; i < listeners.length; ++i) {
    listeners[i].apply(api, Array.prototype.slice.call(arguments, 1));
  }
};

/**
 * Registers an event listener for a particular event.
 *
 * @param event the event to register for.
 * @param listener the handler function to call when the event is emitted.
 */
api.on = function(event, listener) {
  if(event in _listeners) {
    _listeners[event].push(listener);
  } else {
    _listeners[event] = [listener];
  }
};

/**
 * Removes a particular listener for a particular event.
 *
 * @param event the event to unregister from.
 * @param listener the listener to remove.
 */
api.removeListener = function(event, listener) {
  var listeners = _listeners[event] || [];
  var idx = listeners.indexOf(listener);
  if(idx !== -1) {
    listeners.splice(idx, 1);
  }
};

return api;

});
