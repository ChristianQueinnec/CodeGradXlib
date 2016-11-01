/**

Javascript Library to interact with the CodeGradX infrastructure.

## Installation

```bash
npm install codegradxlib
```

## Usage

This library makes a huge usage of promises as may be seen in the following
use case:

```javascript
// Example of use:
var CodeGradX = require('codegradxlib');

new CodeGradX.State(postInitializer);


CodeGradX.getCurrentState().
  // ask for user's login and password:
  getAuthenticatedUser(login, password).
    then(function (user) {
       // let the user choose one campaign among user.getCampaigns()
       // let us say that we choose campaign 'free':
       user.getCampaign('free').
         then(function (campaign) {
           // let the user choose one exercise among campaign.getExercisesSet()
           campaign.getExercise('some.exercise.name').
             then(function (exercise) {
               exercise.getDescription().
                 then(function (description) {
                   // display stem of exercise and get user's answer:
                   exercise.sendFileAnswer("some.filename").
                     then(function (job) {
                       // wait for the marking report:
                       job.getReport().
                         then(function (job) {
                           // display job.report
```

More details on the protocols and formats used to interact with the
CodeGradX infrastructure can be found in the documentation of
{@link http://paracamplus.com/CodeGradX/Resources/overview.pdf|CodeGradX}.


@module codegradxlib
@author Christian Queinnec <Christian.Queinnec@codegradx.org>
@license MIT
@see {@link http://codegradx.org/|CodeGradX} site.
*/

// Possible improvements:
// - name differently methods returning a Promise from others


function CodeGradX () {}

  /** Export the `CodeGradX` object */
module.exports = CodeGradX;

var _    = require('lodash');
var when = require('when');
var nodefn = require('when/node');
var rest = require('rest');
var mime = require('rest/interceptor/mime');
var registry = require('rest/mime/registry');
var xml2js = require('xml2js');
var xml2jsproc = require('xml2js/lib/processors');
var sax = require('sax');

// Define that additional MIME type:
registry.register('application/octet-stream', {
    read: function(str) {
        return str;
    },
    write: function(str) {
        return str;
    }
  });

// See http://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser
function _checkIsNode () {
  /*jshint -W054 */
  var code = "try {return this===global;}catch(e){return false;}";
  var f = new Function(code);
  return f();
}
/* Are we running under Node.js */
var isNode = _.memoize(_checkIsNode);

CodeGradX._str2num = function (str) {
  if (!isNaN(str)) {
    str = str % 1 === 0 ? parseInt(str, 10) : parseFloat(str);
  }
  return str;
};

CodeGradX._str2Date = function (str) {
  var ms = Date.parse(str);
  if ( ! isNaN(ms) ) {
    var d = new Date(ms);
    //console.log("STR:" + str + " => " + ms + " ==> " + d);
    return d;
  } else {
    throw new Error("Cannot parse Date" + str);
  }
};

// **************** Log ********************************

/** Record facts in a log. This is useful for debug!
    A log only keeps the last `size` facts.
    Use the `show` method to display it.
    See also helper method `debug` on State to log facts.

     @constructor
     @property {Array<string>} items - array of kept facts
     @property {number} size - maximal number of facts to keep in the log

  */

CodeGradX.Log = function () {
    this.items = [];
    this.size = 90;
};

/** Log some facts. The facts (the arguments) will be concatenated
    (with a separating space) to form a string to be recorded in the log.

    @method CodeGradX.Log.debug
    @param {Value} arguments - facts to record
    @returns {Log}
    @lends CodeGradX.Log.prototype
    @alias module:codegradxlib.debug
    */

CodeGradX.Log.prototype.debug = function () {
  // Separate seconds from milliseconds:
  var msg = (''+_.now()).replace(/(...)$/, ".$1") + ' ';
  for (var i=0 ; i<arguments.length ; i++) {
    if ( arguments[i] === null ) {
      msg += 'null ';
    } else if ( arguments[i] === undefined ) {
      msg += 'undefined ';
    } else {
      msg += arguments[i].toString() + ' ';
    }
  }
  if ( this.items.length > this.size ) {
    this.items.splice(0, 1);
  }
  this.items.push(msg);
  return this;
};

/** Display the log with `console.log`.

    @method show
    @returns {Log}
    @memberof {CodeGradX.Log#}

  */

CodeGradX.Log.prototype.show = function () {
  // console.log is run later so take a copy of the log now to
  // avoid displaying a later version of the log:
  var items = this.items.slice(0);
  console.log(items);
  return this;
};

/** Display the log with `console.log` and empty it.

    @method showAndRemove
    @returns {Log}
    @memberof {CodeGradX.Log#}

  */

CodeGradX.Log.prototype.showAndRemove = function () {
  // console.log is run later so take a copy of the log now to
  // avoid displaying a later version of the log:
  var items = this.items;
  this.items = [];
  console.log(items);
  return this;
};

// **************** Global state *********************************

/** The global state records the instantaneous state of the various
  servers of the CodeGradX constellation. It also holds the current user,
  cookie and campaign. The global `State` class is a singleton that may
  be further customized with the `initializer` function. This singleton
  can be obtained with `getCurrentState()`.

     @constructor
     @param {Function} initializer - optional customizer
     @returns {State}

  The `initializer` will be invoked with the state as first argument.
  The result of initializer() will become the final state.

  */

CodeGradX.State = function (initializer) {
  this.userAgent = rest.wrap(mime);
  this.log = new CodeGradX.Log();
  // State of servers:
  this.servers = {
    // The domain to be suffixed to short hostnames:
    domain: '.paracamplus.com',
    // the shortnames of the four kinds of servers:
    names: ['a', 'e', 'x', 's'],
    // Description of the A servers:
    a: {
      // a0 and a1 are listed, 2 is the number of the next possible A server
      next: 2,
      // Use that URI to check whether the server is available or not:
      suffix: '/alive',
      0: {
        // a full hostname supersedes the default FQDN:
        host: 'a0.paracamplus.com',
        enabled: false
      },
      1: {
        // the default FQDN is a1.paracamplus.com
        enabled: false
      }
    },
    e: {
      next: 1,
      suffix: '/alive',
      0: {
        enabled: false
      }
    },
    x: {
      //next: 1,  // no next means that all possible servers are listed here:
      suffix: '/dbalive',
      protocol: 'https',
      0: {
        host: 'x.paracamplus.com',
        enabled: false
      }
    },
    s: {
      next: 1,
      suffix: '/index.txt',
      0: {
        enabled: false
      }
    }
  };
  // Current values
  this.currentUser = null;
  this.currentCookie = null;
  // Post-initialization
  var state = this;
  // Cache for jobs useful when processing batches:
  state.cache = {
      jobs: {} 
  };
  if ( _.isFunction(initializer) ) {
    state = initializer.call(state, state);
  }
  // Make the state global
  CodeGradX.getCurrentState = function () {
    return state;
  };
};

/** Get the current state (if defined).

  @returns {State}

*/

CodeGradX.getCurrentState = function () {
  throw new Error("noState");
};

/** Get current user (if defined). This is particularly useful when
    the user is not authenticated via getAuthenticatedUser() (for
    instance, via GoogleOpenId).

    @return {Promise<User>} yields {User}

*/

CodeGradX.getCurrentUser = function (force) {
    var state = CodeGradX.getCurrentState();
    if ( !force && state.currentUser ) {
        return when(state.currentUser);
    }
    state.debug('getCurrentUser1');
    return state.sendAXServer('x', {
        path: '/whoami',
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        entity: {}
    }).then(function (response) {
        //console.log(response);
        state.debug('getCurrentUser2', response);
        state.currentUser = new CodeGradX.User(response.entity);
        return when(state.currentUser);
    });
};

/** Helper function, add a fact to the log held in the current state
  {@see CodeGradX.Log.debug} documentation.

  @returns {Log}

*/

CodeGradX.State.prototype.debug = function () {
  return this.log.debug.apply(this.log, arguments);
};

