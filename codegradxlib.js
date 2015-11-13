/**
Javascript Library to interact with the CodeGradX infrastructure

@module codegradxlib
@author Christian Queinnec <Christian.Queinnec@codegradx.org>

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
  var registry = require('rest/mime/registry');
  var cookie = require('cookie');
  //var sleep = require('sleep');
  var xml2js = require('xml2js');
  //var formurlencoded = require('form-urlencoded');

  // Define that MIME type:
  registry.register('application/octet-stream', {
    read: function(str) {
        return str;
    },
    write: function(str) {
        return str;
    }
  });

  /* improvements
  * - name differently methods returning a Promise from others
  */

  // **************** log
  /* Constructor of log.
     This log only keeps the last 20 facts.
     See helper method on State to log facts.
  */

  CodeGradX.Log = function () {
    this.items = [];
    this.size = 20;
  };

  /** log some facts.

    @param {Value...} arguments - facts to record

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
      this.items = _.slice(this.items, 1, this.size);
    }
    this.items.push(msg);
    return this;
  };

  CodeGradX.Log.prototype.show = function () {
    console.log(this.items);
    return this;
  };

  // **************** Global state

  CodeGradX.State = function () {
    this.userAgent = rest.wrap(mime);
    this.log = new CodeGradX.Log();
    // State of servers:
    this.servers = {
      domain: '.paracamplus.com',
      names: ['a', 'e', 'x', 's'],
      a: {
        next: 2,
        suffix: '/alive',
        0: {
          host: 'a0.paracamplus.com',
          enabled: false
        },
        1: {
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
        next: 1,
        suffix: '/dbalive',
        0: {
          host: 'x.paracamplus.com',
          enabled: false
        }
      },
      s: {
        next: 1,
        suffix: '/',
        0: {
          enabled: false
        }
      }
    };
    // Current values
    this.currentUser = null;
    this.currentCookie = null;
    this.currentCampaign = null;
    // Make the state global
    var state = this;
    CodeGradX.getCurrentState = function () {
      return state;
    };
  };

  CodeGradX.getCurrentState = function () {
    throw new Error("noState");
  };

  CodeGradX.State.prototype.debug = function () {
    return this.log.debug.apply(this.log, arguments);
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

  Descriptions are kept in the global state.
  */

  CodeGradX.State.prototype.checkServer = function (kind, index) {
    var state = this;
    state.debug('checkServer1', kind, index);
    if ( ! state.servers[kind] ) {
      state.servers = {};
    }
    var descriptions = state.servers[kind];
    if ( ! descriptions[index] ) {
        descriptions[index] = { enabled: false };
    }
    var description = descriptions[index];
    var host = description.host || (kind + index + state.servers.domain);
    description.host = host;
    // Don't use that host while being checked:
    description.enabled = false;
    delete description.lastError;
    function updateDescription (response) {
      state.debug('updateDescription', description.host, response);
      description.enabled = (response.status.code === 200);
      return response;
    }
    function invalidateDescription (reason) {
      state.debug('invalidateDescription', description.host, reason);
      description.lastError = reason;
      throw reason;
    }
    var url = "http://" + host + descriptions.suffix;
    state.debug('checkServer2', kind, index, url);
    return state.userAgent(url)
      .then(updateDescription, invalidateDescription);
  };

    /** Check all possible servers of some kind (a, e, x or s) that is,
    update the state for those servers. If correctly programmed
    these checks are concurrently run.

    @param {string} kind - the kind of server (a, e, x or s)
    @returns {Promise}

    */

    CodeGradX.State.prototype.checkServers = function (kind) {
      var state = this;
      state.debug('checkServers', kind);
      var promise, promises = [];
      var descriptions = state.servers[kind];
      function incrementNext (response) {
        state.debug('incrementNext', response);
        if ( response.status.code === 200 ) {
          descriptions.next++;
        }
        return descriptions;
      }
      for ( var key in descriptions ) {
        if ( /^\d+$/.exec(key) ) {
          promise = state.checkServer(kind, key);
          promises.push(promise);
        }
      }
      function ignoreError (reason) {
        state.debug('ignoreError', reason);
      }
      // Try also the next potential server:
      promise = state.checkServer(kind, descriptions.next)
        .then(incrementNext, ignoreError);
      promises.push(promise);
      function returnDescriptions (results) {
        state.debug('returnDescriptions', results);
        return descriptions;
      }
      return when.settle(promises).catch(returnDescriptions);
    };

    /** Check all possible servers of all kinds (a, e, x or s) that is,
    update the state for all of those servers. If correctly programmed
    these checks are concurrently run.

    @returns {Promise}

    */

    CodeGradX.State.prototype.checkAllServers = function () {
      var state = this;
      state.debug('checkAllServers');
      var promises = _.map(this.servers.names, this.checkServers, this);
      return when.all(promises);
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
    @returns {Promise}

    */

    CodeGradX.State.prototype.sendAXServer = function (kind, options) {
      var state = this;
      state.debug('sendAXServer', kind, options);
      var newoptions = _.assign({}, options);
      newoptions.headers = newoptions.headers || {};
      if ( state.currentCookie ) {
        newoptions.headers.Cookie = state.currentCookie;
      }
      function updateCurrentCookie (response) {
        //console.log(response.headers);
        //console.log(response);
        state.debug('updateCurrentCookie', response);
        if ( response.headers['Set-Cookie'] ) {
          var cookies = response.headers['Set-Cookie'];
          cookies = _.map(cookies, function (s) {
            return s.replace(/;.*$/, '');
          });
          cookies = _.filter(cookies, function (s) {
            return /^u=U/.exec(s);
          });
          state.currentCookie = cookies;
        }
        return response;
      }
      function getActiveServers () {
        return _.filter(state.servers[kind], {enabled: true});
      }
      var descriptions = getActiveServers();
      state.debug('sendAXServer3', descriptions);
      function tryNext (reason) {
        state.debug('tryNext1', reason);
        if ( descriptions.length > 0 ) {
          var description = _.first(descriptions);
          descriptions = _.rest(descriptions);
          newoptions.path = 'http://' + description.host + options.path;
          state.debug('tryNext2', newoptions.path);
          return state.userAgent(newoptions).then(updateCurrentCookie, tryNext);
        } else {
          throw reason;
        }
      }
      function allTried (reason) {
        state.debug('allTried', reason);
        throw reason;
      }
      if ( descriptions.length === 0 ) {
        // Determine available servers if not yet done:
        return state.checkServers(kind).then(function (responses) {
          state.debug('sendAXServer2', responses);
          var descriptions2 = getActiveServers();
          if ( descriptions2.length === 0 ) {
            throw new Error('no available server ' + kind);
          } else {
            descriptions = descriptions2;
            return tryNext('go');
          }
        }, allTried);
      } else {
        return tryNext('go');
      }
    };

    /** Ask once an E or S server.
    Send request concurrently to all available servers. The fastest wins.

    @param {string} kind - the kind of server (e or s)
    @param {object} options - description of the HTTP request to send
    @property {string} woptions.path
    @property {string} options.method
    @property {object} options.headers - for instance Accept, Content-Type
    @property {object} options.entity - string or object depending on Content-Type
    @returns {Promise}

    */

    CodeGradX.State.prototype.sendESServer = function (kind, options) {
      var state = this;
      state.debug('sendESServer1', kind, options);
      var newoptions = _.assign({}, options);
      newoptions.headers = _.assign({}, options.headers);
      if ( state.currentCookie ) {
        newoptions.headers.Cookie = state.currentCookie;
      }
      function getActiveServers () {
        return _.filter(state.servers[kind], {enabled: true});
      }
      var descriptions = getActiveServers();
      function reportThen (response) {
        state.debug('reportThen', response);
        return response;
      }
      function reportElse (reason) {
        state.debug('reportElse', reason);
        throw reason;
      }
      function trySending (description) {
        state.debug('trySending', description);
        var tryoptions = _.assign({}, newoptions);
        tryoptions.path = 'http://' + description.host + options.path;
        //console.log('sending to ' + newoptions.path);
        return state.userAgent(tryoptions).then(reportThen, reportElse);
      }
      function allTried (reason) {
        state.debug('allTried', reason);
        throw reason;
      }
      if ( descriptions.length === 0 ) {
        return state.checkServers(kind).then(function (responses) {
          var descriptions2 = getActiveServers();
          if ( descriptions2.length === 0 ) {
            throw new Error("no available server " + kind);
          } else {
            state.debug('sendESServer2',  descriptions2);
            var promises = _.map(descriptions2, trySending);
            return when.any(promises);
          }
        }, allTried);
      } else {
        var promises = _.map(descriptions, trySending);
        return when.any(promises);
      }
    };

    /** Ask repeatedly an E or S server.
    Send request to all available servers and repeat in case of problems.

    @param {Object} parameters -
    @property {number} parameters.step - seconds between each attempt
    @property {number} parameters.attempts - at most n attempts
    @property {function} parameters.progress -

    The `progress` function (parameters) {} is invoked before each attempt.
    By default, `parameters` is initialized with
    CodeGradX.State.prototype.sendRepeatedlyESServer.default

  Nota: what become the other promises not selected by when.any ? Do they
  continue to run ? This might be a problem for sendRepeatedlyESServer ???
  */

  CodeGradX.State.prototype.sendRepeatedlyESServer =
  function (kind, parameters, options) {
    var state = this;
    state.debug('sendRepeatedlyESServer', kind, parameters, options);
    parameters = _.assign({ i: 0 },
      CodeGradX.State.prototype.sendRepeatedlyESServer.default,
      parameters);
    var dt = parameters.step * 1000;
    function retryNext () {
      state.debug("retryNext", parameters);
      if ( parameters.i++ < parameters.attempts ) {
      var promise = state.sendESServer(kind, options).then(function (response) {
        if ( response.status.code !== 200 ) {
          return when.reject(new Error(response.status.code));
        } else {
          return when(response);
        }
      });
      var delayedPromise = when(null).delay(dt).then(retryNext);
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

    @param {string} login
    @param {string} password
    @returns {Promise}

    */

    CodeGradX.State.prototype.getAuthenticatedUser =
    function (login, password) {
      var state = this;
      state.debug('getAuthenticatedUser1', login);
      var promise = state.sendAXServer('x', {
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
        return state.currentUser;
      });
      return promise;
    };

    // **************** User

    /** @class {User}
    Represents a User.

    @property {string} lastname
    @property {string} firstname
    @property {string} email
    @property {number} personid
    @property {Array[Campaign]} campaigns
    ...

    */

    CodeGradX.User = function (json) {
      _.assign(this, json);
      this.campaigns = _.map(json.campaigns, function (js) {
        return new CodeGradX.Campaign(js);
      });
    };

    /** Modify some properties of the current user. These properties are

      @param {object} fields
      @property {string} fields.lastname
      @property {string} fields.firstname
      @property {string} fields.pseudo
      @property {string} fields.email
      @property {string} fields.password

    It is not possible to change user's login.

    */

    CodeGradX.User.prototype.modify = function (fields) {
      // send modifications then update local User
      var state = CodeGradX.getCurrentState();
      return state.sendAXServer('x', fields).then(function (user) {
        _.assign(state.currentUser, user);
      });
    };

    CodeGradX.User.prototype.getCampaigns = function (now) {
      // get active campaigns if now otherwise get all campaigns
      if ( now ) {
        var activeCampaigns = _.filter(this.campaigns, function (campaign) {
          var now = new Date().getTime();
          return ( campaign.starttime <= now) && ( now <= campaign.endtime );
        });
        return activeCampaigns;
      } else {
        return this.campaigns;
      }
    };

    /** Return a specific Campaign.
        It looks for a named campaign among the campaigns the user is part of.

        @param {String} name - name of the Campaign to find
        @returns {Promise{Campaign}}

    */

    CodeGradX.User.prototype.getCampaign = function (name) {
      // get information on a Campaign
      var state = CodeGradX.getCurrentState();
      state.debug('getCampaign', name);
      var campaign = _.find(this.campaigns, {name: name});
      if ( campaign ) {
        state.currentCampaign = campaign;
        return when(campaign);
      } else {
        return when.reject(new Error("No such campaign " + name));
      }
    };

    // **************** Campaign
    /** A campaign describes a set of exercises for a given group of
    students and a given group of teachers for a period of time. These
    groups of persons are not public.

      @property {string} name
      @property {Date} starttime
      @property {Date} endtime
      @property {string} exercisesname
      @property {ExerciseSet} exercises (filled by getExercises)

    */

    CodeGradX.Campaign = function (json) {
      // initialize name, starttime, endtime
      _.assign(this, json);
    };

    CodeGradX.Campaign.prototype.skills = function () {
      // get skills of the anonymous students of this campaign
    };

    CodeGradX.Campaign.prototype.jobs = function (user) {
      // get the jobs of the user (by default the currentUser)
      // within the campaign
    };

    /** Get the (tree-shaped) set of exercises of a campaign.

      @return {Promise{ExercisesSet}}

    */

    CodeGradX.Campaign.prototype.getExercisesSet = function () {
      // get the exercises of this campaign
      var state = CodeGradX.getCurrentState();
      var campaign = this;
      state.debug('getExercises1', campaign);
      if ( this.exercises ) {
        return when(this.exercises);
      }
      return state.sendESServer('e', {
        path: ('/path/' + (campaign.exercisesname || campaign.name)),
        method: 'GET',
        headers: {
          Accept: "application/json"
        }
      }).then(function (response) {
        state.debug('getExercises2', response);
        campaign.exercisesSet = new CodeGradX.ExercisesSet(response.entity);
        return when(campaign.exercisesSet);
      });
    };


    CodeGradX.Campaign.prototype.getExercise = function (name) {
      // get information on an Exercise
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

    // **************** Exercise
    /** Constructor of an Exercise.
      When extracted from a Campaign, an Exercise looks like:

    { name: 'org.fw4ex.li101.croissante.0',
      nickname: 'croissante',
      safecookie: 'UhSn..3nyUSQWNtqwm_c6w@@',
      summary: 'Déterminer si une liste est croissante',
      tags: [ 'li101', 'scheme', 'fonction' ] }

    This information is sufficient to list the exercises with a short
    description of their stem.

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

       @returns {Promise{ExerciseDescription}}

       */

    CodeGradX.Exercise.prototype.getDescription = function () {
      // get metadata
      var exercise = this;
      var state = CodeGradX.getCurrentState();
      state.debug('getDescription1', exercise);
      if ( exercise.description ) {
        return when(exercise.description);
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
        exercise.XMLdescription = response.entity;
        function parseXML (description) {
          state.debug('getDescription2b', description);
          exercise.description = description;
          return when(description);
        }
        return CodeGradX.parsexml(exercise.XMLdescription).then(parseXML);
      });
      var promise2 = promise.then(function (response) {
        // Extract authors
        state.debug("getDescription3", response);
        var authorshipRegExp = new RegExp("^(.|\n)*(<authorship>(.|\n)*</authorship>)(.|\n)*$");
        var authorship = response.entity.replace(authorshipRegExp, "$2");
        return CodeGradX.parsexml(authorship).then(function (result) {
          state.debug("getDescription3a", result);
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
        exercise.XMLstem = content;
        exercise.stem = CodeGradX.xml2html(content);
        return when(response);
      });
      var promise4 = promise.then(function (response) {
        // If only one question expecting one file, retrieve its name:
        state.debug('getDescription5');
        var expectationsRegExp = new RegExp("<expectations>(.|\n)*</expectations>", "g");
        function concat (s1, s2) {
          return s1 + s2;
        }
        var expectations =
          '<div>' +
          _.reduce(response.entity.match(expectationsRegExp), concat) +
          '</div>';
        return CodeGradX.parsexml(expectations).then(function (result) {
          state.debug('getDescription5a');
          if (result.div.expectations ) {
            //console.log(result.div.expectations);
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
        var parser = new xml2js.Parser({
          explicitArray: false,
          trim: true
        });
        var xerr, xresult;
        parser.parseString(xml, function (err, result) {
            xerr = err;
            xresult = result;
        });
        if ( xerr ) {
          return when.reject(xerr);
        } else {
          return when(xresult);
        }
    };

    /** Send a string as the proposed solution to an Exercise.

      @param {string} answer
      @returns {Promise{Job}}

    */

    CodeGradX.Exercise.prototype.sendStringAnswer = function (answer) {
      // send an answer
      var exercise = this;
      var state = CodeGradX.getCurrentState();
      state.debug('sendStringAnswer1', answer);
      if ( typeof exercise.inlineFileName === 'undefined') {
        return when.reject(new Error("Non suitable exercise"));
      }
      return state.sendAXServer('a', {
        path: ('/exercise/' + exercise.safecookie + '/job'),
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": ("inline; filename=" + exercise.inlineFileName),
          "Accept": 'text/xml'
        },
        entity: answer
      }).then(function (response) {
        //console.log(response);
        state.debug('sendStringAnswer2', response);
        return CodeGradX.parsexml(response.entity).then(function (js) {
          //console.log(js);
          state.debug('sendStringAnswer3', js);
          js = js.fw4ex.jobSubmittedReport;
          exercise.uuid = js.exercise.$.exerciseid;
          return new CodeGradX.Job({
            exercise: exercise,
            content: answer,
            responseXML: response.entity,
            response: js,
            personid: js.person.$.personid,
            archived: js.job.$.archived,
            jobid: js.job.$.jobid,
            pathdir: js.$.location
          });
        });
      });
    };

    /** Send the content of a file as the proposed solution to an Exercise.

      @param {string} filename
      @returns {Promise{Job}}

    */

    CodeGradX.Exercise.prototype.sendFileAnswer = function (filename) {
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

/** Find an exercise by its name in a tree of Exercises.

  @param {String} name
  @returns {Exercise}
  */

CodeGradX.ExercisesSet.prototype.getExercise = function (name) {
  var exercises = this;
  function find (exercises) {
    if ( _.isArray(exercises) ) {
      for ( var i=0 ; i<exercises.length ; i++ ) {
        //console.log("explore " + i);
        var result = find(exercises[i]);
        if ( result ) {
          return result;
        }
      }
    } else if ( exercises instanceof CodeGradX.ExercisesSet ) {
      return find(exercises.exercises);
    } else if ( exercises instanceof CodeGradX.Exercise ) {
      //console.log("compare " + exercises.name);
      if ( exercises.name === name ) {
        return exercises;
      } else {
        return false;
      }
    }
  }
  return find(exercises);
};

// **************** abstract Job

/**
<jobStudentReport jobid="775F47E8-8988-11E5-9328-B68770A06C90">
<marking archived="2015-11-12T21:58:11"
    started="2015-11-12T21:58:24Z"
    ended="2015-11-12T21:58:24Z"
    finished="2015-11-12T21:58:25"
    mark="0"
    totalMark="1">
  <machine nickname="Debian 4.0r3 32bit" version="1"/>
  <exercise exerciseid="11111111-1111-1111-2232-000000130002"/>
  <partialMark name="Q1" mark="0"/>
</marking>
<report> ...
*/

CodeGradX.Job = function (js) {
  _.assign(this, js);
};

/** get the marking report of that Job.

  @param {Object} parameters - for repetition see sendRepeatedlyESServer.default
  @returns {Promise{Job}}

  */

CodeGradX.Job.prototype.getReport = function (parameters) {
  // get the marking report
  parameters = parameters || {};
  var job = this;
  var state = CodeGradX.getCurrentState();
  state.debug('getReport1', job);
  if ( job.report ) {
    return when(job.report);
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
    state.debug('getReport2', job);
    job.XMLreport = response.entity;
    return when(job);
  });
  var promise2 = promise.then(function (response) {
    // Fill archived, started, ended, finished, mark and totalMark
    state.debug('getReport3', job);
    var markingRegExp = new RegExp("^(.|\n)*(<marking (.|\n)*?>)(.|\n)*$");
    var marking = response.entity.replace(markingRegExp, "$2");
    marking = marking.replace(/>/, "/>");
    //console.log(marking);
    return CodeGradX.parsexml(marking).then(function (js) {
      //console.log(js);
      _.assign(job, js.marking.$);
      return when(response);
    });
  });
  var promise3 = promise.then(function (response) {
    // Fill exerciseid (already in exercise.uuid !)
    state.debug('getReport4', job);
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
    state.debug('getReport6');
    var contentRegExp = new RegExp("^(.|\n)*(<content>(.|\n)*?</content>)(.|\n)*$");
    var content = response.entity.replace(contentRegExp, "$2");
    job.report = CodeGradX.xml2html(content);
  });
  return when.join(promise2, promise3, promise4).then(function (values) {
    state.debug('getReport5', job);
    //console.log(job);
    return promise1;
  });
};

/** Conversion of texts (stems, reports) from XML to HTML.
 This function may be modified.
*/

CodeGradX.xml2html = function (s) {
  return s;
};

}).call(this);

// end of codegradxlib.js
