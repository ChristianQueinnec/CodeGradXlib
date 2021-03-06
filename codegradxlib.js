// CodeGradXlib
// Time-stamp: "2020-12-31 17:08:19 queinnec"

/** Javascript Library to interact with the CodeGradX infrastructure.

## Installation

```bash
npm install codegradxlib
```

## Usage

This library makes a huge usage of promises as may be seen in the following
use case:

```javascript
// Example of use:
const CodeGradX = require('codegradxlib');

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

If you want to use that module from Nodejs and have acces to the file
system, require the accompanying module CodeGradXlib4node.


@module codegradxlib
@author Christian Queinnec <Christian.Queinnec@codegradx.org>
@license MIT
@see {@link http://codegradx.org/|CodeGradX} site.
*/

// Possible improvements:
// - name differently methods returning a Promise from others


const CodeGradX = {};

/** Export the `CodeGradX` object */
module.exports = CodeGradX;
//export default CodeGradX;

//const _    = require('lodash');
const _ = (function () {
    const isFunction = require('lodash/isFunction');
    const forEach = require('lodash/forEach');
    const isNumber = require('lodash/isNumber');
    const memoize = require('lodash/memoize');
    const forIn = require('lodash/forIn');
    const has = require('lodash/has');
    const filter = require('lodash/filter');
    const map = require('lodash/map');
    const reduce = require('lodash/reduce');
    return { isFunction, forEach, isNumber, memoize, forIn,
             has, filter, map, reduce };
})();
const when = require('when');
const rest = require('rest');
const mime = require('rest/interceptor/mime');
const registry = require('rest/mime/registry');
const xml2js = require('xml2js');
const sax = require('sax');
const he = require('he');
const util = require('util');

// Define that additional MIME type:
registry.register('application/octet-stream', {
    read: function(str) {
        return str;
    },
    write: function(str) {
        return str;
    }
  });

/* Are we running under Node.js */
CodeGradX.isNode = _.memoize(
    // See http://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser
    function _checkIsNode () {
        /*jshint -W054 */
        const code = "try {return this===global;}catch(e){return false;}";
        const f = new Function(code);
        return f();
    });

CodeGradX.checkIfHTTPS = function () {
    /*jshint -W054 */
    const code = "try {if (this===window) {return window.document.documentURI}}catch(e){return false;}";
    const f = new Function(code);
    const uri = f();
    if ( uri ) {
        // We are within a browser
        return uri.match(/^https:/);
    }
    return false;
};

CodeGradX._str2num = function (str) {
  if (!isNaN(str)) {
    str = str % 1 === 0 ? parseInt(str, 10) : parseFloat(str);
  }
  return str;
};

CodeGradX._str2num2decimals = function (str) {
    const scale = 100; // Leave two decimals
    if ( _.isNumber(str) ) {
        return (Math.round(scale * str))/scale;
    } else if ( ! isNaN(str) ) {
        if ( str % 1 === 0 ) {
            return parseInt(str, 10);
        } else {
            let x = parseFloat(str);
            return (Math.round(scale * x))/scale;
        }
    }
};

CodeGradX._str2Date = function (str) {
    let ms = Date.parse(str);
    if ( ! isNaN(ms) ) {
        const d = new Date(ms);
        //console.log("STR1:" + str + " => " + ms + " ==> " + d);
        return d;
    }
    // Safari cannot Date.parse('2001-01-01 00:00:00+00')
    // but can Date.parse('2001-01-01T00:00:00')
    const rmtz = /^\s*(.+)([+]\d+)?\s*$/;
    str = str.replace(rmtz, "$1").replace(/ /, 'T');
    ms = Date.parse(str);
    if ( ! isNaN(ms) ) {
        const d = new Date(ms);
        //console.log("STR2:" + str + " => " + ms + " ==> " + d);
        return d;
    }
    throw new Error("Cannot parse Date " + str);
};

// On some browsers the ISO string shows the long name of the time zone:
CodeGradX.Date2str = function (date) {
    if ( date ) {
        if ( date instanceof Date ) {
            date = date.toISOString();
        }
        date = date.replace(/[.].*Z?$/, '')
            .replace('T', ' ');
        return date + 'Z';
    }
    return date;
};

/** 
    Compute duration in seconds between two dates (whether Date or String).
 */

CodeGradX.computeDuration = function (end, start) {
    try {
        if ( end instanceof Date ) {
            end = end.getTime();
        } else if ( typeof(end) === 'string' ||
                    end instanceof String ) {
            end = Date.parse(end);
        } else {
            throw new Error("Unknown type of Date");
        }
        if ( start instanceof Date ) {
            start = start.getTime();
        } else if ( typeof(start) === 'string' ||
                    start instanceof String ) {
            start = Date.parse(start);
        } else {
            throw new Error("Unknown type of Date");
        }
        return (end - start)/1000;
    } catch (e) {
        return undefined;
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
  let msg = (''+Date.now()).replace(/(...)$/, ".$1") + ' ';
  for (let i=0 ; i<arguments.length ; i++) {
    if ( arguments[i] === null ) {
      msg += 'null ';
    } else if ( arguments[i] === undefined ) {
      msg += 'undefined ';
    } else {
      msg += util.inspect(arguments[i], { depth: 2 }) + ' ';
    }
  }
  if ( this.items.length > this.size ) {
    this.items.splice(0, 1);
  }
  this.items.push(msg);
  return this;
};

/** Display the log with `console.log`
    Console.log is asynchronous while writing in a file is synchronous!

    @method show
    @param {Array[object]} items - supersede the log with items
    @param {string} filename - write in file rather than console.
    @returns {Log}
    @memberof {CodeGradX.Log#}

  */

CodeGradX.Log.prototype.show = function (items) {
    // console.log is run later so take a copy of the log now to
    // avoid displaying a later version of the log.
    items = items || this.items.slice(0);
    for ( let item of items ) {
        console.log(item);
    }
    return this;
};

/** Display the log with `console.log` and empty it.

    @method showAndRemove
    @returns {Log}
    @memberof {CodeGradX.Log#}

  */

CodeGradX.Log.prototype.showAndRemove = function (filename) {
  // console.log is run later so take a copy of the log now to
  // avoid displaying a later version of the log:
  const items = this.items;
  this.items = [];
    return this.show(items, filename);
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
        domain: '.codegradx.org',
        // the shortnames of the four kinds of servers:
        names: ['a', 'e', 'x', 's'],
        // default protocol:
        protocol: 'https',
        // Descriptions of the A servers:
        a: {
            // Use that URI to check whether the server is available or not:
            suffix: '/alive',
            // Description of an A server:
            0: {
                // a full hostname supersedes the default FQDN:
                host: 'a6.codegradx.org',
                enabled: false
            },
            1: {
                host: 'a10.codegradx.org',
                enabled: false
            },
            2: {
                host: 'a9.codegradx.org',
                enabled: false
            }
        },
        e: {
            suffix: '/alive',
            0: {
                host: 'e6.codegradx.org',
                enabled: false
            },
            1: {
                host: 'e10.codegradx.org',
                enabled: false
            },
            2: {
                host: 'e9.codegradx.org',
                enabled: false
            }
        },
        x: {
            suffix: '/dbalive',
            0: {
                host: 'x6.codegradx.org',
                enabled: false
            },
            1: {
                host: 'x10.codegradx.org',
                enabled: false
            },
            2: {
                host: 'x9.codegradx.org',
                enabled: false
            }
        },
        s: {
            suffix: '/index.txt',
            0: {
                host: 's6.codegradx.org',
                enabled: false
            },
            1: {
                host: 's10.codegradx.org',
                enabled: false
            },
            2: {
                host: 's9.codegradx.org',
                enabled: false
            },
            3: {
                host: 's3.codegradx.org',
                enabled: false,
                once: true
            }
        }
    };
    // Current values
    this.currentUser = null;
    this.currentCookie = null;
    // Post-initialization
    let state = this;
    // Cache for jobs useful when processing batches:
    state.cache = {
        jobs: {} 
    };
    if ( _.isFunction(initializer) ) {
        state = initializer.call(state, state);
    }
    let protocol = 'http';
    if ( CodeGradX.checkIfHTTPS() ) {
        // Make 'Upgrade Insecure Request' happy:
        // and avoid "Blocked: mixed-content'
        protocol = 'https';
    }
    state.servers.protocol = state.servers.protocol || protocol;
    state.servers.a.protocol = state.servers.a.protocol ||
        state.servers.protocol;
    state.servers.e.protocol = state.servers.e.protocol ||
        state.servers.protocol;
    state.servers.s.protocol = state.servers.s.protocol ||
        state.servers.protocol;
    state.servers.x.protocol = state.servers.x.protocol ||
        state.servers.protocol;
    // Make the state global
    CodeGradX.getCurrentState = function () {
        return state;
    };
    return state;
};

/** Get the current state or create it if missing.
    The initializer has type State -> State
    This function will be replaced when the state is created.

    @param {function} initializer - post-initialization of the state object
    @returns {State}

*/

CodeGradX.getCurrentState = function (initializer) {
    return new CodeGradX.State(initializer);
};

/** Get current user (if defined). This is particularly useful when
    the user is not authenticated via getAuthenticatedUser() (for
    instance, via GoogleOpenId).

    @return {Promise<User>} yields {User}

*/