/** Empty cache to gain room.
*/

CodeGradX.State.prototype.gc = function () {
    var state = this;
    state.cache.jobs = {};
};

/** Update the description of a server in order to determine if that
  server is available. The description may contain an optional `host`
  key with the name of the host to be checked. If the name is missing,
  the hostname is automatically inferred from the `kind`, `index` and
  `domain` information. After the check, the `enabled` key is set to
  a boolean telling wether the host is available or not.

  Description are gathered in `descriptions` with two additional keys:
  `suffix` is the path to add to the URL used to check the
  availability of the server. `next` if present is the index of a
  potentially available server of the same kind. No `next` property
  means that all possible servers are listed.

  @param {string} kind - the kind of server (a, e, x or s)
  @param {number} index - the number of the server.
  @returns {Promise<Response>} - Promise leading to {HTTPresponse}

  Descriptions are kept in the global state.
  */

CodeGradX.State.prototype.checkServer = function (kind, index) {
  var state = this;
  state.debug('checkServer1', kind, index);
  if ( ! state.servers[kind] ) {
    state.servers[kind] = {};
  }
  var descriptions = state.servers[kind];
  if ( ! descriptions[index] ) {
    descriptions[index] = { enabled: false };
  }
  var description = descriptions[index];
  var host = description.host || (kind + index + state.servers.domain);
  description.host = host;
  description.protocol = description.protocol || descriptions.protocol;
  description.protocol = description.protocol || 'http';
  // Don't use that host while being checked:
  description.enabled = false;
  delete description.lastError;
  function updateDescription (response) {
    state.debug('updateDescription', description.host, response);
    description.enabled = (response.status.code < 300);
    return when(response);
  }
  function invalidateDescription (reason) {
    state.debug('invalidateDescription', description.host, reason);
    description.enabled = false;
    description.lastError = reason;
    return when.reject(reason);
  }
  var url = description.protocol + "://" + host + descriptions.suffix;
  state.debug('checkServer2', kind, index, url);
  var request = {
      path: url
  };
  if ( kind !== 's' ) {
      request.mixin = {
          withCredentials: true
      };
  }
  return state.userAgent(request)
        .then(updateDescription)
        .catch(invalidateDescription);
};

/** Check all possible servers of some kind (a, e, x or s) that is,
    update the state for those servers. If correctly programmed
    these checks are concurrently run.

    If server ki (kind k, index i) emit an HTTPresponse, then
    descriptions.next (if present) should be at least greater than i.

    @param {string} kind - the kind of server (a, e, x or s)
    @returns {Promise} yields Array[HTTPresponse]

    */

CodeGradX.State.prototype.checkServers = function (kind) {
  var state = this;
  state.debug('checkServers', kind);
  var descriptions = state.servers[kind];
  function incrementNext (response) {
    if ( descriptions.next ) {
        if ( response.status.code < 300 ) {
            descriptions.next++;
        }
        state.debug('incrementNext', response, descriptions.next);
    }
    return when(descriptions);        
  }
  function dontIncrementNext (reason) {
    state.debug('dontIncrementNext', reason);
    return when(descriptions);
  }
  var promise, promises = [];
  var nextDone = false;
  if ( ! descriptions.next ) {
      nextDone = true;
  }
  for ( var key in descriptions ) {
    if ( /^\d+$/.exec(key) ) {
      key = CodeGradX._str2num(key);
      promise = state.checkServer(kind, key);
      if ( descriptions.next && key === descriptions.next ) {
         // Try also the next potential server:
         promise = promise.then(incrementNext);
         nextDone = true;
      }
      promise = promise.catch(dontIncrementNext);
      promises.push(promise);
    }
  }
  if ( ! nextDone ) {
      promise = state.checkServer(kind, descriptions.next)
          .then(incrementNext)
          .catch(dontIncrementNext);
      promises.push(promise);
  }
  function returnDescriptions () {
    state.debug('returnDescriptions', descriptions);
    promises.forEach(function (promise) { // probably useless!
        promise.done(descriptions);
    });
    return when(descriptions);
  }
  return when.settle(promises)
        .then(returnDescriptions)
        .catch(returnDescriptions);
};

/** Check all possible servers of all kinds (a, e, x or s) that is,
    update the state for all of those servers. If correctly programmed
    these checks are concurrently run.

    @returns {Promise} yields many mingled responses.

    */

CodeGradX.State.prototype.checkAllServers = function () {
  var state = this;
  state.debug('checkAllServers');
  var promises = _.map(this.servers.names, this.checkServers, this);
  return when.all(promises);
};

/** Check HTTP response and try to elaborate a good error message.

    Error messages look like:
    <?xml version="1.0" encoding="UTF-8"?>
    <fw4ex version='1.0'>
      <errorAnswer>
        <message code='400'>
          <reason>FW4EX e135 Not a tar gzipped file!</reason>
        </message>
      </errorAnswer>
    </fw4ex>
    */

CodeGradX.checkStatusCode = function (response) {
  var state = CodeGradX.getCurrentState();
  state.debug('checkStatusCode1', response);
  //console.log(response);
  var reasonRegExp = new RegExp("^(.|\n)*<reason>((.|\n)*)</reason>(.|\n)*$");
  function extractFW4EXerrorMessage (response) {
    var reason;
    var contentType = response.headers['Content-Type'];
    if ( /text\/xml/.exec(contentType) ) {
      //console.log(response.entity);
      reason = response.entity.replace(reasonRegExp, ": $2");
      return reason;
    } else if ( /application\/json/.exec(contentType) ) {
      reason = response.entity.reason;
      return reason;
    } else {
      return '';
    }
  }
  if ( response.status &&
       response.status.code &&
       response.status.code >= 300 ) {
      var msg = "Bad HTTP code " + response.status.code + ' ' +
        extractFW4EXerrorMessage(response);
      state.debug('checkStatusCode2', msg);
      //console.log(response);
      var error = new Error(msg);
      return when.reject(error);
  }
  return when(response);
};

/** Ask an A or X server.
    Send request to the first available server of the right kind.
    In case of problems, try sequentially the next available server of
    the same kind.

    @param {string} kind - the kind of server (a or x)
    @param {object} options - description of the HTTP request to send
    @property {string} options.path
    @property {string} options.method
    @property {object} options.headers - for instance Accept, Content-Type
    @property {object} options.entity - string or object depending on Content-Type
    @returns {Promise} yields {HTTPresponse}

    */

