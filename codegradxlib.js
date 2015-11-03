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

var useragent = rest.wrap(mime);

// **************** Global state

CodeGradX.State = function () {
    // State of servers:
    this.servers = {
      domain: '.paracamplus.com',
      names: ['a', 'e', 'x', 's']
    };
    this.servers.a = { next: 1,
                       suffix: '/alive',
                       0: { host: 'a0.paracamplus.com',
                            enabled: false } };
    this.servers.e = { next: 1,
                       suffix: '/alive',
                       0: { enabled: false } };
    this.servers.x = { next: 1,
                       suffix: '/dbalive',
                       0: { host: 'x.paracamplus.com',
                            enabled: false } };
    this.servers.s = { next: 1,
                       suffix: '/',
                       0: { enabled: false } };
    // Caches for Exercises, Jobs, Batches
    this.caches = {};
    // Current values
    this.currentUser = null;
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
  return useragent("http://" + host + descriptions.suffix)
    .then(updateDescription, invalidateDescription);
  };

CodeGradX.State.prototype.checkServers = function (kind) {
  var promise, promises = [];
  var descriptions = this.servers[kind];
  function incrementNext () {
    descriptions.next++;
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
  var promises = [];
  this.servers.names.forEach(function (kind) {
    promises.push(this.checkServers(kind));
  }, this);
  return when.all(promises);
};

// **************** User

CodeGradX.User = function (login, password) {
  this.login = login;
  this.password = password;
};

CodeGradX.User.prototype.connection = function () {
  // check cookie then send credentials and get additional information
  // set current user
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

CodeGradX.Exercise = function (uuid) {
  this.uuid = uuid;
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

CodeGradX.ExercisesSet = function (prologue, content, epilogue) {
  this.prologue = prologue;
  this.content = content;
  this.epilogue = epilogue;
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