CodeGradX.getCurrentUser = function (force) {
    const state = CodeGradX.getCurrentState();
    if ( !force && state.currentUser ) {
        return when(state.currentUser);
    }
    state.debug('getCurrentUser1');
    let params = {};
    const currentCampaignName = isCurrentCampaignDefined();
    if ( currentCampaignName ) {
        params.campaign = currentCampaignName;
    }
    return state.sendAXServer('x', {
        path: '/whoami',
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        entity: params
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
    const state = this;
    state.cache.jobs = {};
    // FUTURE remove also .exercises ....................
};

/** Update the description of a server in order to determine if that
  server is available. The description may contain an optional `host`
  key with the name of the host to be checked. If the name is missing,
  the hostname is automatically inferred from the `kind`, `index` and
  `domain` information. After the check, the `enabled` key is set to
  a boolean telling wether the host is available or not.

  Descriptions are gathered in `descriptions` with one additional key:
  `suffix` is the path to add to the URL used to check the
  availability of the server.

  @param {string} kind - the kind of server (a, e, x or s)
  @param {number} index - the index of the server.
  @returns {Promise<Response>} - Promise leading to {HTTPresponse}

  Descriptions are kept in the global state.
  */

CodeGradX.State.prototype.checkServer = function (kind, index) {
  const state = this;
  state.debug('checkServer1', kind, index);
  if ( ! state.servers[kind] ) {
    state.servers[kind] = {};
  }
  const descriptions = state.servers[kind];
  if ( ! descriptions[index] ) {
    descriptions[index] = { enabled: false };
  }
  const description = descriptions[index];
  const host = description.host || (kind + index + state.servers.domain);
  description.host = host;
  description.protocol = description.protocol || descriptions.protocol;
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
  const url = description.protocol + "://" + host + descriptions.suffix;
  state.debug('checkServer2', kind, index, url);
  const request = {
      path: url
  };
  if ( state.currentCookie ) {
      if ( ! request.headers ) {
          request.headers = {};
      }
      // To send this header imposes a pre-flight:
      //if ( kind !== 's' ) {
      //    request.headers['X-FW4EX-Cookie'] = state.currentCookie;
      //}
      if ( CodeGradX.isNode() ) {
          request.headers.Cookie = state.currentCookie;
      } else {
          if ( ! document.cookie.indexOf(state.currentCookie) ) {
              document.cookie = state.currentCookie + ";path='/';";
          }
      }
  }
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
    update the state for those servers. If correctly programmed these
    checks are concurrently run but `checkServers` will only be
    resolved when all concurrent checks are resolved. However there is
    a timeout of 3 seconds.

    @param {string} kind - the kind of server (a, e, x or s)
    @returns {Promise} yields Descriptions

    Descriptions = { 0: Description, 1: Description, ... }
    Description = { host: "", enabled: boolean, ... }

    */

CodeGradX.State.prototype.checkServers = function (kind) {
  const state = this;
  state.debug('checkServers', kind);
  const descriptions = state.servers[kind];
  let promise;
  const promises = [];
  for ( let key in descriptions ) {
    if ( /^\d+$/.exec(key) ) {
      key = CodeGradX._str2num(key);
      promise = state.checkServer(kind, key);
      promise = promise.timeout(CodeGradX.State.maxWait);
      promises.push(promise);
    }
  }
  function returnDescriptions () {
    state.debug('returnDescriptions', descriptions);
    return when(descriptions);
  }
  return when.settle(promises)
        .then(returnDescriptions)
        .catch(returnDescriptions);
};
CodeGradX.State.maxWait = 3000; // 3 seconds

/** Filter out of the descriptions of some 'kind' of servers those
    that are deemed to be available. If no availableserver is found
    then check all servers.

    @param {string} kind - the kind of server (a, e, x or s)
    @returns {Promise} yielding Array[Description]

    Descriptions = { 0: Description, 1: Description, ... }
    Description = { host: "", enabled: boolean, ... }

*/

CodeGradX.State.prototype.getActiveServers = function (kind) {
    const state = this;
    const descriptions = state.servers[kind];
    function filterDefined (array) {
        const result = [];
        array.forEach(function (item) {
            if ( item ) {
                result.push(item);
            }
        });
        return result;
    }
    state.debug("getActiveServers Possible:", kind,
                filterDefined(_.map(descriptions, 'host')));
    // _.filter leaves 'undefined' values in the resulting array:
    let active = filterDefined(_.filter(descriptions, {enabled: true}));
    state.debug('getActiveServers Active:', kind,
                _.map(active, 'host'));
    if ( active.length === 0 ) {
        // check again all servers:
        return state.checkServers(kind)
            .then(function (descriptions) {
                active = filterDefined(_.filter(descriptions, {enabled: true}));
                if ( active.length === 0 ) {
                    const error = new Error(`No available ${kind} servers`);
                    return when.reject(error);
                } else {
                    return when(active);
                }
            });
    } else {
        return when(active);
    }
};

/** Check HTTP response and try to elaborate a good error message.
    A good HTTP response has a return code less than 300.

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
  const state = CodeGradX.getCurrentState();
  state.debug('checkStatusCode1', response);
  //console.log(response);
    /* eslint no-control-regex: 0 */
  const reasonRegExp = new RegExp("^(.|\n)*<reason>((.|\n)*)</reason>(.|\n)*$");
  function extractFW4EXerrorMessage (response) {
    let reason;
    const contentType = response.headers['Content-Type'];
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
      const msg = "Bad HTTP code " + response.status.code + ' ' +
        extractFW4EXerrorMessage(response);
      state.debug('checkStatusCode2', msg);
      //console.log(response);
      const error = new Error(msg);
      error.response = response;
      return when.reject(error);
  }
  return when(response);
};

/** Send request to the first available server of the right kind.
    In case of problems, try sequentially the next available server of
    the same kind.

    @param {string} kind - the kind of server (usually a or x)
    @param {object} options - description of the HTTP request to send
    @property {string} options.path
    @property {string} options.method
    @property {object} options.headers - for instance Accept, Content-Type
    @property {object} options.entity - string or object depending on Content-Type
    @returns {Promise} yields {HTTPresponse}

    */

CodeGradX.State.prototype.sendSequentially = function (kind, options) {
    const state = this;
    state.debug('sendSequentially', kind, options);
    
    function regenerateNewOptions (options) {
        const newoptions = Object.assign({}, options);
        newoptions.headers = newoptions.headers || options.headers || {};
        if ( state.currentCookie ) {
            //newoptions.headers['X-FW4EX-Cookie'] = state.currentCookie;
            if ( CodeGradX.isNode() ) {
                newoptions.headers.Cookie = state.currentCookie;
            } else {
                if ( ! document.cookie.indexOf(state.currentCookie) ) {
                    document.cookie = state.currentCookie + ";path='/';";
                }
            }
        }
        return newoptions;
    }

    function updateCurrentCookie (response) {
        //console.log(response.headers);
        //console.log(response);
        state.debug('sendSequentially updateCurrentCookie', response);
        function extractCookie (tag) {
            if ( response.headers[tag] ) { // char case ?
                let cookies = response.headers[tag];
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

    function mk_invalidate (description) {
        // This function declares the host as unable to answer.
        // Meanwhile, the host may answer with bad status code!
        return function (reason) {
            state.debug('sendAXserver invalidate', description, reason);
            //console.log(reason);
            description.enabled = false;
            description.lastError = reason;
            return when.reject(reason);
        };
    }
    function send (description) {
        const newoptions = regenerateNewOptions(options);
        newoptions.protocol = newoptions.protocol || description.protocol;
        newoptions.path = newoptions.protocol + '://' +
            description.host + options.path;
        newoptions.mixin = {
            withCredentials: true
        };
        state.debug('sendSequentially send', newoptions.path);
        return state.userAgent(newoptions)
            .catch(mk_invalidate(description))
            .then(CodeGradX.checkStatusCode)
            .then(updateCurrentCookie);
    }

    function trySequentially (adescriptions) {
        let promise = when.reject('start');
        adescriptions.forEach(function (description) {
            promise = promise.catch(function (reason) {
                state.debug('sendSequentially trySequentially', reason);
                return send(description);
            });
        });
        return promise;
    }
    function retrySequentially (reason) {
        state.debug('sendSequentially retry', reason);
        return state.getActiveServers(kind)
            .then(trySequentially);
    }
    
    return state.getActiveServers(kind)
        .then(trySequentially)
        .catch(retrySequentially);
};

/** By default sending to an A or X server is done sequentially until
    one answers positively.
*/

CodeGradX.State.prototype.sendAXServer = function (kind, options) {
    const state = this;
    return state.sendSequentially(kind, options);
};

/** Send request concurrently to all available servers. The fastest wins.

    @param {string} kind - the kind of server (usually e or s)
    @param {object} options - description of the HTTP request to send
    @property {string} woptions.path
    @property {string} options.method
    @property {object} options.headers - for instance Accept, Content-Type
    @property {object} options.entity - string or object depending on Content-Type
    @returns {Promise} yields {HTTPresponse}

*/


CodeGradX.State.prototype.sendConcurrently = function (kind, options) {
    const state = this;
    state.debug('sendConcurrently', kind, options);

    function regenerateNewOptions (options) {
        const newoptions = Object.assign({}, options);
        newoptions.headers = newoptions.headers || options.headers || {};
        if ( state.currentCookie ) {
            //newoptions.headers['X-FW4EX-Cookie'] = state.currentCookie;
            if ( CodeGradX.isNode() ) {
                newoptions.headers.Cookie = state.currentCookie;
            } else {
                if ( ! document.cookie.indexOf(state.currentCookie) ) {
                    document.cookie = state.currentCookie + ";path='/';";
                }
            }
        }
        if ( kind === 'e' ) {
            newoptions.mixin = {
                withCredentials: true
            };
        }
        return newoptions;
    }

    function mk_invalidate (description) {
        return function seeError (reason) {
            // A MIME deserialization problem may also trigger `seeError`.
            function see (o) {
                let result = '';
                for ( let key in o ) {
                    result += key + '=' + o[key] + ' ';
                }
                return result;
            }
            state.debug('sendConcurrently seeError', see(reason));
            // Don't consider the absence of a report to be a
            // reason to disable the server.
            description.enabled = false;
            description.lastError = reason;
            //const js = JSON.parse(reason.entity);
            return when.reject(reason);
        };
    }

    function send (description) {
        const tryoptions = Object.assign({}, regenerateNewOptions(options));
        tryoptions.path = description.protocol + '://' +
            description.host + options.path;
        state.debug("sendConcurrently send", tryoptions.path);
        return state.userAgent(tryoptions)
            .catch(mk_invalidate(description))
            .then(CodeGradX.checkStatusCode);
    }
    
    function tryConcurrently (adescriptions) {
        const promises = adescriptions.map(send);
        return when.any(promises);
    }
    
    return state.getActiveServers(kind)
        .then(tryConcurrently);
};

/** By default requesting an E or S server is done concurrently (except
    when submitting a new exercise).
*/

CodeGradX.State.prototype.sendESServer = function (kind, options) {
    const state = this;
    return state.sendConcurrently(kind, options);
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

    If a server has a 'once' property, it must be asked only once.

  Nota: when.any does not cancel the other concurrent promises.
  */

CodeGradX.State.prototype.sendRepeatedlyESServer =
function (kind, parameters, options) {
    const state = this;
    state.debug('sendRepeatedlyESServer', kind, parameters, options);
    const parms = Object.assign({ i: 0 },
          CodeGradX.State.prototype.sendRepeatedlyESServer.default,
                         parameters);
    let count = parms.attempts;

    function removeOnceServers (adescriptions) {
        const aresult = [];
        for (let item of adescriptions) {
            if ( ! item.once ) {
                aresult.push(item);
            }
        }
        state.debug('sendRepeatedlyESServer Non Once active servers',
                    kind, _.map(aresult, 'host'));
        return aresult;
    }
    function retry (reason) {
        state.debug('sendRepeatedlyESServer retry', reason, count--);
        try {
            parms.progress(parms);
        } catch (exc) {
            state.debug('sendRepeatedlyESServer progress', exc);
        }
        if ( count <= 0 ) {
            return when.reject(new Error("waitedTooMuch"));
        }
        return state.getActiveServers(kind)
            .then(removeOnceServers)
            .delay(parms.step * 1000)
            .then(function () {
                return state.sendESServer(kind, options);
            })
            .catch(retry);
    }

    return state.sendESServer(kind, options)
        .catch(retry);
};
CodeGradX.State.prototype.sendRepeatedlyESServer.default = {
  step: 3, // seconds
  attempts: 30,
  progress: function (/*parameters*/) {}
};

/** Authenticate the user. This will return a Promise leading to
    some User.

    @param {string} login - real login or email address
    @param {string} password
    @returns {Promise<User>} yields {User}

    */

CodeGradX.State.prototype.getAuthenticatedUser =
function (login, password) {
  const state = this;
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

/** Disconnect the user.

    @returns {Promise<>} yields undefined

*/

CodeGradX.State.prototype.userDisconnect = function () {
    var state = this;
    state.debug('userDisconnect1');
    return state.sendAXServer('x', {
        path: '/fromp/disconnect',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }).then(function (response) {
        //console.log(response);
        state.debug('userDisconnect2', response);
        state.currentUser = undefined;
        return when(undefined);
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
    @property {Hashtable<Campaign>} _campaigns - Hashtable of current Campaigns
    @property {Hashtable<Campaign>} _all_campaigns - Hashtable of all Campaigns

    Campaigns may be obtained via `getCampaign()` or `getCampaigns()`.

    */

CodeGradX.User = function (json) {
  Object.assign(this, json);
  //console.log(json);
  delete this.kind;
  const state = CodeGradX.getCurrentState();
  if ( this.cookie ) {
      if ( ! state.currentCookie ) {
          state.currentCookie = this.cookie;
      }
  } else if ( state.currentCookie ) {
      this.cookie = state.currentCookie;
  }
  if ( _.has(json, 'campaigns') ) {
      const campaigns = {};
      json.campaigns.forEach(function (js) {
          //console.log(js);
          const campaign = new CodeGradX.Campaign(js);
          campaigns[campaign.name] = campaign;
      });
      // Just record the current active campaigns:
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
  const state = CodeGradX.getCurrentState();
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

      @param {bool} now - if true get only active campaigns.
      @returns {Promise<Hashtable<Campaign>>} yielding a Hashtable of Campaigns
                indexed by their name.

   The current user maintains in _campaigns the active campaigns and
   in _all_campaigns all past or current campaigns. Three cases are
   possible: 
      - both are defined
      - only _campaigns is defined (see constructor 'User')
      - none are defined

    */

CodeGradX.User.prototype.getCampaigns = function (now) {
    const user = this;
    function filterActive (campaigns) {
        const activeCampaigns = {};
        _.forEach(campaigns, function (campaign) {
            if ( campaign.active ) {
                activeCampaigns[campaign.name] = campaign;
            }
        });
        return activeCampaigns;
    }
    if ( now ) {
        if ( user._campaigns ) {
            // return all current campaigns:
            return when(user._campaigns);
        } else if ( user._all_campaigns ) {
            // generate all current campaigns:
            user._campaigns = filterActive(user._all_campaigns);
            return when(user._campaigns);
        }
    }
    if ( user._all_campaigns ) {
        if ( now ) {
            user._campaigns = filterActive(user._all_campaigns);
            return when(user._campaigns);
        } else {
            return when(user._all_campaigns);
        }
    } else {
        const state = CodeGradX.getCurrentState();
        state.debug('getAllCampaigns1');
        return state.sendAXServer('x', {
            path: '/campaigns/',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(function (response) {
            state.debug('getAllCampaigns2', response);
            const campaigns = {};
            response.entity.forEach(function (js) {
                //console.log(js);
                const campaign = new CodeGradX.Campaign(js);
                campaigns[campaign.name] = campaign;
            });
            user._all_campaigns = campaigns;
            user._campaigns = filterActive(user._all_campaigns);
            if ( now ) {
                return when(user._campaigns);
            } else {
                return when(user._all_campaigns);
            }
        });
    }
};

/** Return a specific Campaign. It looks for a named campaign among
    the campaigns the user is part of whether past or current.

        @param {String} name - name of the Campaign to find
        @returns {Promise<Campaign>} yields {Campaign}

    */

CodeGradX.User.prototype.getCampaign = function (name) {
  const user = this;
  const state = CodeGradX.getCurrentState();
  state.debug('getCampaign', name);
  if ( user._campaigns && user._campaigns[name] ) {
      return when(user._campaigns[name]);
  } else if ( user._all_campaigns && user._all_campaigns[name] ) {
      return when(user._all_campaigns[name]);
  } else {
      return user.getCampaigns()
          .then(function (campaigns) {
              if ( campaigns && campaigns[name] ) {
                  return when(campaigns[name]);
              } else {
                  return when.reject(new Error("No such campaign " + name));
              }
          });
  }
};

/** Get current campaign if FW4EX.currentCampaignName is defined or
    if there is a single active campaign associated to the user.

    @return {Promise<Campaign>} yields {Campaign}

    FUTURE: remove that dependency against FW4EX!!!!!!!!!!!!
*/

function isCurrentCampaignDefined () {
    return CodeGradX.User.prototype.getCurrentCampaign.default.currentCampaign;
}

CodeGradX.User.prototype.getCurrentCampaign = function () {
    const user = this;
    const currentCampaignName = isCurrentCampaignDefined();
    if ( currentCampaignName ) {
        return user.getCampaign(currentCampaignName)
            .then(function (campaign) {
                FW4EX.currentCampaign = campaign;
                return when(campaign);
            });
    } else {
        return user.getCampaigns(true)
            .then(function (campaigns) {
                function hash2array (o) {
                    let result = [];
                    Object.keys(o).forEach((key) => {
                        result.push(o[key]);
                    });
                    return result;
                }
                campaigns = hash2array(campaigns);
                if ( campaigns.length === 1 ) {
                    FW4EX.currentCampaignName = campaigns[0].name;
                    FW4EX.currentCampaign = campaigns[0];
                    return when(campaigns[0]);
                } else if ( FW4EX.currentCampaign ) {
                    return when(FW4EX.currentCampaign);
                } else {
                    const msg = "Cannot determine current campaign";
                    return when.reject(new Error(msg));
                }
            });
    }
};
CodeGradX.User.prototype.getCurrentCampaign.default = {
    currentCampaign: undefined
};

/** Fetch all the jobs submitted by the user (independently of the
    current campaign).

        @returns {Promise<Jobs>} yields {Array[Job]}

 */

CodeGradX.User.prototype.getAllJobs = function () {
    const state = CodeGradX.getCurrentState();
    const user = this;
    state.debug('getAllJobs1', user);
    return state.sendAXServer('x', {
        path:   '/history/jobs',
        method: 'GET',
        headers: {
            Accept: "application/json"
        }
    }).then(function (response) {
        state.debug('getAllJobs2');
        //console.log(response);
        state.jobs = _.map(response.entity.jobs, CodeGradX.Job.js2job);
        return when(state.jobs);
    });
};

/** Fetch all exercises submitted by the user (independently of the
    current campaign) but only the exercices created after the
    starttime of the current campaign.

        @returns {Promise<Exercises>} yields {Array[Exercise]}

 */

CodeGradX.User.prototype.getAllExercises = function () {
    const state = CodeGradX.getCurrentState();
    const user = this;
    state.debug('getAllExercises1', user);
    return CodeGradX.getCurrentUser()
        .then(function (user) {
            return user.getCurrentCampaign();
        }).then(function (campaign) {
            FW4EX.fillCampaignCharacteristics(campaign);
            let url = `/exercises/person/${user.personid}`;
            let d = campaign.starttime.toISOString().replace(/T.*$/, '');
            url += `?after=${encodeURI(d)}`;
            return state.sendAXServer('x', {
                path: url,
                method: 'GET',
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });
        }).then(function (response) {
            state.debug('getAllExercises2');
            //console.log(response);
            state.exercises = _.map(response.entity.exercises,
                                    CodeGradX.Exercise.js2exercise);
            return when(state.exercises);
        });
};

/** get the list of exercises a user tried in a given campaign, get
    also the list of badges (or certificates) won during that
    campaign. It enriches the current user with new properties
    results and badges.

    @param {Campaign} campaign - Campaign
    @return {Promise<User>} yielding the User 
    @property {array[string]} user.badges - urls of badges
    @property {number} user.results[].mark - gotten mark
    @property {string} user.results[].name - exercise long name
    @property {string} user.results[].nickname - exercise nickname

 */

CodeGradX.User.prototype.getProgress = function (campaign) {
    const state = CodeGradX.getCurrentState();
    const user = this;
    state.debug('getProgress1', user);
    return state.sendAXServer('x', {
        path:   ('/skill/progress/' + campaign.name),
        method: 'GET',
        headers: {
            Accept: "application/json"
        }
    }).then(function (response) {
        state.debug('getProgress2', response);
        //console.log(response);
        user.results = response.entity.results;
        user.badges = response.entity.badges;
        return when(user);
    });
};

/** submit a new Exercise and return it as soon as submitted successfully.
    This variant sends the content of a DOM form.

    @param {DOM} form - a DOM element
    @returns {Promise<Exercise>} yielding Exercise

    */

CodeGradX.User.prototype.submitNewExerciseFromDOM = function (form) {
  const user = this;
  const state = CodeGradX.getCurrentState();
  state.debug('submitNewExerciseFromDOM1', user);
  function processResponse (response) {
      //console.log(response);
      state.debug('submitNewExerciseFromDOM3', response);
      return CodeGradX.parsexml(response.entity).then(function (js) {
        //console.log(js);
        state.debug('submitNewExerciseFromDOM4', js);
        js = js.fw4ex.exerciseSubmittedReport;
        const exercise = new CodeGradX.Exercise({
          location: js.$.location,
          personid: CodeGradX._str2num(js.person.$.personid),
          exerciseid: js.exercise.$.exerciseid,
          XMLsubmission: response.entity
        });
        state.debug('submitNewExerciseFromDOM5', exercise.exerciseid);
        return when(exercise);
      });
  }
  const fd = new FormData(form);
  const basefilename = FW4EX.currentFileName
      .replace(new RegExp("^.*/"), '');
  const headers = {
      "Content-Type": "multipart/form-data",
      "Content-Disposition": ("inline; filename=" + basefilename),
      "Accept": 'text/xml'
  };
  return state.sendSequentially('e', {
      path: '/exercises/',
      method: "POST",
      headers: headers,
      entity: fd
  }).then(processResponse);
};

/** Disconnect the user.

    @returns {Promise<User>} yields {User}

*/

CodeGradX.User.prototype.disconnect = function () {
    return CodeGradX.getCurrentState().userDisconnect();
};

// **************** Campaign *********************************

/** A campaign describes a set of exercises for a given group of
    students and a given group of teachers for a given period of time.
    These groups of persons are not public.

      @constructor
      @property {string} name
      @property {Date} starttime - Start date of the Campaign
      @property {Date} endtime - End date of the Campaign
      @property {ExerciseSet} _exercises (filled by getExercises)

      Exercises may be obtained one by one with `getExercise()`.

    */

CodeGradX.Campaign = function (json) {
  // initialize name, starttime, endtime
  Object.assign(this, json);
  this.starttime = CodeGradX._str2Date(json.starttime);
  this.endtime = CodeGradX._str2Date(json.endtime);
  //console.log(this);
};

/** Get the list of all students enrolled in the current campaign.
    
    @return {Promise<Array[Object]>} - yield an array of students
    @property {string} student.lastname
    @property {string} student.firstname
    @property {string} student.pseudo
    @property {string} student.email
    @property {bool} student.confirmedemail
    @property {number} student.confirmedua
    @property {start} student.start - creation date

 */

CodeGradX.Campaign.prototype.getStudents = function (refresh = false) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getStudents1', campaign);
  if ( ! refresh && campaign.students ) {
      return when(campaign.students);
  }
  return state.sendAXServer('x', {
    path: ('/campaign/listStudents/' + campaign.name),      
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getStudents2');
    //console.log(response);
    campaign.students = response.entity.students.map(function (student) {
        return new CodeGradX.User(student);
    });
    return when(campaign.students);
  });
};

/** Get the list of all teachers enrolled in the current campaign.
    
    @return {Promise<Array[Object]>} - yield an array of teachers
    @property {string} teacher.lastname
    @property {string} teacher.firstname
    @property {string} teacher.pseudo
    @property {string} teacher.email
    @property {bool} teacher.confirmedemail
    @property {number} teacher.confirmedua

 */

CodeGradX.Campaign.prototype.getTeachers = function (refresh) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getTeachers1', campaign);
  if ( ! refresh && campaign.teachers ) {
      return when(campaign.teachers);
  }
  return state.sendAXServer('x', {
    path: ('/campaign/listTeachers/' + campaign.name),      
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getTeachers2');
    //console.log(response);
    campaign.teachers = response.entity.teachers.map(function (teacher) {
        let tuser = new CodeGradX.User(teacher);
        // Don't duplicate the requester's cookie:
        delete tuser.cookie;
        return tuser;
    });
    return when(campaign.teachers);
  });
};

/** Promote a student to a teacher position.

    @return {Promise<Array[Object]>} - yield an array of teachers
    @param {User} student - the student to promote

*/

CodeGradX.Campaign.prototype.promoteStudent = function (student) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('promoteTeacher1', campaign, student.personid);
  return state.sendAXServer('x', {
    path: ('/campaign/promote/' + campaign.name + '/' + student.personid),
    method: 'POST',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('promoteTeacher2');
    //console.log(response);
    campaign.teachers = response.entity.teachers.map(function (teacher) {
        let tuser = new CodeGradX.User(teacher);
        // Don't duplicate the requester's cookie:
        delete tuser.cookie;
        return tuser;
    });
    return when(campaign.teachers);
  });
};

/** Demote a teacher into a student position or
    remove a student from the group of students

    @return {Promise<Array[Object]>} - yield an array of teachers
    @param {User} student - the student to promote

*/

CodeGradX.Campaign.prototype.demoteTeacher = function (student) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('demoteTeacher1', campaign, student.personid);
  return state.sendAXServer('x', {
    path: ('/campaign/demote/' + campaign.name + '/' + student.personid),
    method: 'POST',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('demoteTeacher2');
    //console.log(response);
    return when(response.entity);
  });
};

/** Get the list of all exercises available in the current campaign.
    The user must be a teacher of the campaign!
    
    @return {Promise<Array[Object]>} - yield an array of exercises
    @property {string} exercise.nickname
    @property {string} exercise.name
    @property {string} exercise.UUID
    @property {date}   exercise.start

 */

CodeGradX.Campaign.prototype.getExercises = function (refresh = false) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getExercises1', campaign);
  if ( ! refresh && campaign.exercises ) {
      return when(campaign.exercises);
  }
  return state.sendAXServer('x', {
    path: ('/campaign/listExercises/' + campaign.name),      
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getExercises2');
    //console.log(response);
    campaign.exercises = response.entity.exercises.map(function (exercise) {
        return new CodeGradX.Exercise(exercise);
    });
    return when(campaign.exercises);
  });
};

/** Get the list of all batches related to a campaign.

    @return {Promise<Array[Object]>} - yield an array of batches
    @property {string}       batch.uuid
    @property {Exercise}     batch.exercise_uuid
    @property {Person}       batch.person_id
    @property {string}       batch.label
    @property {Date}         batch.start
    @property {Date}         batch.archived
    @property {Date}         batch.finished

 */

CodeGradX.Campaign.prototype.getBatches = function (refresh = false) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getBatches1', campaign);
  if ( ! refresh && campaign.batches ) {
      return when(campaign.batches);
  }
  return state.sendAXServer('x', {
    path: ('/campaign/listBatches/' + campaign.name),      
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getBatches2');
    //console.log(response);
    campaign.batches = response.entity.batches.map(function (batch) {
        return new CodeGradX.Batch(batch);
    });
    return when(campaign.batches);
  });
};
CodeGradX.Campaign.prototype.getBatchs =
    CodeGradX.Campaign.prototype.getBatches;


/** Get the skills of the students enrolled in the current campaign.

    @return {Promise} yields {Object}
    @property {Object} skills.you
    @property {number} skills.you.personId - your numeric identifier
    @property {number} skills.you.skill - your own skill
    @property {Array<skill>} skills.all - array of Object
    @property {Object} skills.all[].skill - some student's skill

    */

CodeGradX.Campaign.prototype.getSkills = function (refresh = false) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getSkills1', campaign);
  if ( ! refresh && campaign.skills ) {
      return when(campaign.skills);
  }
  return state.sendAXServer('x', {
    //path: ('/skill/campaign/' + campaign.name),
    path: ('/statistics/myPosition/' + campaign.name),      
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getSkills2');
    //console.log(response);
    campaign.skills = response.entity;
    return when(campaign.skills);
  });
};

/** list the jobs submitted by the current user in the current campaign.

      @returns {Promise} yields Array[Job]
    */

CodeGradX.Campaign.prototype.getJobs = function () {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
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
    state.jobs = _.map(response.entity.jobs, CodeGradX.Job.js2job);
    return when(state.jobs);
  });
};

/** Get the jobs submitted by a student in the current campaign.
    This is restricted to admins or teachers of the campaign.
    
    @returns {Promise} yields Array[Job]
*/

CodeGradX.Campaign.prototype.getCampaignStudentJobs = function (user) {
  const state = CodeGradX.getCurrentState();
  const campaign = this;
  state.debug('getAchievements1', campaign, user);
  return state.sendAXServer('x', {
    path: ('/history/campaignJobs/' + campaign.name + '/' + user.personid),
    method: 'GET',
    headers: {
      Accept: "application/json"
    }
  }).then(function (response) {
    state.debug('getAchievements2');
    //console.log(response);
    user.jobs = _.map(response.entity.jobs, CodeGradX.Job.js2job);
    return when(user.jobs);
  });
};

/** Get the (tree-shaped) set of exercises of a campaign. This
    mechanism is used to get an updated list of exercises. First, look
    in an X server then on the site associated to the campaign.

      @return {Promise} yields {ExercisesSet}

    */

CodeGradX.Campaign.prototype.getExercisesSet = function () {
    const state = CodeGradX.getCurrentState();
    const campaign = this;
    state.debug('getExercisesSet1', campaign);
    if ( campaign.exercisesSet ) {
        return when(campaign.exercisesSet);
    }
    function processResponse (response) {
        state.debug('getExercisesSet1', response);
        campaign.exercisesSet = new CodeGradX.ExercisesSet(response.entity);
        return when(campaign.exercisesSet);
    }
    
    const p3 = state.sendConcurrently('x', {
        path: ('/exercisesset/path/' + campaign.name),
        method: 'GET',
        headers: {
            Accept: "application/json"
        }
    });
    return p3.then(processResponse).catch(function (reason) {
        try {
            state.debug("getExercisesSet2Error", reason);
            const request1 = {
                method: 'GET',
                path: campaign.home_url + "/exercises.json",
                headers: {
                    Accept: "application/json"
                }
            };
            return state.userAgent(request1)
                .then(processResponse);
        } catch (e) {
            // Probably: bad host name!
            state.debug("getExercisesSet3Error", e);
        }
    });
};

/** Get a specific Exercise with its name within the tree of
    Exercises of the current campaign.

        @param {string} name - full name of the exercise
        @returns {Promise} yields {Exercise}

    */

CodeGradX.Campaign.prototype.getExercise = function (name) {
  const state = CodeGradX.getCurrentState();
  state.debug('getExercise', name);
  const campaign = this;
  return campaign.getExercisesSet().then(function (exercisesSet) {
    const exercise = exercisesSet.getExercise(name);
    if ( exercise ) {
      return when(exercise);
    } else {
      return when.reject(new Error("No such exercise " + name));
    }
  });
};

/** Send the content of a file selected by an input:file widget in the
 * browser. 

      @param {DOM} form DOM element
      @returns {Promise<ExercisesSet>} yields {ExercisesSet}

The form DOM element must contain an <input type='file' name='content'>
element. This code only runs in a browser providing the FormData class.

*/

CodeGradX.Campaign.prototype.uploadExercisesSetFromDOM = function (form) {
    const state = CodeGradX.getCurrentState();
    const campaign = this;
    state.debug('uploadExercisesSetFromDOM1', FW4EX.currentExercisesSetFileName);
    function processResponse (response) {
        //console.log(response);
        state.debug('uploadExercisesSetFromDOM2', response);
        campaign.exercisesSet = new CodeGradX.ExercisesSet(response.entity);
        return when(campaign.exercisesSet);
    }
    const basefilename = FW4EX.currentFileName
        .replace(new RegExp("^.*/"), '');
    const headers = {
        "Content-Type": "multipart/form-data",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'application/json'
    };
    const fd = new FormData(form);
    return state.sendAXServer('x', {
        path: ('/exercisesset/yml2json/' + campaign.name),
        method: "POST",
        headers: headers,
        entity: fd
    }).then(processResponse);
};

/** Get related notifications.

    @param {int} count - only last count notifications.
    @param {int} from - only notifications that occur in the last from hours
    @returns {Promise<Notifications>} yields Object[]

Notifications are regular objects.

*/

CodeGradX.Campaign.prototype.getNotifications = function (count, from) {
    let state = CodeGradX.getCurrentState();
    let campaign = this;
    state.debug('getNotifications1', from, count);
    function processResponse (response) {
        state.debug('getNotifications2', response);
        return response.entity;
    }
    let headers = {
        "Accept": 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    count = count ||
        CodeGradX.Campaign.prototype.getNotifications.default.count;
    let entity = { count };
    if ( from ) {
        entity.from = from;
    }
    return state.sendAXServer('x', {
        path: ('/notification/campaign/' + campaign.name),
        method: 'POST',
        headers: headers,
        entity: entity            
    }).then(processResponse);
};
CodeGradX.Campaign.prototype.getNotifications.default = {
    count: 10
};

/** get the best job reports 

    @param {Exercise} exercise - an Exercise of the campaign
    @returns {Promise<Jobs>} yields Job[]

 {"jobs":[
   {"person_id":2237361,
    "totalMark":1,
    "archived":"2017-07-08T20:04:49",
    "uuid":"B28BE79C641811E7901800E6ED542A8E",
    "mark":0,
    "exercise_nickname":"notes",
    "kind":"job",
    "exercise_uuid":"11111111111199970003201704080001",
    "exercise_name":"cnam.mooc.socle.notes.1",
    "started":"2017-07-08T20:04:52",
    "finished":"2017-07-08T20:04:52"},
   ... ]}

*/

CodeGradX.Campaign.prototype.getTopJobs = function (exercise) {
    let state = CodeGradX.getCurrentState();
    let campaign = this;
    state.debug('getTopJobs1', exercise);
    function processResponse (response) {
        state.debug('getTopJobs2', response);
        let jobs = response.entity.jobs;
        return jobs.map(CodeGradX.Job.js2job);
    }
    let headers = {
        "Accept": 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    let exoUUID = exercise.uuid.replace(/-/, '');
    return state.sendAXServer('x', {
        path: ('/exercise/campaign/' + campaign.name + '/' + exoUUID),
        method: 'GET',
        headers: headers
    }).then(processResponse);
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
    @property {string} server - base URL of the server that served the exercise

    The `getDescription()` method completes the description of an Exercise
    with the following fields:

    @property {XMLstring} _XMLdescription - raw XML description
    @property {Object} _description - description
    @property {Array<Author>} authorship - Array of authorship
    @property {XMLstring} XMLstem - raw XML stem
    @property {string} stem - default HTML translation of the XML stem
    @property {Object} expectations - files expected in student's answer
    @property {Object} equipment - files to be given to the student

    This field may be present if there is a single file in expectations:

    @property {string} inlineFileName - single file expected in student's answer

    */

CodeGradX.Exercise = function (js) {
    function normalizeUUID (uuid) {
        const uuidRegexp = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;
        return uuid.replace(/-/g, '').replace(uuidRegexp, "$1-$2-$3-$4-$5");
    }
    if ( js.uuid && ! js.exerciseid ) {
        js.exerciseid = normalizeUUID(js.uuid);
    }
    if ( js.uuid && ! js.location ) {
        js.location = '/e' + js.uuid.replace(/-/g, '').replace(/(.)/g, "/$1");
    }
    Object.assign(this, js);
};

CodeGradX.Exercise.js2exercise = function (js) {
    return new CodeGradX.Exercise(js);
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
    const exercise = this;
    const state = CodeGradX.getCurrentState();
    state.debug('getDescription1', exercise);
    if ( exercise._description ) {
        return when(exercise._description);
    }
    if ( ! exercise.safecookie ) {
        return when.reject("Non deployed exercise " + exercise.name);
    }
    const promise = state.sendESServer('e', {
        path: ('/exercisecontent/' + exercise.safecookie + '/content'),
        method: 'GET',
        headers: {
            Accept: "text/xml",
            // useful for debug:
            "X-CodeGradX-Comment": `ExerciseName=${exercise.name}`
        }
    });
    // Parse the HTTP response, translate the XML into a Javascript object
    // and provide it to the sequel:
    const promise1 = promise.then(function (response) {
        state.debug('getDescription2', response);
        //console.log(response);
        exercise.server = response.url.replace(
            new RegExp('^(https?://[^/]+)/.*$'), "$1");
        exercise._XMLdescription = response.entity;
        function parseXML (description) {
            state.debug('getDescription2b', description);
            exercise._description = description;
            //description._exercise = exercise;
            return when(description);
        }
        return CodeGradX.parsexml(exercise._XMLdescription).then(parseXML);
    });
    const promise3 = promise.then(function (response) {
        // Extract stem
        state.debug("getDescription4", response);
        const contentRegExp = new RegExp("^(.|\n)*(<\s*content\s*>(.|\n)*</content\s*>)(.|\n)*$");
        const content = response.entity.replace(contentRegExp, "$2");
        exercise.XMLcontent = content;
        exercise.stem = CodeGradX.xml2html(content, { exercise });
        // extract equipment:
        state.debug("getDescription5b", exercise);
        extractEquipment(exercise, response.entity);
        // extract identity and authorship:
        state.debug("getDescription6", exercise);
        return extractIdentification(exercise, response.entity);
    });
    const promise4 = promise.then(function (response) {
        // If only one question expecting only one file, retrieve its name:
        state.debug('getDescription5c');
        const expectationsRegExp =
            new RegExp("<\s*expectations\s*>((.|\n)*?)</expectations\s*>", "g");
        function concat (s1, s2) {
            return s1 + s2;
        }
        const expectationss = response.entity.match(expectationsRegExp);
        if ( expectationss ) {
            const files = _.reduce(expectationss, concat);
            const expectations = '<div>' + files + '</div>';
            return CodeGradX.parsexml(expectations).then(function (result) {
                state.debug('getDescription5a');
                if ( Array.isArray(result.div.expectations.file) ) {
                    // to be done. Maybe ? Why ?
                } else {
                    //console.log(result.div.expectations);
                    exercise.expectations = result.div.expectations;
                    exercise.inlineFileName = result.div.expectations.file.$.basename;
                }
                return when(response);
            }).catch(function (/*reason*/) {
                exercise.expectations = [];
                return when(response);
            });
        } else {
            exercise.expectations = [];
            return when(response);
        }
    });
    return when.join(promise3, promise4)
        .then(function (/*values*/) {
            return promise1;
        });
};

/** Get an equipment file that is a file needed by the students
    and stored in the exercise.
    
    @param {string} file - the name of the file
    @returns {Promise<>} 

*/

CodeGradX.Exercise.prototype.getEquipmentFile = function (file) {
    const exercise = this;
    const state = CodeGradX.getCurrentState();
    state.debug('getEquipmentFile1', exercise, file);
    if ( ! exercise.safecookie ) {
        return when.reject("Non deployed exercise " + exercise.name);
    }
    const promise = state.sendESServer('e', {
        path: ('/exercisecontent/' + exercise.safecookie + '/path' + file),
        method: 'GET',
        headers: {
            Accept: "*/*"
        }
    });
    return promise.catch(function (reason) {
        console.log(reason);
        return when.reject(reason);
    });
};

/** Convert an XML fragment describing the identification of an
    exercise and stuff the Exercise instance.

    <identification name="" date="" nickname="">
      <summary></summary>
      <tags></tags>
      <authorship></authorship>
    </identification>

*/

const identificationRegExp =
  new RegExp("^(.|\n)*(<\s*identification +(.|\n)*</identification\s*>)(.|\n)*$");
const summaryRegExp =
  new RegExp("^(.|\n)*(<\s*summary.*?>(.|\n)*</summary\s*>)(.|\n)*$");

function extractIdentification (exercise, s) {
    const content = s.replace(identificationRegExp, "$2");
    return CodeGradX.parsexml(content).then(function (result) {
        if ( ! result.identification ) {
            return when(exercise);
        }
        result = result.identification;
        // extract identification:
        exercise.name = result.$.name;
        exercise.nickname = result.$.nickname;
        exercise.date = result.$.date;
        const summary = content.replace(summaryRegExp, "$2");
        exercise.summary = CodeGradX.xml2html(summary);
        if ( Array.isArray(result.tags.tag) ) {
            exercise.tags = result.tags.tag.map(function (tag) {
                return tag.$.name;
            });
        } else {
            exercise.tags = [result.tags.tag.$.name];
        }
        // extract authors
        const authors = result.authorship;
        if ( Array.isArray(authors.author) ) {
            exercise.authorship = authors.author;
        } else {
            exercise.authorship = [ authors.author ];
        }
        return when(exercise);
    });
}

/** Convert an XML fragment describing directories and files into
    pathnames. For instance,

    <expectations>
      <file basename='foo'/>
      <directory basename='bar'>
        <file basename='hux'/>
        <file basename='wek'/>
      </directory>
    </expectations>

   will be converted into 
    
    [ '/foo', '/bar/hux', '/bar/wek']


function extractExpectations (exercice, s) {
    return exercise;
}

*/

/** Convert an XML fragment describing directories and files into
    pathnames. For instance,

    <equipment>
      <file basename='foo'/>
      <directory basename='bar'>
        <file basename='hux'/>
        <file basename='wek'/>
      </directory>
    </equipment>

   will be converted into 
    
    [ '/foo', '/bar/hux', '/bar/wek']

*/

function extractEquipment (exercise, s) {
    exercise.equipment = [];
    const equipmentRegExp = new RegExp(
        "^(.|\n)*(<equipment>\s*(.|\n)*?\s*</equipment>)(.|\n)*$");
    const content = s.replace(equipmentRegExp, "$2");
    if ( s.length === content.length ) {
        // No equipment!
        return exercise;
    }
    function flatten (o, dir) {
        let results = [];
        if ( o.directory ) {
            if ( Array.isArray(o.directory) ) {
                o.directory.forEach(function (o) {
                    const newdir = dir + '/' + o.$.basename;
                    results = results.concat(flatten(o, newdir));
                });
            } else {
                const newdir = dir + '/' + o.directory.$.basename;
                results = results.concat(flatten(o.directory, newdir));
            }
        }
        if ( o.file ) {
            if ( Array.isArray(o.file) ) {
                o.file.forEach(function (o) {
                    results = results.concat(flatten(o, dir));
                });
            } else {
                o = o.file;
            }
        }
        if ( !o.file && !o.directory && o.$ && o.$.basename && ! o.$.hidden ) {
            results.push(dir + '/' + o.$.basename);
        }
        return results;
    }
    if ( content.length > 0 ) {
        try {
            const parser = new xml2js.Parser({
                explicitArray: false,
                trim: true
            });
            parser.parseString(content, function (err, result) {
                exercise.equipment = flatten(result.equipment, '');
            });
        } catch (e) {
            const state = CodeGradX.getCurrentState();
            state.debug("extractEquipment", e);
        }
    }
    return exercise;
}

/** Promisify an XML to Javascript converter.

        @param {string} xml - string to parse
        @returns {Promise}

      */

CodeGradX.parsexml = function (xml) {
  if ( ! xml ) {
    return when.reject("Cannot parse XML " + xml);
  }
  const parser = new xml2js.Parser({
    explicitArray: false,
    trim: true
  });
  let xerr, xresult;
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
  const exercise = this;
  const state = CodeGradX.getCurrentState();
  state.debug('sendStringAnswer1', answer);
  if ( ! exercise.safecookie ) {
    return when.reject("Non deployed exercise " + exercise.name);
  }
  if ( typeof exercise.inlineFileName === 'undefined') {
      if ( exercise._description ) {
          return when.reject(new Error("Non suitable exercise"));
      } else {
          return exercise.getDescription()
          .then(function (/*description*/) {
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
      const job = new CodeGradX.Job({
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
  const content = new Buffer(answer, 'utf8');
  const headers = {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": ("inline; filename=" + exercise.inlineFileName),
      "Accept": 'text/xml'
  };
    if ( CodeGradX.isNode() ) {
        headers["Content-Length"] = content.length;
    }
  return state.sendAXServer('a', {
    path: ('/exercise/' + exercise.safecookie + '/job'),
    method: "POST",
    headers: headers,
    entity: content
  }).then(processResponse);
};

/** Send the content of a file selected by an input:file widget in the
 * browser. Returns a Job on which you may invoke the `getReport` method.

      @param {DOM} form DOM element
      @returns {Promise<Job>} yields {Job}

The form DOM element must contain an <input type='file' name='content'>
element. This code only runs in a browser providing the FormData class.

*/

CodeGradX.Exercise.prototype.sendFileFromDOM = function (form) {
    const exercise = this;
    const state = CodeGradX.getCurrentState();
    state.debug('sendZipFileAnswer1', FW4EX.currentFileName);
    if ( ! exercise.safecookie ) {
        return when.reject("Non deployed exercise " + exercise.name);
    }
    function processResponse (response) {
        //console.log(response);
        state.debug('sendZipFileAnswer2', response);
        return CodeGradX.parsexml(response.entity).then(function (js) {
            //console.log(js);
            state.debug('sendZipFileAnswer3', js);
            js = js.fw4ex.jobSubmittedReport;
            exercise.uuid = js.exercise.$.exerciseid;
            const job = new CodeGradX.Job({
                exercise: exercise,
                content: FW4EX.currentFileName,
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
    const basefilename = FW4EX.currentFileName.replace(new RegExp("^.*/"), '');
    const headers = {
        "Content-Type": "multipart/form-data",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'text/xml'
    };
    const fd = new FormData(form);
    return state.sendAXServer('a', {
        path: ('/exercise/' + exercise.safecookie + '/job'),
        method: "POST",
        headers: headers,
        entity: fd
    }).then(processResponse);
};

/** Send a batch of files that is, multiple answers to be marked
    against an Exercise. That file is selected with an input:file
    widget in the browser.

    @param {DOMform} form - the input:file widget
    @returns {Promise<Batch>} yielding a Batch.

The form DOM element must contain an <input type='file' name='content'>
element. This code only runs in a browser providing the FormData class.

*/

CodeGradX.Exercise.prototype.sendBatchFromDOM = function (form) {
    const exercise = this;
    const state = CodeGradX.getCurrentState();
    state.debug('sendBatchFile1');
    if ( ! exercise.safecookie ) {
        return when.reject("Non deployed exercise " + exercise.name);
    }
    function processResponse (response) {
        //console.log(response);
        state.debug('sendBatchFile2', response);
        return CodeGradX.parsexml(response.entity).then(function (js) {
            //console.log(js);
            state.debug('sendBatchFile3', js);
            js = js.fw4ex.multiJobSubmittedReport;
            exercise.uuid = js.exercise.$.exerciseid;
            const batch = new CodeGradX.Batch({
                exercise: exercise,
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
    const basefilename = FW4EX.currentFileName.replace(new RegExp("^.*/"), '');
    const headers = {
        "Content-Type": "multipart/form-data",
        "Content-Disposition": ("inline; filename=" + basefilename),
        "Accept": 'text/xml'
    };
    const fd = new FormData(form);
    return state.sendAXServer('a', {
        path: ('/exercise/' + exercise.safecookie + '/batch'),
        method: "POST",
        headers: headers,
        entity: fd
    }).then(processResponse);
};

/** After submitting a new Exercise, get Exercise autocheck reports
    that is, the job reports corresponding to the pseudo-jobs
    contained in the Exercise TGZ file.

  @param {Object} parameters - @see CodeGradX.sendRepeatedlyESServer
  @returns {Promise<Exercise>} yielding an Exercise

  The `getExerciseReport()` method will add some new fields to the
  Exercise object:

  @property {XMLstring} XMLauthorReport - raw XML report
  @property {string} globalReport - global report
  @property {number} totaljobs - the total number of pseudo-jobs
  @property {number} finishedjobs - the number of marked pseudo-jobs
  @property {Hashtable<Job>} pseudojobs - Hashtable of pseudo-jobs

  For each pseudo-job, are recorded all the fields of a regular Job
  plus some additional fields such as `duration`.

  The globalReport is the report independent of the pseudojob reports.

  If the exercise is successfully autochecked, it may be used by
  `sendStringAnswer()`, `sendFileAnswer()` or `sendBatch()` methods
  using the additional `safecookie` field:

  @property {string} safecookie - the long identifier of the exercise.

A failure might be:

  <fw4ex version="1.0">
    <exerciseAuthorReport exerciseid="9A9701A8-CE17-11E7-AB9A-DBAB25888DB0">
      <report>
      </report>
    </exerciseAuthorReport>
  </fw4ex>

*/

CodeGradX.Exercise.prototype.getExerciseReport = function (parameters) {
  const exercise = this;
  const state = CodeGradX.getCurrentState();
  state.debug("getExerciseReport1", exercise, parameters);
  if ( exercise.finishedjobs ) {
      return when(exercise);
  }
  function processResponse (response) {
    state.debug("getExerciseReport2", response);
    //console.log(response);
    exercise.originServer = response.url.replace(/^(.*)\/s\/.*$/, "$1");
    exercise.XMLauthorReport = response.entity;
    function catchXMLerror (reason) {
        state.debug("catchXMLerror", reason);
        return when.reject(reason);
    }
    state.debug("getExerciseReport3a");
    return extractIdentification(exercise, response.entity)
          .then(function (/*exercise*/) {
              state.debug("getExerciseReport3b");
              return CodeGradX.parsexml(response.entity);
          }).then(function (js) {
              state.debug("getExerciseReport3c", js);
              js = js.fw4ex.exerciseAuthorReport;
              exercise.pseudojobs = {};
              exercise._pseudojobs = [];
              if ( js.report ) {
                  exercise.globalReport = js.report;
                  if ( ! js.pseudojobs || js.pseudojobs.length === 0 ) {
                      return when(exercise);
                  }
              }
              exercise.totaljobs =
                  CodeGradX._str2num(js.pseudojobs.$.totaljobs);
              exercise.finishedjobs =
                  CodeGradX._str2num(js.pseudojobs.$.finishedjobs);
              function processPseudoJob (jspj) {
                  const name = jspj.submission.$.name;
                  const job = new CodeGradX.Job({
                      exercise:  exercise,
                      XMLpseudojob: jspj,
                      jobid:     jspj.$.jobid,
                      pathdir:   jspj.$.location,
                      duration:  CodeGradX._str2num(jspj.$.duration),
                      problem:   false,
                      label:     name
                      // partial marks TOBEDONE
                  });
                  if ( jspj.marking ) {
                      job.expectedMark = CodeGradX._str2num2decimals(
                          jspj.submission.$.expectedMark);
                      job.mark = CodeGradX._str2num2decimals(
                          jspj.marking.$.mark);
                      job.totalMark = CodeGradX._str2num2decimals(
                          jspj.marking.$.totalMark);
                      job.archived =
                          CodeGradX._str2Date(jspj.marking.$.archived);
                      job.started =
                          CodeGradX._str2Date(jspj.marking.$.started);
                      job.ended =
                          CodeGradX._str2Date(jspj.marking.$.ended);
                      job.finished =
                          CodeGradX._str2Date(jspj.marking.$.finished);
                  }
                  if ( jspj.$.problem ) {
                      job.problem = true;
                      if ( jspj.report ) {
                          job.problem = jspj.report;
                      }
                  }
                  exercise.pseudojobs[name] = job;
                  exercise._pseudojobs.push(job);
              }
              const pseudojobs = js.pseudojobs.pseudojob;
              if ( Array.isArray(pseudojobs) ) {
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
      path: exercise.getExerciseReportURL(),
      method: 'GET',
      headers: {
          "Accept": 'text/xml'
      }
  }).then(processResponse);
};

CodeGradX.Exercise.prototype.getBaseURL = function () {
    const exercise = this;
    const path = exercise.location + '/' + exercise.exerciseid;
    return path;
};
CodeGradX.Exercise.prototype.getExerciseReportURL = function () {
    const exercise = this;
    return exercise.getBaseURL() + '.xml';
};
CodeGradX.Exercise.prototype.getTgzURL = function () {
    const exercise = this;
    return exercise.getBaseURL() + '.tgz';
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
      if ( json.name && json.nickname ) {
          return new CodeGradX.Exercise(json);
      } else {
          throw new Error("Not an exercise " + JSON.stringify(json));
      }
    }
  }
  if ( Array.isArray(json) ) {
    // no title, prologue nor epilogue.
    this.exercises = _.map(json, processItem);
  } else {
    // initialize optional title, prologue, epilogue:
    Object.assign(this, json);
    this.exercises = _.map(json.exercises, processItem);
  }
};

/** Fetch a precise ExercisesSet. This is mainly used to update the
    current set of exercises. Attention, this is not a method but a
    static function!

    @param {String} path - URI of the exercises.json file
    @returns {Promise<ExercisesSet>} yields ExercisesSet

*/

CodeGradX.ExercisesSet.getExercisesSet = function (name) {
    const state = CodeGradX.getCurrentState();
    state.debug('UgetExercisesSet1', name);
    const p3 = state.sendAXServer('x', {
        path: ('/exercisesset/path/' + name),
        method: 'GET',
        headers: {
            Accept: "application/json"
        }
    });
    return p3.then(function (response) {
        state.debug('UgetExercisesSet2', response);
        const exercisesSet = new CodeGradX.ExercisesSet(response.entity);
        return when(exercisesSet);
    }).catch(function (reason) {
        state.debug('UgetExercisesSet3', reason);
        return when(undefined);
    });
};

/** Find an exercise by its name in an ExercisesSet that is,
    a tree of Exercises.

    @param {String|Number} name
    @returns {Exercise}

  */

CodeGradX.ExercisesSet.prototype.getExercise = function (name) {
  const exercises = this;
  if ( _.isNumber(name) ) {
      return exercises.getExerciseByIndex(name);
  } else {
      return exercises.getExerciseByName(name);
  }
};

CodeGradX.ExercisesSet.prototype.getExerciseByName = function (name) {
  const exercisesSet = this;
  //console.log(exercisesSet);// DEBUG
  function find (thing) {
    if ( thing instanceof CodeGradX.ExercisesSet ) {
      const exercises = thing.exercises;
      for ( let i=0 ; i<exercises.length ; i++ ) {
        //console.log("explore " + i + '/' + exercises.length);
        const result = find(exercises[i]);
        if ( result ) {
          return result;
        }
      }
      return false;
    } else if ( thing instanceof CodeGradX.Exercise ) {
      const exercise = thing;
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
  const exercises = this;
  function find (exercises) {
    if ( Array.isArray(exercises) ) {
      for ( let i=0 ; i<exercises.length ; i++ ) {
        //console.log("explore " + i); // DEBUG
        const result = find(exercises[i]);
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
    function normalizeUUID (uuid) {
        const uuidRegexp = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;
        return uuid.replace(/-/g, '').replace(uuidRegexp, "$1-$2-$3-$4-$5");
    }
    if ( js.uuid && ! js.jobid ) {
        js.jobid = normalizeUUID(js.uuid);
    }
    js.mark = CodeGradX._str2num2decimals(js.mark);
    js.totalMark = CodeGradX._str2num2decimals(js.totalMark);
    if ( js.jobid && ! js.pathdir ) {
        js.pathdir = '/s' + js.jobid.replace(/-/g, '').replace(/(.)/g, "/$1");
    }
  Object.assign(this, js);
};

CodeGradX.Job.js2job = function (js) {
    return new CodeGradX.Job(js);
};

/** Get the marking report of that Job. The marking report will be stored
    in the `XMLreport` and `report` properties.

  @param {Object} parameters - for repetition see sendRepeatedlyESServer.default
  @returns {Promise} yields {Job}

  */

CodeGradX.Job.prototype.getReport = function (parameters) {
  parameters = parameters || {};
  const job = this;
  const state = CodeGradX.getCurrentState();
  state.debug('getJobReport1', job);
  if ( job.XMLreport ) {
    return when(job);
  }
  const path = job.getReportURL();
  const promise = state.sendRepeatedlyESServer('s', parameters, {
    path: path,
    method: 'GET',
    headers: {
      "Accept": "text/xml"
    }
  });
  const promise1 = promise.then(function (response) {
    //state.log.show();
    //console.log(response);
    state.debug('getJobReport2', job);
    job.originServer = response.url.replace(/^(.*)\/s\/.*$/, "$1");
    job.XMLreport = response.entity;
    return when(job);
  }).catch(function (reasons) {
      // sort reasons and extract only waitedTooMuch if present:
      function tooLongWaiting (reasons) {
          if ( Array.isArray(reasons) ) {
              for ( let i = 0 ; i<reasons.length ; i++ ) {
                  const r = reasons[i];
                  const result = tooLongWaiting(r);
                  if ( result ) {
                      return result;
                  }
              }
          } else if ( reasons instanceof Error ) {
              if ( reasons.message.match(/waitedTooMuch/) ) {
                  return reasons;
              }
          }
          return undefined;
      }
      const result = tooLongWaiting(reasons);
      return when.reject(result || reasons);
  });
  const promise2 = promise.then(function (response) {
    // Fill archived, started, ended, finished, mark and totalMark
    state.debug('getJobReport3', job);
    const markingRegExp = new RegExp("^(.|\n)*(<marking (.|\n)*?>)(.|\n)*$");
    let marking = response.entity.replace(markingRegExp, "$2");
    state.debug('getJobReport3 marking', marking);
    //console.log(marking); //DEBUG
    if ( marking.length === response.entity.length ) {
        return when.reject(response);
    }
    marking = marking.replace(/>/, "/>");
    //console.log(marking);
    return CodeGradX.parsexml(marking).then(function (js) {
      job.mark = CodeGradX._str2num2decimals(js.marking.$.mark);
      job.totalMark = CodeGradX._str2num2decimals(js.marking.$.totalMark);
      job.archived  = CodeGradX._str2Date(js.marking.$.archived);
      job.started   = CodeGradX._str2Date(js.marking.$.started);
      job.ended     = CodeGradX._str2Date(js.marking.$.ended);
      job.finished  = CodeGradX._str2Date(js.marking.$.finished);
      // machine, partial marks TO BE DONE
      return when(response);
    });
  });
  const promise3 = promise.then(function (response) {
    // Fill exerciseid (already in exercise.uuid !)
    state.debug('getJobReport4', job);
    const exerciseRegExp = new RegExp("^(.|\n)*(<exercise (.|\n)*?>)(.|\n)*$");
    const exercise = response.entity.replace(exerciseRegExp, "$2");
    if ( exercise.length === response.entity.length ) {
        return when.reject(response);
    }
    //console.log(exercise);
    return CodeGradX.parsexml(exercise).then(function (js) {
      Object.assign(job, js.exercise.$);
      return when(response);
    });
  });
  const promise4 = promise.then(function (response) {
    // Fill report
    state.debug('getJobReport5');
    const contentRegExp = new RegExp("^(.|\n)*(<report>(.|\n)*?</report>)(.|\n)*$");
    const content = response.entity.replace(contentRegExp, "$2");
    //state.debug('getJobReport5 content',
    //         content.length, response.entity.length);
    if ( content.length === response.entity.length ) {
        return when.reject(response);
    }
    job.HTMLreport = CodeGradX.xml2html(content);
    return when(response);
  });
  return when.join(promise2, promise3, promise4).then(function (/*values*/) {
    state.debug('getJobReport6', job);
    //console.log(job);
    return promise1;
  }).finally(function () {
      return promise1;
  });
};

/** Get the problem report of that Job if it exists. The marking
    report will be stored in the `XMLproblemReport` property. If no
    problem report exists, the returned promise is rejected.

  @param {Object} parameters - for repetition see sendRepeatedlyESServer.default
  @returns {Promise} yields {Job}

  */

CodeGradX.Job.prototype.getProblemReport = function (parameters) {
    parameters = parameters || {};
    const job = this;
    const state = CodeGradX.getCurrentState();
    state.debug('getJobProblemReport1', job);
    if ( ! job.problem ) {
        return when.reject("No problem report");
    }
    if ( job.XMLproblemReport ) {
        return when(job);
    }
    const path = job.getProblemReportURL();
    const promise = state.sendRepeatedlyESServer('s', parameters, {
        path: path,
        method: 'GET',
        headers: {
            "Accept": "text/xml"
        }
    });
    const promise1 = promise.then(function (response) {
        //state.log.show();
        //console.log(response);
        state.debug('getJobProblemReport2', job);
        job.originServer = response.url.replace(/^(.*)\/s\/.*$/, "$1");
        job.XMLproblemReport = response.entity;
        return when(job);
    });
    return promise1;
};

/** Compute the URL that form the base URL to access directly the
    report, the problem report or the archive containing student's
    programs.
  
    @returns {string} url

*/

CodeGradX.Job.prototype.getBaseURL = function () {
    const job = this;
    const path = job.pathdir + '/' + job.jobid;
    return path;
};
CodeGradX.Job.prototype.getReportURL = function () {
    const job = this;
    return job.getBaseURL() + '.xml';
};
CodeGradX.Job.prototype.getProblemReportURL = function () {
    const job = this;
    return job.getBaseURL() + '_.xml';
};
CodeGradX.Job.prototype.getTgzURL = function () {
    const job = this;
    return job.getBaseURL() + '.tgz';
};

/** Conversion of texts (stems, reports) from XML to HTML.
    This function may be modified to accommodate your own desires.
*/

CodeGradX.xml2html = function (s, options) {
  options = Object.assign({}, CodeGradX.xml2html.default, options);
  let result = '';
  //const mark, totalMark;
  let mode = 'default';
  let questionCounter = 0, sectionLevel = 0;
  // HTML tags to be left as they are:    
  const htmlTagsRegExp = new RegExp('^(p|pre|code|ul|ol|li|em|it|i|sub|sup|strong|b)$');
  // Tags to be converted into DIV:
  const divTagsRegExp = new RegExp('^(warning|error|introduction|conclusion|normal|stem|report)$');
  // Tags to be converted into SPAN:
  const spanTagsRegExp = new RegExp("^(user|machine|lineNumber)$");
  // Tags with special hack:
  const specialTagRegExp = new RegExp("^(img|a)$");
  // Tags to be ignored:
  const ignoreTagsRegExp = new RegExp("^(FW4EX|expectations|title|fw4ex)$");
  function convertAttributes (attributes) {
    let s = '';
    _.forIn(attributes, function (value, name) {
      s += ' ' + name + '="' + value + '"';
    });
    return s;
  }
  const parser = sax.parser(true, {
    //trim: true
  });
  parser.onerror = function (e) {
      throw e;
  };
  const special = {
      "'": "&apos;",
      '"': "&quot;",
      '<': "&lt;",
      '>': "&gt;",
      '&': "&amp;"
  };
  parser.ontext= function (text) {
      if ( ! mode.match(/ignore/) ) {
          let htmltext = '';
          const letters = text.split('');
          for ( let i=0 ; i<letters.length ; i++ ) {
              const ch = letters[i];
              if ( special[ch] ) {
                  htmltext += special[ch];
              } else {
                  htmltext += ch;
              }
          }
          result += htmltext;
      }
  };
  function absolutize (node) {
      if ( options.exercise ) {
          const pathRegExp = new RegExp('^(./)?(path/.*)$');
          if ( node.attributes.src ) {
              let matches = node.attributes.src.match(pathRegExp);
              if ( matches ) {
                  node.attributes.src = options.exercise.server +
                      '/exercisecontent/' +
                      options.exercise.safecookie +
                      '/' +
                      matches[2];
              }
          }
          if ( node.attributes.href ) {
              let matches = node.attributes.href.match(pathRegExp);
              if ( matches ) {
                  node.attributes.href = options.exercise.server +
                      '/exercisecontent/' +
                      options.exercise.safecookie +
                      '/' +
                      matches[2];
              }
          }
      }
      const tagname = node.name;
      const attributes = convertAttributes(node.attributes);
      return '<' + tagname + attributes + ' />';
  }
  parser.onopentag = function (node) {
      const tagname = node.name;
      const attributes = convertAttributes(node.attributes);
      if ( tagname.match(ignoreTagsRegExp) ) {
        mode = 'ignore';
      } else if ( tagname.match(htmlTagsRegExp) ) {
        result += '<' + tagname + attributes + '>';
      } else if ( tagname.match(specialTagRegExp) ) {
        result += absolutize(node);
      } else if ( tagname.match(spanTagsRegExp) ) {
        result += '<span class="fw4ex_' + tagname + '"' + attributes + '>';
      } else if ( tagname.match(divTagsRegExp) ) {
        result += '<div class="fw4ex_' + tagname + '"' + attributes + '>';
      } else if ( tagname.match(/^mark$/) ) {
        const markOrig = CodeGradX._str2num(node.attributes.value);
        const mark =  options.markFactor * 
              CodeGradX._str2num2decimals(markOrig);
        result += '<span' + attributes + ' class="fw4ex_mark">' + 
              mark + '<!-- ' + markOrig;
      } else if ( tagname.match(/^section$/) ) {
        result += '<div' + attributes + ' class="fw4ex_section' +
          (++sectionLevel) + '">';
      } else if ( tagname.match(/^question$/) ) {
        const qname = node.attributes.name;
        const title = node.attributes.title || '';
        result += '<div' + attributes + ' class="fw4ex_question">';
        result += '<div class="fw4ex_question_title" data_counter="' +
           (++questionCounter) + '">' + qname + ": " +
            title + '</div>';
      } else {
        result += '<div class="fw4ex_' + tagname + '"' + attributes + '>';
      }
  };
  parser.onclosetag = function (tagname) {
      if ( tagname.match(ignoreTagsRegExp) ) {
        mode = 'default';
      } else if ( tagname.match(htmlTagsRegExp) ) {
        result += '</' + tagname + '>';
      } else if ( tagname.match(specialTagRegExp) ) {
        result = result;
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
  parser.oncdata = function (text) {
    if ( ! mode.match(/ignore/) ) {
        result += '<pre>' + he.encode(text);
    }
  };
  parser.cdata = function (text) {
    if ( ! mode.match(/ignore/) ) {
        result += he.encode(text);
    }
  };
  parser.onclosecdata = function () {
    if ( ! mode.match(/ignore/) ) {
        result += '</pre>';
    }
  };
  parser.write(s).close();
  if ( questionCounter <= 1 ) {
      // If only one question, remove its title:
      let questionTitleRegExp = new RegExp(
          '<div class=.fw4ex_question_title. [^>]*>.*?</div>');
      result = result.replace(questionTitleRegExp, '');
  }
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
  Object.assign(this, js);
};

/** Get the current state of the Batch report that is, always fetch
    it. See also `getFinalReport()` to get the final report of the
    batch where all answers are marked.

  @param {Object} parameters - parameters {@see sendRepeatedlyESServer}
  @returns {Promise<Batch>} yielding Batch

  */

CodeGradX.Batch.prototype.getReport = function (parameters) {
  const batch = this;
  const state = CodeGradX.getCurrentState();
  state.debug('getBatchReport1', batch);
  parameters = Object.assign({
      // So progress() may look at the current version of the batch report:
      batch: batch
    },
    CodeGradX.Batch.prototype.getReport.default,
    parameters);
  const path = batch.getReportURL();
  function processResponse (response) {
      //console.log(response);
      state.debug('getBatchReport2', response, batch);
      batch.originServer = response.url.replace(/^(.*)\/s\/.*$/, "$1");
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
              let job = state.cache.jobs[jsjob.$.jobid];
              if ( ! job ) {
                  job = new CodeGradX.Job({
                      exercise:  batch.exercise,
                      XMLjob:    jsjob,
                      jobid:     jsjob.$.jobid,
                      pathdir:   jsjob.$.location,
                      label:     jsjob.$.label,
                      problem:   false,
                      mark:      CodeGradX._str2num2decimals(
                          jsjob.marking.$.mark),
                      totalMark: CodeGradX._str2num2decimals(
                          jsjob.marking.$.totalMark),
                      started:   CodeGradX._str2Date(jsjob.marking.$.started),
                      finished:  CodeGradX._str2Date(jsjob.marking.$.finished)
                  });
                  if ( jsjob.$.problem ) {
                      job.problem = true;
                  }
                  job.duration = (job.finished.getTime() - 
                                  job.started.getTime() )/1000; // seconds
                  state.cache.jobs[job.jobid] = job;
              }
              batch.jobs[job.label] = job;
              return job;
          }
          if ( js.jobStudentReport ) {
              if ( Array.isArray(js.jobStudentReport) ) {
                  js.jobStudentReport.forEach(processJob);
              } else {
                  processJob(js.jobStudentReport);
              }
          }
          return when(batch);
    }
      batch.XMLreport = response.entity;
      return CodeGradX.parsexml(response.entity)
          .then(processJS)
          .catch(function (reason) {
              /* eslint "no-console": 0 */
              console.log(reason);
              console.log(response);
              return when.reject(reason);
          });
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
  progress: function (/*parameters*/) {}
};

/** Get the final state of the Batch report where all
    answers are marked. This method will update the `finishedjobs`
    and `jobs` fields.

  @param {Object} parameters - parameters {@see sendRepeatedlyESServer}
  @returns {Promise<Batch>} yielding Batch

  */

CodeGradX.Batch.prototype.getFinalReport = function (parameters) {
  const batch = this;
  const state = CodeGradX.getCurrentState();
  state.debug('getBatchFinalReport1', batch);
  if ( batch.finishedjobs &&
       batch.finishedjobs === batch.totaljobs ) {
      // Only return a complete report
      return when(batch);
  }
  parameters = Object.assign({
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
      const dt = parameters.step * 1000; // seconds
      return when(batch).delay(dt).then(tryFetching);
    } else {
      return when(batch);
    }
  }
  return tryFetching();
};

CodeGradX.Batch.prototype.getReportURL = function () {
    const batch = this;
    if ( ! batch.pathdir ) {
        batch.pathdir = '/b' +
            batch.batchid.replace(/-/g, '').replace(/(.)/g, "/$1");
    }
    const path = batch.pathdir + '/' + batch.batchid + '.xml';
    return path;
};

// end of codegradxlib.js