CodeGradX.State.prototype.sendAXServer = function (kind, options) {
  var state = this;
  state.debug('sendAXServer', kind, options);
  var newoptions = regenerateNewOptions();
  var adescriptions = getActiveServers();
  var checkServersCount = 0;

  function regenerateNewOptions (options) {
      var newoptions = _.assign({}, options);
      newoptions.headers = newoptions.headers || {};
      if ( isNode() && state.currentCookie ) {
          newoptions.headers.Cookie = state.currentCookie;
      }
      return newoptions;
  }
  function getActiveServers () {
    state.debug("Possible:", _.pluck(state.servers[kind], 'host'));
    //console.log(state.servers[kind]);
    var active = _.filter(state.servers[kind], {enabled: true});
    state.debug('Active:', _.pluck(active, 'host'));
    return active;
  }
  function updateCurrentCookie (response) {
    //console.log(response.headers);
    //console.log(response);
    state.debug('updateCurrentCookie', response);
    function extractCookie (tag) {
        if ( response.headers[tag] ) { // char case ?
            var cookies = response.headers[tag];
            cookies = _.map(cookies, function (s) {
                return s.replace(/;.*$/, '');
            });
            cookies = _.filter(cookies, function (s) {
                s = s.replace(/^u=/, '');
                return /^U/.exec(s);
            });
            return (state.currentCookie = cookies);
        }
    }
    if ( ! extractCookie('Set-Cookie') ) {
        extractCookie('X-CodeGradX-Cookie');
    }
    return when(response);
  }
  var lastReason;
  function tryNext (reason) {
    // Stop trying X servers as soon as one answers with a client error.
    if ( kind === 'x' &&
         _.isObject(reason) &&
         _.has(reason, 'kind') &&
         reason.kind === 'error' &&
         _.has(reason, 'code') &&
         reason.code === 400 ) {
        lastReason = reason;
        state.debug('tryNext3', 'stopX', reason);
        return when.reject(lastReason);
    }
    if ( _.isError(reason) ) {
        lastReason = reason;
    }
    state.debug('tryNext1', reason);
    if ( adescriptions.length > 0 ) {
      var description = _.first(adescriptions);
      adescriptions = _.rest(adescriptions);
      newoptions = regenerateNewOptions(options);
      newoptions.path = description.protocol + '://' +
            description.host + options.path;
      newoptions.mixin = {
          withCredentials: true
      };
      state.debug('tryNext2', newoptions.path);
      return state.userAgent(newoptions)
            .catch(mk_invalidate(description))
            .then(CodeGradX.checkStatusCode)
            .then(updateCurrentCookie)
            .catch(tryNext);
    } else if ( checkServersCount++ === 0 ) {
        return tryAll();
    } else if ( _.isError(lastReason) ) {
        return when.reject(lastReason);
    } else {
        return allTried(new Error("All unavailable servers " + kind));
    }
  }
  function mk_invalidate (description) {
    return function (reason) {
      state.debug('invalidate', description, reason);
      //console.log(reason);
      description.enabled = false;
      description.lastError = reason;
      return when.reject(reason);
    };
  }
  function allTried (reason) {
    state.debug('allTried', reason);
    return when.reject(reason);
  }
  function tryAll () {
    state.debug('tryAll', adescriptions);
    if ( adescriptions.length === 0 ) {
      // Determine available servers if not yet done:
      return state.checkServers(kind)
            .then(function (descriptions) {
                state.debug('sendAXServer2 ', descriptions);
                var adescriptions2 = getActiveServers();
                if ( adescriptions2.length === 0 ) {
                    return allTried(new Error('No available server ' + kind));
                } else {
                    adescriptions = adescriptions2;
                    return tryNext('goAgain');
                }
            }).catch(allTried);
    } else {
      return tryNext('goFirst');
    }
  }
  return tryAll();
};

/** Ask once an E or S server.
    Send request concurrently to all available servers. The fastest wins.

    @param {string} kind - the kind of server (e or s)
    @param {object} options - description of the HTTP request to send
    @property {string} woptions.path
    @property {string} options.method
    @property {object} options.headers - for instance Accept, Content-Type
    @property {object} options.entity - string or object depending on Content-Type
    @returns {Promise} yields {HTTPresponse}

    */

CodeGradX.State.prototype.sendESServer = function (kind, options) {
  var state = this;
  state.debug('sendESServer1', kind, options);
  var newoptions = _.assign({}, options);
  newoptions.headers = _.assign({}, options.headers);
  if ( isNode() && state.currentCookie ) {
      newoptions.headers.Cookie = state.currentCookie;
  }
  function getActiveServers () {
    state.debug("Possible:", _.pluck(state.servers[kind], 'host'));
    //console.log(state.servers[kind]);
    var active = _.filter(state.servers[kind], {enabled: true});
    state.debug('Active:', _.pluck(active, 'host'));
    return active;
  }
  function mk_seeError (description) {
    function seeError (reason) {
      // A MIME deserialization problem may also trigger `seeError`.
      function see (o) {
        var result = '';
        for ( var key in o ) {
          result += key + '=' + o[key] + ' ';
        }
        return result;
      }
      state.debug('seeError', see(reason));
      description.enabled = false;
      description.lastError = reason;
      //var js = JSON.parse(reason.entity);
      return when.reject(reason);
    }
    return seeError;
  }
  function tryRequesting (description) {
    var tryoptions = _.assign({}, newoptions);
    tryoptions.path = 'http://' + description.host + options.path;
    if ( kind === 'e' ) {
        tryoptions.mixin = {
            withCredentials: true
        };
    }
    state.debug("tryRequesting", tryoptions.path);
    return state.userAgent(tryoptions)
      .then(CodeGradX.checkStatusCode)
      .catch(mk_seeError(description));
  }
  function allTried (reason) {
    state.debug('allTried', reason);
    return when.reject(reason);
  }
  var adescriptions = getActiveServers();
  if ( adescriptions.length === 0 ) {
    return state.checkServers(kind).then(function (descriptions) {
      var adescriptions2 = getActiveServers();
      if ( adescriptions2.length === 0 ) {
        return when.reject(new Error("no available server " + kind));
      } else {
        state.debug('sendESServer2',  adescriptions2);
        var promises = _.map(adescriptions2, tryRequesting);
        return when.any(promises);
      }
    }).catch(allTried);
  } else {
    var promises = _.map(adescriptions, tryRequesting);
    return when.any(promises);
  }
};

/** Ask repeatedly an E or S server.
    Send request to all available servers and repeat in case of problems.

    @param {Object} parameters -
    @property {number} parameters.step - seconds between each attempt
    @property {number} parameters.attempts - at most n attempts
    @property {function} parameters.progress -
    @returns {Promise} yields {HTTPresponse}

    The `progress` function (parameters) {} is invoked before each attempt.
    By default, `parameters` is initialized with
    CodeGradX.State.prototype.sendRepeatedlyESServer.default

  Nota: when.any does not cancel the other concurrent promises. So use
  the boolean `shouldStop` to avoid invoking `retryNext` forever.
  */

CodeGradX.State.prototype.sendRepeatedlyESServer =
function (kind, parameters, options) {
  var state = this;
  var finalResponse;
  state.debug('sendRepeatedlyESServer', kind, parameters, options);
  var parms = _.assign({ i: 0 },
    CodeGradX.State.prototype.sendRepeatedlyESServer.default,
    parameters);
  function retryNext () {
    if ( finalResponse ) {
      return when(finalResponse);
    }
    state.debug("retryNext1", parms);
    try {
      parms.progress(parms);
    } catch (exc) {
      // ignore problems raised by progress()!
    }
    if ( parms.i++ < parms.attempts ) {
      state.debug("retryNext2", parms.i, parms.attempts);
      var promise = state.sendESServer(kind, options)
         .then(function (response) {
                if ( response.status.code >= 300 ) {
                    return when.reject(new Error(response.status.code));
                } else {
                    finalResponse = response;
                    return when(response);
                }
      });
      var dt = parms.step * 1000;
      var delayedPromise = when(true).delay(dt).then(retryNext);
      var promises = [promise, delayedPromise];
      return when.any(promises);
    } else {
      return when.reject(new Error("waitedTooMuch"));
    }
  }
  return retryNext();
};
CodeGradX.State.prototype.sendRepeatedlyESServer.default = {
  step: 3, // seconds
  attempts: 30,
  progress: function (parameters) {}
};

/** Authenticate the user. This will return a Promise leading to
    some User.

    @param {string} login - real login or email address
    @param {string} password
    @returns {Promise<User>} yields {User}

    */

CodeGradX.State.prototype.getAuthenticatedUser =
function (login, password) {
  var state = this;
  state.debug('getAuthenticatedUser1', login);
  return state.sendAXServer('x', {
    path: '/direct/check',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    entity: {
      login: login,
      password: password
    }
  }).then(function (response) {
    //console.log(response);
    state.debug('getAuthenticatedUser2', response);
    state.currentUser = new CodeGradX.User(response.entity);
    return when(state.currentUser);
  });
};

// **************** User *******************************

/** Represents a User. An User is found by its login and password, the login
    may be a real login (such as upmc:1234567) or an email address.

    @constructor
    @property {string} lastname
    @property {string} firstname
    @property {string} email
    @property {string} cookie
    @property {number} personid
    @property {string} pseudo
    @property {Array<string>} authorprefixes
    @property {Hashtable<Campaign>} _campaigns - Hashtable of Campaign

    Campaigns may be obtained via `getCampaign()` or `getCampaigns()`.

    */

