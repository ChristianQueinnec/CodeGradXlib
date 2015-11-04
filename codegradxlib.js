/**
  Javascript Library to interact with the CodeGradX infrastructure
*/

(function () {
  var root = this;
  // Preserve previous CodeGradX for noConflict():
  var previous_CodeGradX = root.CodeGradX;

  function CodeGradX () {}

  CodeGradX.noConflict = function () {
    root.CodeGradX = previous_CodeGradX;
    return CodeGradX;
  };
  module.exports = CodeGradX;

var _    = require('lodash');
var http = require('http');
var when = require('when');
var rest = require('rest');
var mime = require('rest/interceptor/mime');
var cookie = require('cookie');
var sleep = require('sleep');
var xml2js = require('xml2js').parseString;
//var formurlencoded = require('form-urlencoded');


/* improvements
 * keep a round robin log
 */


// **************** Global state

CodeGradX.State = function () {
    this.userAgent = rest.wrap(mime);
    // State of servers:
    this.servers = {
      domain: '.paracamplus.com',
      names: ['a', 'e', 'x', 's'],
      a: { next: 2,
           suffix: '/alive',
           0: { host: 'a0.paracamplus.com',
                enabled: false },
           1: { enabled: false }  },
      e: { next: 1,
           suffix: '/alive',
           0: { enabled: false } },
      x: { next: 1,
           suffix: '/dbalive',
           0: { host: 'x.paracamplus.com',
                enabled: false } },
      s: { next: 1,
           suffix: '/',
           0: { enabled: false } } };
    // Caches for Exercises, Jobs, Batches
    this.caches = {};
    // Current values
    this.currentUser = null;
    this.currentCookie = null;
    // Make the state global
    var state = this;
    root.getCurrentState = function () {
      return state;
    };
};

/** Update the description of a server in order to determine if that
    server is available. The description may contain an optional `host`
    key with the name of the host to be checked. If the name is missing,
    the hostname is automatically inferred from the `kind`, `index` and
    `domain` information. After the check, the `enabled` key is set to
    a boolean telling wether the host is available or not.

    Description are gathered in `descriptions` with two additional
    keys: `suffix` is the path to add to the URL used to check the
    availability of the server. `next` is the index of a potentially
    available server of the same kind.

    @param {string} kind - the kind of server (a, e, x or s)
    @param {number} index - the number of the server.
    @returns {Promise}

    The check is driven by a description: a record
*/

CodeGradX.State.prototype.checkServer = function (kind, index) {
  if ( ! this.servers[kind] ||
    ! this.servers[kind][index] ) {
      this.servers[kind][index] = { enabled: false };
    }
  var descriptions = this.servers[kind];
  var description = descriptions[index];
  var host = description.host || (kind + index + this.servers.domain);
  description.host = host;
  // Don't use that host while being checked:
  description.enabled = false;
  description.lastError = undefined;
  function updateDescription (response) {
    description.enabled = (response.status.code === 200);
    return response;
  }
  function invalidateDescription (reason) {
    description.lastError = reason;
    throw reason;
  }
  return this.userAgent("http://" + host + descriptions.suffix)
    .then(updateDescription, invalidateDescription);
  };

CodeGradX.State.prototype.checkServers = function (kind) {
  var promise, promises = [];
  var descriptions = this.servers[kind];
  function incrementNext (response) {
    if ( response.status.code === 200 ) {
      descriptions.next++;
    }
  }
  for ( var key in descriptions ) {
    if ( /^\d+$/.exec(key) ) {
        promise = this.checkServer(kind, key);
        promises.push(promise);
    }
  }
  promise = this.checkServer(kind, descriptions.next).then(incrementNext);
  promises.push(promise);
  return when.all(promises);
};

CodeGradX.State.prototype.checkAllServers = function () {
  var promises = _.map(this.servers.names, this.checkServers, this);
  return when.all(promises);
};

/** Ask an A or X server.
  Send request to the first available server. In case of problems, try
  the next available server asap.
*/

CodeGradX.State.prototype.sendAXServer = function (kind, options) {
  var self = this;
  var newoptions = _.assign({}, options);
  if ( this.currentCookie ) {
    newoptions.headers.Cookie = this.currentCookie;
  }
  function updateCurrentCookie (response) {
    //console.log(response.headers);
    if ( response.headers['Set-Cookie'] ) {
      var cookies = response.headers['Set-Cookie'];
      cookies = _.map(cookies, function (s) {
        return s.replace(/;.*$/, '');
      });
      cookies = _.filter(cookies, function (s) {
        return /^u=U/.exec(s);
      });
      self.currentCookie = cookies;
    }
    return response;
  }
  var descriptions = _.filter(this.servers[kind], {enabled: true});
  function tryNext (reason) {
    if ( descriptions.length > 0 ) {
      var description = _.first(descriptions);
      descriptions = _.rest(descriptions);
      newoptions.path = 'http://' + description.host + options.path;
      //console.log('sending to ' + newoptions.path);
      return self.userAgent(newoptions).then(updateCurrentCookie, tryNext);
    } else {
      throw reason;
    }
  }
  return tryNext();
};

/** Ask once an E or S server.
  Send request concurrently to all available servers.
*/

CodeGradX.State.prototype.sendESServer = function (kind, options) {
  var self = this;
  var newoptions = _.assign({}, options);
  newoptions.headers = _.assign({}, options.headers);
  if ( this.currentCookie ) {
    newoptions.headers.Cookie = cookie.serialize('u', this.currentCookie);
  }
  var descriptions = _.filter(this.servers[kind], {enabled: true});
  function trySending (description) {
    var tryoptions = _.assign({}, newoptions);
    tryoptions.path = 'http://' + description.host + options.path;
    //console.log('sending to ' + newoptions.path);
    return self.userAgent(tryoptions);
  }
  var promises = _.map(descriptions, trySending);
  return when.any(promises);
};

/** Ask repeatedly an E or S server.
  Send request to all available servers and repeat in case of problems.
  parameters = {
      step: n // seconds between each attempt
      attempts: n // at most n attempts
      progress: function (i) {} // invoked before each step
  }

  Nota: what become the other promises not selected by when.any ? Do they
  continue to run ? This might be a problem for sendMultiplyESServer ???
*/

CodeGradX.State.prototype.sendMultiplyESServer =
         function (kind, parameters, options) {
  parameters = _.assign({},
    CodeGradX.State.prototype.sendMultiplyESServer.default,
    parameters);
  function retry (reason) {
    if ( parameters.attempts-- > 0 ) {
      sleep.sleep(parameters.step);
      return this.sendESServer(kind, options).then(null, retry);
    } else {
      throw reason;
    }
  }
  var promise = this.sendESServer(kind, options).then(null, retry);
  return promise;
};
CodeGradX.State.prototype.sendMultiplyESServer.default = {
    step: 3, // seconds
    attempts: 30,
    progress: function (i) {}          // future ???
};

// **************** User

CodeGradX.User = function (json) {
  _.assign(this, json);
};

CodeGradX.User.prototype.connection = function () {
  // check cookie then send credentials and get additional information
  // Also set current user
  var state = CodeGradX.getCurrentState();
  if ( state.currentUser ) {
    return state.currentUser;
  }
  function setCurrentUser (response) {

  }
  return state.checkServer('x').then(setCurrentUser);
};

CodeGradX.User.prototype.modify = function (fields, cb) {
  // send modifications then update local User
};

CodeGradX.User.prototype.campaigns = function (now, cb) {
  // get active campaigns if now otherwise get all campaigns
};

CodeGradX.User.prototype.campaign = function (name, cb) {
  // get information on a Campaign
};

// **************** Campaign

CodeGradX.Campaign = function (name) {
  this.name = name;
};

CodeGradX.Campaign.prototype.skills = function (cb) {
  // get skills of the students of this campaign
};

CodeGradX.Campaign.prototype.jobs = function (cb) {
  // get the jobs of the user within the campaign
};

CodeGradX.Campaign.prototype.exercises = function (cb) {
  // get the exercises of this campaign
};


// **************** Exercise

CodeGradX.Exercise = function (json) {
  // initialize name, nickname, url, summary, tags:
  _.assign(this, json);
};

CodeGradX.Exercise.prototype.description = function (cb) {
  // get metadata
};

CodeGradX.Exercise.prototype.stem = function (cb) {
  // get stem
};

CodeGradX.Exercise.prototype.newStringAnswer = function (cb) {
  // create an answer
};

CodeGradX.Exercise.prototype.newFileAnswer = function (cb) {
  // create an answer
};

// **************** ExercisesSet

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

// **************** abstract Answer

CodeGradX.Answer = function (exercise) {
  this.exercise = exercise;
};

CodeGradX.Answer.prototype.submit = function (cb) {
  // submit an answer (string or file) towards an exercise, returns a Job
};

// subclasses

CodeGradX.FileAnswer = function (exercise) {
  this.exercise = exercise;
};
CodeGradX.FileAnswer.prototype =
   Object.create(CodeGradX.Answer.prototype);
CodeGradX.FileAnswer.prototype.constructor =
   CodeGradX.FileAnswer;

CodeGradX.StringAnswer = function (exercise) {
  this.exercise = exercise;
};
CodeGradX.StringAnswer.prototype =
   Object.create(CodeGradX.Answer.prototype);
CodeGradX.StringAnswer.prototype.constructor =
   CodeGradX.StringAnswer;

// **************** Job

CodeGradX.Job = function (uuid) {
  this.uuid = uuid;
};

CodeGradX.Job.prototype.report = function (cb) {
  // get the grading report
};



}).call(this);

// end of codegradxlib.js