CodeGradX.User = function (json) {
  _.assign(this, json);
  //console.log(json);
  delete this.kind;
  var state = CodeGradX.getCurrentState();
  if ( this.cookie ) {
      if ( ! state.currentCookie ) {
          state.currentCookie = this.cookie;
      }
  } else if ( state.currentCookie ) {
      this.cookie = state.currentCookie;
  }
  if ( _.has(json, 'campaigns') ) {
      var campaigns = {};
      json.campaigns.forEach(function (js) {
          //console.log(js);
          var campaign = new CodeGradX.Campaign(js);
          campaigns[campaign.name] = campaign;
      });
      this._campaigns = campaigns;
  }
};

/** Modify some properties of the current user. These properties are

      @param {object} fields
      @property {string} fields.lastname
      @property {string} fields.firstname
      @property {string} fields.pseudo
      @property {string} fields.email
      @property {string} fields.password
      @returns {Promise yields User

    It is not possible to change user's login, personid, authorprefixes.

    */

CodeGradX.User.prototype.modify = function (fields) {
  var state = CodeGradX.getCurrentState();
  state.debug('modify1', fields);
  return state.sendAXServer('x', {
    path: '/person/selfmodify',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    entity: fields
  }).then(function (response) {
    state.debug('modify2', response);
    delete response.entity.kind;
    CodeGradX.User.call(state.currentUser, response.entity);
    return when(state.currentUser);
  });
};

/** Get the campaigns where the current user is enrolled.

      @param {bool} now - get only active campaigns.
      @returns {Promise<Hashtable<Campaign>>} yielding a Hashtable of Campaigns
                indexed by their name.

    */

CodeGradX.User.prototype.getCampaigns = function (now) {
  if ( now ) {
    var dnow = new Date();
    var activeCampaigns = {};
    _.forEach(this._campaigns, function (campaign) {
      if ( (campaign.starttime <= dnow) &&
           ( dnow <= campaign.endtime ) ) {
        //console.log("gotten " + campaign.name);
        activeCampaigns[campaign.name] = campaign;
      }
    });
    return when(activeCampaigns);
  } else {
    return when(this._campaigns);
  }
};

/** Return a specific Campaign.
    It looks for a named campaign among the campaigns the user is part of.

        @param {String} name - name of the Campaign to find
        @returns {Promise<Campaign>} yields {Campaign}

    */

CodeGradX.User.prototype.getCampaign = function (name) {
  var state = CodeGradX.getCurrentState();
  state.debug('getCampaign', name);
  var campaign = this._campaigns[name];
  if ( campaign ) {
    return when(campaign);
  } else {
    return when.reject(new Error("No such campaign " + name));
  }
};

/** submit a new Exercise and return it as soon as submitted successfully.
    However fetching the ExerciseReport is started with the `parameters`
    repetition parameters.

    @param {string} filename - tgz file containing the exercise
    @param {Object} parameters - repetition parameters
    @returns {Promise<Exercise>} yielding Exercise

    */

CodeGradX.User.prototype.submitNewExercise = function (filename, parameters) {
  var user = this;
  var state = CodeGradX.getCurrentState();
  state.debug('submitNewExercise1', filename);
  function processResponse (response) {
      //console.log(response);
      state.debug('submitNewExercise3', response);
      return CodeGradX.parsexml(response.entity).then(function (js) {
        //console.log(js);
        state.debug('submitNewExercise4', js);
        js = js.fw4ex.exerciseSubmittedReport;
        var exercise = new CodeGradX.Exercise({
          location: js.$.location,
          personid: CodeGradX._str2num(js.person.$.personid),
          exerciseid: js.exercise.$.exerciseid,
          XMLsubmission: response.entity
        });
        state.debug('submitNewExercise5', exercise.exerciseid);
        return when(exercise);
      });
  }
  return CodeGradX.readFileContent(filename).then(function (content) {
    state.debug('submitNewExercise2', content.length);
    var basefilename = filename.replace(new RegExp("^.*/"), '');
    var headers = {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'text/xml'
    };
    if ( isNode() ) {
        headers["Content-Length"] = content.length;
    }
    return state.sendESServer('e', {
      path: '/exercises/',
      method: "POST",
      headers: headers,
      entity: content
    }).then(processResponse);
  });
};

// **************** Campaign *********************************

/** A campaign describes a set of exercises for a given group of
    students and a given group of teachers for a period of time. These
    groups of persons are not public.

      @constructor
      @property {string} name
      @property {Date} starttime - Start date of the Campaign
      @property {Date} endtime - End date of the Campaign
      @property {string} exercisesname - Name of the set of Exercises
      @property {ExerciseSet} _exercises (filled by getExercises)

      Exercises may be obtained one by one with `getExercise()`.

    */

CodeGradX.Campaign = function (json) {
  // initialize name, starttime, endtime
  _.assign(this, json);
  this.starttime = CodeGradX._str2Date(json.starttime);
  this.endtime = CodeGradX._str2Date(json.endtime);
  //console.log(this);
};

/** Get the skills of the students enrolled in the current campaign.

    @return {Promise} yields {Object}
    @property {Object} skills.you
    @property {number} skills.you.personId - your numeric identifier
    @property {number} skills.you.skill - your own skill
    @property {Array<skill>} skills.all - array of Object
    @property {Object} skills.all[].skill - some student's skill

    */

CodeGradX.Campaign.prototype.getSkills = function () {
  var state = CodeGradX.getCurrentState();
  var campaign = this;
  state.debug('getSkills1', campaign);
  return state.sendAXServer('x', {
    path: ('/skill/' + campaign.name),
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getSkills2');
    //console.log(response);
    state.skills = response.entity;
    return when(state.skills);
  });
};

/** list the jobs submitted by the current user in the current campaign.

      @returns {Promise} yields Array[Job]
    */

CodeGradX.Campaign.prototype.getJobs = function () {
  var state = CodeGradX.getCurrentState();
  var campaign = this;
  state.debug('getJobs1', campaign, state.currentUser);
  return state.sendAXServer('x', {
    path: ('/history/campaign/' + campaign.name),
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getJobs2');
    //console.log(response);
    function normalizeUUID (uuid) {
        var uuidRegexp = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;
        return uuid.replace(uuidRegexp, "$1-$2-$3-$4-$5");
    }
    state.jobs = _.map(response.entity.jobs, 
                       function (js) {
                           var job = new CodeGradX.Job(js);
                           job.jobid = normalizeUUID(js.uuid);
                           job.pathdir = '/s' + 
                               js.uuid.replace(/(.)/g, "/$1");
                           return job;
                       });
    return when(state.jobs);
  });
};

/** Get the (tree-shaped) set of exercises of a campaign.

      @return {Promise} yields {ExercisesSet}

    */

CodeGradX.Campaign.prototype.getExercisesSet = function () {
  var state = CodeGradX.getCurrentState();
  var campaign = this;
  state.debug('getExercisesSet1', campaign);
  if ( campaign.exercisesSet ) {
    return when(campaign.exercisesSet);
  }
  var request = {
    method: 'GET',
    path: campaign.home_url + "/exercises.json",
    headers: {
      Accept: "application/json"
    }
  };
  var p1 = state.userAgent(request).then(function (exercises) {
      state.debug('getExercisesSet3', exercises);
      return when(exercises);
  });
  var p2 = state.sendESServer('e', {
    path: ('/path/' + (campaign.exercisesname || campaign.name)),
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  });
  return when.any([p1, p2]).then(function (response) {
    state.debug('getExercisesSet2', response);
    campaign.exercisesSet = new CodeGradX.ExercisesSet(response.entity);
    return when(campaign.exercisesSet);
  });
};

/** Get a specific Exercise with its name within the tree of
    Exercises of the current campaign.

        @param {string} name - full name of the exercise
        @returns {Promise} yields {Exercise}

    */

CodeGradX.Campaign.prototype.getExercise = function (name) {
  var state = CodeGradX.getCurrentState();
  state.debug('getExercise', name);
  var campaign = this;
  return campaign.getExercisesSet().then(function (exercisesSet) {
    var exercise = exercisesSet.getExercise(name);
    if ( exercise ) {
      return when(exercise);
    } else {
      return when.reject(new Error("No such exercise " + name));
    }
  });
};

// **************** Exercise ***************************

/** Exercise. When extracted from a Campaign, an Exercise looks like:

    { name: 'org.fw4ex.li101.croissante.0',
      nickname: 'croissante',
      safecookie: 'UhSn..3nyUSQWNtqwm_c6w@@',
      summary: 'Déterminer si une liste est croissante',
      tags: [ 'li101', 'scheme', 'fonction' ] }

    This information is sufficient to list the exercises with a short
    description of their stem. If you need more information (the stem
    for instance), use the `getDescription` method.

    @constructor
    @property {string} name - full name
    @property {string} nickname - short name
    @property {string} safecookie - long crypted identifier
    @property {string} summary - single sentence qualifying the Exercise
    @property {Array<string>} tags - Array of tags categorizing the Exercise.

    The `getDescription()` method completes the description of an Exercise
    with the following fields:

    @property {XMLstring} _XMLdescription - raw XML description
    @property {Object} _description - description
    @property {Array<Author>} authorship - Array of authorship
    @property {XMLstring} XMLstem - raw XML stem
    @property {string} stem - default HTML translation of the XML stem
    @property {Object} expectations - files expected in student's answer

    This field may be present if there is a single file in expectations:

    @property {string} inlineFileName - single file expected in student's answer

    */

CodeGradX.Exercise = function (json) {
  // initialize name, nickname, safecookie, summary, tags:
  _.assign(this, json);
};

/** Get the XML descriptor of the Exercise.
    This XML descriptor will enrich the Exercise instance.
    The raw XML string is stored under property 'XMLdescription', the
    decoded XML string is stored under property 'description'.

    Caution: this description is converted from XML to a Javascript
    object with xml2js idiosyncrasies.

      @returns {Promise<ExerciseDescription>} yields {ExerciseDescription}

       */

CodeGradX.Exercise.prototype.getDescription = function () {
  var exercise = this;
  var state = CodeGradX.getCurrentState();
  state.debug('getDescription1', exercise);
  if ( exercise._description ) {
    return when(exercise._description);
  }
  if ( ! exercise.safecookie ) {
    return when.reject("Non deployed exercise " + exercise.name);
  }
  var promise = state.sendESServer('e', {
    path: ('/exercisecontent/' + exercise.safecookie + '/content'),
    method: 'GET',
    headers: {
      Accept: "text/xml"
    }
  });
  var promise1 = promise.then(function (response) {
    state.debug('getDescription2', response);
    //console.log(response);
    exercise._XMLdescription = response.entity;
    function parseXML (description) {
      state.debug('getDescription2b', description);
      exercise._description = description;
      //description._exercise = exercise;
      return when(description);
    }
    return CodeGradX.parsexml(exercise._XMLdescription).then(parseXML);
  });
  var promise2 = promise.then(function (response) {
    // Extract authors
    state.debug("getDescription3", response);
    var authorshipRegExp = new RegExp("^(.|\n)*(<authorship>(.|\n)*</authorship>)(.|\n)*$");
    var authorship = response.entity.replace(authorshipRegExp, "$2");
    return CodeGradX.parsexml(authorship).then(function (result) {
      state.debug("getDescription3a", result);
      //console.log(result); //
      var authors = result.authorship;
      if ( _.isArray(authors) ) {
        exercise.authorship = _.map(authors, 'author');
      } else {
        exercise.authorship = [ authors.author ];
      }
      return when(response);
    });
  });
  var promise3 = promise.then(function (response) {
    // Extract stem
    state.debug("getDescription4", response);
    var contentRegExp = new RegExp("^(.|\n)*(<content>(.|\n)*</content>)(.|\n)*$");
    var content = response.entity.replace(contentRegExp, "$2");
    exercise.XMLcontent = content;
    exercise.stem = CodeGradX.xml2html(content);
    return when(response);
  });
  var promise4 = promise.then(function (response) {
    // If only one question expecting one file, retrieve its name:
    state.debug('getDescription5');
    var expectationsRegExp =
          new RegExp("<expectations>(.|\n)*</expectations>", "g");
    function concat (s1, s2) {
      return s1 + s2;
    }
    var expectations =
    '<div>' +
    _.reduce(response.entity.match(expectationsRegExp), concat) +
    '</div>';
    return CodeGradX.parsexml(expectations).then(function (result) {
      state.debug('getDescription5a');
      if ( result.div.expectations ) {
        //console.log(result.div.expectations);
        exercise.expectations = result.div.expectations;
        exercise.inlineFileName = result.div.expectations.file.$.basename;
      }
      return when(response);
    });
  });
  return when.join(promise2, promise3, promise4).then(function (values) {
    return promise1;
  });
};

/** Promisify an XML to Javascript converter.

        @param {string} xml - string to parse
        @returns {Promise}

      */

CodeGradX.parsexml = function (xml) {
  if ( ! xml ) {
    return when.reject("Cannot parse XML " + xml);
  }
  var parser = new xml2js.Parser({
    explicitArray: false,
    trim: true
  });
  var xerr, xresult;
  try {
    parser.parseString(xml, function (err, result) {
      xerr = err;
      xresult = result;
    });
  } catch (e) {
    // for a TypeError: Cannot read property 'toString' of undefined
    return when.reject(e);
  }
  if ( xerr ) {
    return when.reject(xerr);
  } else {
    return when(xresult);
  }
};

/** Send a string as the proposed solution to an Exercise.
    Returns a Job on which you may invoke the `getReport` method.

      @param {string} answer
      @returns {Promise<Job>} yields {Job}

    */

CodeGradX.Exercise.prototype.sendStringAnswer = function (answer) {
  var exercise = this;
  var state = CodeGradX.getCurrentState();
  state.debug('sendStringAnswer1', answer);
  if ( ! exercise.safecookie ) {
    return when.reject("Non deployed exercise " + exercise.name);
  }
  if ( typeof exercise.inlineFileName === 'undefined') {
      if ( exercise._description ) {
          return when.reject(new Error("Non suitable exercise"));
      } else {
          return exercise.getDescription()
          .then(function (description) {
              return exercise.sendStringAnswer(answer);
          });
      }
  }
  function processResponse (response) {
    //console.log(response);
    state.debug('sendStringAnswer2', response);
    return CodeGradX.parsexml(response.entity).then(function (js) {
      //console.log(js);
      state.debug('sendStringAnswer3', js);
      js = js.fw4ex.jobSubmittedReport;
      exercise.uuid = js.exercise.$.exerciseid;
      var job = new CodeGradX.Job({
        exercise: exercise,
        content: answer,
        responseXML: response.entity,
        response: js,
        personid: CodeGradX._str2num(js.person.$.personid),
        archived: CodeGradX._str2Date(js.job.$.archived),
        jobid:    js.job.$.jobid,
        pathdir:  js.$.location
      });
      return when(job);
    });
  }
  var content = new Buffer(answer, 'utf8');
  var headers = {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": ("inline; filename=" + exercise.inlineFileName),
      "Accept": 'text/xml'
  };
    if ( isNode() ) {
        headers["Content-Length"] = content.length;
    }
  return state.sendAXServer('a', {
    path: ('/exercise/' + exercise.safecookie + '/job'),
    method: "POST",
    headers: headers,
    entity: content
  }).then(processResponse);
};

/** Send the content of a file as the proposed solution to an Exercise.
    Returns a Job on which you may invoke the `getReport` method.

      @param {string} filename
      @returns {Promise<Job>} yields {Job}

    NOTA: The present implementation depends on Node.js, it uses the
    `fs` module to read the file to send. It has to be rewritten if
    run in a browser.

    */

CodeGradX.Exercise.prototype.sendFileAnswer = function (filename) {
  var exercise = this;
  var state = CodeGradX.getCurrentState();
  state.debug('sendFileAnswer1', filename);
  if ( ! exercise.safecookie ) {
    return when.reject("Non deployed exercise " + exercise.name);
  }
  function make_processResponse (content) {
    return function (response) {
      //console.log(response);
      state.debug('sendFileAnswer2', response);
      return CodeGradX.parsexml(response.entity).then(function (js) {
        //console.log(js);
        state.debug('sendFileAnswer3', js);
        js = js.fw4ex.jobSubmittedReport;
        exercise.uuid = js.exercise.$.exerciseid;
        var job = new CodeGradX.Job({
          exercise: exercise,
          content: content,
          responseXML: response.entity,
          response: js,
          personid: CodeGradX._str2num(js.person.$.personid),
          archived: CodeGradX._str2Date(js.job.$.archived),
          jobid:    js.job.$.jobid,
          pathdir:  js.$.location
        });
        return when(job);
      });
    };
  }
  return CodeGradX.readFileContent(filename).then(function (content) {
    var basefilename = filename.replace(new RegExp("^.*/"), '');
    var headers = {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'text/xml'
    };
    if ( isNode() ) {
        headers["Content-Length"] = content.length;
    }
    return state.sendAXServer('a', {
      path: ('/exercise/' + exercise.safecookie + '/job'),
      method: "POST",
      headers: headers,
      entity: content
    }).then(make_processResponse(content));
  });
};

/** Promisify the reading of a file.
    Caution: Specific to Node.js!

        @param {string} filename - file to read
        @returns {Promise} yields file content in a Buffer

      */

CodeGradX.readFileContent = function (filename) {
  return nodefn.call(require('fs').readFile, filename, 'binary')
  .then(function (filecontent) {
    return when(new Buffer(filecontent, 'binary'));
  });
};

/** Send a batch of files that is, multiple answers to be marked
    against an Exercise.

    @param {string} filename - the tgz holding all students' files
    @returns {Promise<Batch>} yielding a Batch.

    */

CodeGradX.Exercise.prototype.sendBatch = function (filename) {
  var exercise = this;
  var state = CodeGradX.getCurrentState();
  state.debug('sendBatch1', filename);
  if ( ! exercise.safecookie ) {
    return when.reject("Non deployed exercise " + exercise.name);
  }
  function processResponse  (response) {
      //console.log(response.entity);
      state.debug('sendBatch2', response);
      return CodeGradX.parsexml(response.entity).then(function (js) {
        //console.log(js);
        state.debug('sendBatch3', js);
        js = js.fw4ex.multiJobSubmittedReport;
        exercise.uuid = js.exercise.$.exerciseid;
        var batch = new CodeGradX.Batch({
          exercise: exercise,
          //content: content,  // Too heavy
          responseXML: response.entity,
          response: js,
          personid: CodeGradX._str2num(js.person.$.personid),
          archived: CodeGradX._str2Date(js.batch.$.archived),
          batchid:  js.batch.$.batchid,
          pathdir:  js.$.location,
          finishedjobs: 0
        });
        return when(batch);
      });
  }
  return CodeGradX.readFileContent(filename).then(function (content) {
    var basefilename = filename.replace(new RegExp("^.*/"), '');
    var headers = {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'text/xml'
    };
    if ( isNode() ) {
        headers["Content-Length"] = content.length;
    }
    return state.sendAXServer('a', {
      path: ('/exercise/' + exercise.safecookie + '/batch'),
      method: "POST",
      headers: headers,
      entity: content
    }).then(processResponse);
  });
};

/** After submitting a new Exercise, get Exercise autocheck reports
    that is, the jobs corresponding to the pseudo-jobs contained in
    the Exercise TGZ file.

  @param {Object} parameters - @see CodeGradX.sendRepeatedlyESServer
  @returns {Promise<Exercise>} yielding an Exercise

  The `getExerciseReport()` method will add some new fields to the
  Exercise object:

  @property {XMLstring} XMLauthorReport - raw XML report
  @property {number} totaljobs - the total number of pseudo-jobs
  @property {number} finishedjobs - the number of marked pseudo-jobs
  @property {Hashtable<Job>} pseudojobs - Hashtable of pseudo-jobs

  For each pseudo-job, are recorded all the fields of a regular Job
  plus some additional fields such as `duration`.

  If the exercise is successfully autochecked, it may be used by
  `sendStringAnswer()`, `sendFileAnswer()` or `sendBatch()` methods
  using the additional `safecookie` field:

  @property {string} safecookie - the long identifier of the exercise.

*/

CodeGradX.Exercise.prototype.getExerciseReport = function (parameters) {
  var exercise = this;
  var state = CodeGradX.getCurrentState();
  state.debug("getExerciseReport1", exercise, parameters);
  if ( exercise.finishedjobs ) {
      return when(exercise);
  }
  function processResponse (response) {
    state.debug("getExerciseReport2", response);
    //console.log(response);
    exercise.XMLauthorReport = response.entity;
    function catchXMLerror (reason) {
        state.debug("catchXMLerror", reason);
        return when.reject(reason);
    }
    return CodeGradX.parsexml(response.entity).then(function (js) {
      state.debug("getExerciseReport3", js);
      js = js.fw4ex.exerciseAuthorReport;
      exercise.name = js.identification.$.name;
      exercise.nickname = js.identification.$.nickname;
      exercise.summary = js.identification.summary;
      // Caution: if there is only one tag then tags is 
      // { '$': { name: 'js' } } If there is more than one tag, then tags is
      // [ { '$': { name: 'js' } }, { '$': { name: 'closure' } } ]
      var tags = js.identification.tags.tag;
      if ( _.isArray(tags) ) {
          exercise.tags = _.map(js.identification.tags.tag, function (jstag) {
              return jstag.$.name;
          });
      } else {
          exercise.tags = [ tags.name ];
      }
      exercise.authorship = js.identification.authorship.author;
      if ( ! _.isArray(exercise.authorship) ) {
        exercise.authorship = [ exercise.authorship ];
      }
      exercise.pseudojobs = {};
      exercise.totaljobs    = CodeGradX._str2num(js.pseudojobs.$.totaljobs);
      exercise.finishedjobs = CodeGradX._str2num(js.pseudojobs.$.finishedjobs);
      function processPseudoJob (jspj) {
        var name = jspj.submission.$.name;
        var markFactor = CodeGradX.xml2html.default.markFactor;
        var job = new CodeGradX.Job({
          exercise:  exercise,
          XMLpseudojob: jspj,
          jobid:     jspj.$.jobid,
          pathdir:   jspj.$.location,
          duration:  CodeGradX._str2num(jspj.$.duration),
          mark:      ( markFactor * CodeGradX._str2num(jspj.marking.$.mark)),
          totalmark: ( markFactor * CodeGradX._str2num(jspj.marking.$.totalmark)),
          archived:  CodeGradX._str2Date(jspj.marking.$.archived),
          started:   CodeGradX._str2Date(jspj.marking.$.started),
          ended:     CodeGradX._str2Date(jspj.marking.$.ended),
          finished:  CodeGradX._str2Date(jspj.marking.$.finished)
          // partial marks TOBEDONE
        });
        exercise.pseudojobs[name] = job;
      }
      var pseudojobs = js.pseudojobs.pseudojob;
      if ( _.isArray(pseudojobs) ) {
          pseudojobs.forEach(processPseudoJob);
      } else if ( pseudojobs ) {
          processPseudoJob(pseudojobs);
      } else {
          // nothing! exercise.finishedjobs is probably 0!
      }
      //console.log(exercise); // DEBUG
      if ( js.$.safecookie ) {
        exercise.safecookie = js.$.safecookie;
      }
      return when(exercise);
    })
          .catch(catchXMLerror);
  }
  return state.sendRepeatedlyESServer('s', parameters, {
    path: (exercise.location + '/' + exercise.exerciseid + '.xml'),
    method: 'GET',
    headers: {
      "Accept": 'text/xml'
    }
  }).then(processResponse);
};

// **************** ExercisesSet ***************************

/** Initialize a set (in fact a tree) of Exercises with some json such as:

    { "notice": ?,
      "content": [
         { "title": "",
           "exercises": [
               { "name": "", ...}, ...
           ]
         },
         ...
      ]}

    The tree is made of nodes. Each node may contain some properties
    such as `title`, `prologue` (sentences introducing a set of exercises),
    `epilogue` (sentences ending a set of exercises) and `exercises` an
    array of Exercises or ExercisesSet.

    @constructor
    @property {string} title
    @property {string} prologue
    @property {string} epilogue
    @property {Array} exercises - Array of Exercises or ExercisesSet.

      */

CodeGradX.ExercisesSet = function (json) {
  if ( json.content ) {
    // skip 'notice', get array of sets of exercises:
    json = json.content;
  }
  // Here: json is an array of exercises or sets of exercises:
  function processItem (json) {
    if ( json.exercises ) {
      return new CodeGradX.ExercisesSet(json);
    } else {
      return new CodeGradX.Exercise(json);
    }
  }
  if ( _.isArray(json) ) {
    // no title, prologue nor epilogue.
    this.exercises = _.map(json, processItem);
  } else {
    // initialize optional title, prologue, epilogue:
    _.assign(this, json);
    this.exercises = _.map(json.exercises, processItem);
  }
};

/** Find an exercise by its name in an ExercisesSet that is,
    a tree of Exercises.

    @param {String|Number} name
    @returns {Exercise}

  */

CodeGradX.ExercisesSet.prototype.getExercise = function (name) {
  var exercises = this;
  if ( _.isNumber(name) ) {
      return exercises.getExerciseByIndex(name);
  } else {
      return exercises.getExerciseByName(name);
  }
};

CodeGradX.ExercisesSet.prototype.getExerciseByName = function (name) {
  var exercisesSet = this;
  //console.log(exercisesSet);// DEBUG
  function find (thing) {
    if ( thing instanceof CodeGradX.ExercisesSet ) {
      var exercises = thing.exercises;
      for ( var i=0 ; i<exercises.length ; i++ ) {
        //console.log("explore " + i + '/' + exercises.length);
        var result = find(exercises[i]);
        if ( result ) {
          return result;
        }
      }
      return false;
    } else if ( thing instanceof CodeGradX.Exercise ) {
      var exercise = thing;
      //console.log("compare with " + exercise.name);
      if ( exercise.name === name ) {
        return exercise;
      } else {
        return false;
      }
    } else {
        throw new Error("Not an Exercise nor an ExerciseSet", thing);
    }
  }
  return find(exercisesSet);
};

CodeGradX.ExercisesSet.prototype.getExerciseByIndex = function (index) {
  var exercises = this;
  function find (exercises) {
    if ( _.isArray(exercises) ) {
      for ( var i=0 ; i<exercises.length ; i++ ) {
        //console.log("explore " + i); // DEBUG
        var result = find(exercises[i]);
        if ( result ) {
          return result;
        }
      }
      return false;
    } else if ( exercises instanceof CodeGradX.ExercisesSet ) {
      return find(exercises.exercises);
    } else if ( exercises instanceof CodeGradX.Exercise ) {
      if ( index === 0 ) {
        return exercises;
      } else {
        //console.log('index= ' + index); // DEBUG
        index--;
        return false;
      }
    }
  }
  return find(exercises);
};

// **************** Job ***************************

/** A Job corresponds to an attempt of solving an Exercise.
    A Job is obtained with `sendStringAnswer` or `sendFileAnswer`.
    From a job, you may get the marking report with `getReport`.

    @constructor
    @property {string} XMLreport - raw XML report
    @property {string} HTMLreport - default HTML from XML report

*/

CodeGradX.Job = function (js) {
  _.assign(this, js);
  var markFactor = CodeGradX.xml2html.default.markFactor;
  this.mark *= markFactor;
  this.totalmark *= markFactor;
};

/** Get the marking report of that Job. The marking report will be stored
    in the `XMLreport` and `report` properties.

  @param {Object} parameters - for repetition see sendRepeatedlyESServer.default
  @returns {Promise} yields {Job}

  */

CodeGradX.Job.prototype.getReport = function (parameters) {
  parameters = parameters || {};
  var job = this;
  var state = CodeGradX.getCurrentState();
  state.debug('getJobReport1', job);
  if ( job.XMLreport ) {
    return when(job);
  }
  var path = job.pathdir + '/' + job.jobid + '.xml';
  var promise = state.sendRepeatedlyESServer('s', parameters, {
    path: path,
    method: 'GET',
    headers: {
      "Accept": "text/xml"
    }
  });
  var promise1 = promise.then(function (response) {
    //state.log.show();
    //console.log(response);
    state.debug('getJobReport2', job);
    job.XMLreport = response.entity;
    return when(job);
  });
  var promise2 = promise.then(function (response) {
    // Fill archived, started, ended, finished, mark and totalmark
    state.debug('getJobReport3', job);
    var markingRegExp = new RegExp("^(.|\n)*(<marking (.|\n)*?>)(.|\n)*$");
    var marking = response.entity.replace(markingRegExp, "$2");
    marking = marking.replace(/>/, "/>");
    //console.log(marking);
    return CodeGradX.parsexml(marking).then(function (js) {
      //console.log(js);
      job.mark      = CodeGradX._str2num(js.marking.$.mark);
      job.totalmark = CodeGradX._str2num(js.marking.$.totalmark);
      job.archived  = CodeGradX._str2Date(js.marking.$.archived);
      job.started   = CodeGradX._str2Date(js.marking.$.started);
      job.ended     = CodeGradX._str2Date(js.marking.$.ended);
      job.finished  = CodeGradX._str2Date(js.marking.$.finished);
      // machine, partial marks TO BE DONE
      return when(response);
    });
  });
  var promise3 = promise.then(function (response) {
    // Fill exerciseid (already in exercise.uuid !)
    state.debug('getJobReport4', job);
    var exerciseRegExp = new RegExp("^(.|\n)*(<exercise (.|\n)*?>)(.|\n)*$");
    var exercise = response.entity.replace(exerciseRegExp, "$2");
    //console.log(exercise);
    return CodeGradX.parsexml(exercise).then(function (js) {
      _.assign(job, js.exercise.$);
      return when(response);
    });
  });
  var promise4 = promise.then(function (response) {
    // Fill report
    state.debug('getJobReport5');
    var contentRegExp = new RegExp("^(.|\n)*(<content>(.|\n)*?</content>)(.|\n)*$");
    var content = response.entity.replace(contentRegExp, "$2");
    job.HTMLreport = CodeGradX.xml2html(content);
  });
  return when.join(promise2, promise3, promise4).then(function (values) {
    state.debug('getJobReport6', job);
    //console.log(job);
    return promise1;
  });
};

/** Conversion of texts (stems, reports) from XML to HTML.
    This function may be modified to accommodate your own desires.
*/

CodeGradX.xml2html = function (s, options) {
  options = _.assign({}, CodeGradX.xml2html.default, options);
  var result = '';
  var mark, totalmark;
  var mode = 'default';
  var questionCounter = 0, sectionLevel = 0;
  var htmlTagsRegExp = new RegExp('^(p|pre|img|a|code|ul|ol|li|em|it|i|sub|sup|strong|b)$');
  var divTagsRegExp = new RegExp('^(warning|error|introduction|conclusion|normal|stem)$');
  var spanTagsRegExp = new RegExp("^(user|machine|lineNumber)$");
  var ignoreTagsRegExp = new RegExp("^(FW4EX|expectations|title|fw4ex)$");
  function convertAttributes (attributes) {
    var s = '';
    _.forIn(attributes, function (value, name) {
      s += ' ' + name + '="' + value + '"';
    });
    return s;
  }
  var parser = sax.parser(true, {
    //trim: true
  });
  parser.onerror = function (e) {
      throw e;
  };
  parser.ontext= function (text) {
    if ( ! mode.match(/ignore/) ) {
      result += text;
    }
  };
  parser.onopentag = function (node) {
      var tagname = node.name;
      var attributes = convertAttributes(node.attributes);
      if ( tagname.match(ignoreTagsRegExp) ) {
        mode = 'ignore';
      } else if ( tagname.match(htmlTagsRegExp) ) {
        result += '<' + tagname + attributes + '>';
      } else if ( tagname.match(spanTagsRegExp) ) {
        result += '<span class="fw4ex_' + tagname + '"' + attributes + '>';
      } else if ( tagname.match(divTagsRegExp) ) {
        result += '<div class="fw4ex_' + tagname + '"' + attributes + '>';
      } else if ( tagname.match(/^mark$/) ) {
        var markOrig = CodeGradX._str2num(node.attributes.value);
        var mark = Math.round(markOrig * options.markFactor);
        result += '<span' + attributes + ' class="fw4ex_mark">' + 
              mark + '<!-- ' + markOrig;
      } else if ( tagname.match(/^section$/) ) {
        result += '<div' + attributes + ' class="fw4ex_section' +
          (++sectionLevel) + '">';
      } else if ( tagname.match(/^question$/) ) {
        var title = node.attributes.title;
        result += '<div' + attributes + ' class="fw4ex_question">';
        result += '<div class="fw4ex_question_title" data_counter="' +
          (++questionCounter) + '">' + (title||'') + '</div>';
      } else {
        result += '<div class="fw4ex_' + tagname + '"' + attributes + '>';
      }
  };
  parser.onclosetag = function (tagname) {
      if ( tagname.match(ignoreTagsRegExp) ) {
        mode = 'default';
      } else if ( tagname.match(htmlTagsRegExp) ) {
        result += '</' + tagname + '>';
      } else if ( tagname.match(spanTagsRegExp) ) {
        result += '</span>';
      } else if ( tagname.match(divTagsRegExp) ) {
        result += '</div>';
      } else if ( tagname.match(/^mark$/) ) {
        result += ' --></span>';
      } else if ( tagname.match(/^section$/) ) {
        --sectionLevel;
        result += '</div>';
      } else if ( tagname.match(/^question$/) ) {
        result += '</div>';
      } else {
        result += '</div>';
      }
  };
  parser.oncomment = function (text) {
    if ( ! mode.match(/ignore/) ) {
      result += '<!-- ' + text + ' -->';
    }
  };
  parser.cdata = function (text) {
    if ( ! mode.match(/ignore/) ) {
      result += '<![CDATA[' + text;
    }
  };
  parser.closecdata = function () {
    if ( ! mode.match(/ignore/) ) {
      result += ']]>';
    }
  };
  parser.write(s).close();
  return result;
};
CodeGradX.xml2html.default = {
  markFactor:  100
};

// ************************** Batch *************************
/** A Batch is a set of students' answers to be marked by a single
    Exercise. Instantaneous reports or final reports may be obtained
    with the `getReport()` or `getFinalReport()` methods.

    @constructor
    @property {string} label - name of the batch
    @property {number} totaljobs - the total number of students' jobs to mark
    @property {number} finishedjobs - the total number of marked students' jobs
    @property {Hashtable<Job>} jobs - Hashtable of jobs indexed by their label

    */

CodeGradX.Batch = function (js) {
  _.assign(this, js);
};

/** Get the current state of the Batch report that is, always fetch
    it. See also `getFinalReport()` to get the final report of the
    batch where all answers are marked.

  @param {Object} parameters - parameters {@see sendRepeatedlyESServer}
  @returns {Promise<Batch>} yielding Batch

  */

CodeGradX.Batch.prototype.getReport = function (parameters) {
  var batch = this;
  var state = CodeGradX.getCurrentState();
  state.debug('getBatchReport1', batch);
  parameters = _.assign({
      // So progress() may look at the current version of the batch report:
      batch: batch
    },
    CodeGradX.Batch.prototype.getReport.default,
    parameters);
  var path = batch.pathdir + '/' + batch.batchid + '.xml';
  function processResponse (response) {
    //console.log(response);
    state.debug('getBatchReport2', response, batch);
      function processJS (js) {
          //console.log(js);
          state.debug('getBatchReport3', js);
          js = js.fw4ex.multiJobStudentReport;
          batch.totaljobs    = CodeGradX._str2num(js.$.totaljobs);
          batch.finishedjobs = CodeGradX._str2num(js.$.finishedjobs);
          batch.jobs = {};
          //console.log(js);
          function processJob (jsjob) {
              //console.log(jsjob);
              var job;
              job = state.cache.jobs[jsjob.$.jobid];
              if ( ! job ) {
                  job = new CodeGradX.Job({
                      exercise:  batch.exercise,
                      XMLjob:    jsjob,
                      jobid:     jsjob.$.jobid,
                      pathdir:   jsjob.$.location,
                      label:     jsjob.$.label,
                      problem:   CodeGradX._str2num(jsjob.$.problem),
                      mark:      CodeGradX._str2num(jsjob.marking.$.mark),
                      totalmark: CodeGradX._str2num(jsjob.marking.$.totalmark),
                      started:   CodeGradX._str2Date(jsjob.marking.$.started),
                      finished:  CodeGradX._str2Date(jsjob.marking.$.finished)
                  });
                  job.duration = (job.finished.getTime() - 
                                  job.started.getTime() )/1000; // seconds
                  state.cache.jobs[job.jobid] = job;
              }
              batch.jobs[job.label] = job;
              return job;
          }
          if ( js.jobStudentReport ) {
              if ( _.isArray(js.jobStudentReport) ) {
                  js.jobStudentReport.forEach(processJob);
              } else {
                  processJob(js.jobStudentReport);
              }
          }
          return when(batch);
    }
    if ( response.headers['Content-Length'] > 0 ) {
        batch.XMLreport = response.entity;
        return CodeGradX.parsexml(response.entity)
            .then(processJS)
            .catch(function (reason) {
                console.log(reason);
                console.log(response);
                return when.reject(reason);
            });
    } else {
        return when.reject(new Error("Empty response!"));
    }
  }
  return state.sendRepeatedlyESServer('s', parameters, {
    path: path,
    method: 'GET',
    headers: {
      "Accept": "text/xml"
    }
  }).then(processResponse);
};
CodeGradX.Batch.prototype.getReport.default = {
  step: 5, // seconds
  attempts: 100,
  progress: function (parameters) {}
};

/** Get the final state of the Batch report where all
    answers are marked. This method will update the `finishedjobs`
    and `jobs` fields.

  @param {Object} parameters - parameters {@see sendRepeatedlyESServer}
  @returns {Promise<Batch>} yielding Batch

  */

CodeGradX.Batch.prototype.getFinalReport = function (parameters) {
  var batch = this;
  var state = CodeGradX.getCurrentState();
  state.debug('getBatchFinalReport1', batch);
  if ( batch.finishedjobs &&
       batch.finishedjobs === batch.totaljobs ) {
      // Only return a complete report
      return when(batch);
  }
  parameters = _.assign({
      // So progress() may look at the current version of the batch report:
      batch: batch
    },
    CodeGradX.Batch.prototype.getReport.default,
    parameters);
  if ( parameters.step < CodeGradX.Batch.prototype.getReport.default.step ) {
      parameters.step = CodeGradX.Batch.prototype.getReport.default.step;
  }
  function tryFetching () {
    state.debug('getBatchFinalReport3', parameters);
    // Get at least one report to access finishedjobs and totaljobs:
    return batch.getReport(parameters).then(fetchAgainReport);
  }
  function fetchAgainReport () {
    state.debug('getBatchFinalReport2', batch);
    if ( batch.finishedjobs < batch.totaljobs ) {
      var dt = parameters.step * 1000; // seconds
      return when(batch).delay(dt).then(tryFetching);
    } else {
      return when(batch);
    }
  }
  return tryFetching();
};

// end of codegradxlib.js
