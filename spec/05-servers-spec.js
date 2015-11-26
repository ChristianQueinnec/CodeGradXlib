// Jasmine tests for servers availability related methods.
// Here we test various kinds of unavailability with a fake UserAgent.

var CodeGradX = require('../codegradxlib.js');

var _    = require('lodash');
var when = require('when');
var rest = require('rest');
var interceptor = require('rest/interceptor');

describe('CodeGradX', function () {
  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  function initializer (state) {
    state.servers = {
      domain: '.localdomain',
      names: ['a', 'e', 'x', 's'],
      a: {
        next: 1,
        suffix: '/alive',
        0: {
        }
      },
      e: {
        next: 1,
        suffix: '/alive',
        0: {
        }
      },
      x: {
        next: 1,
        suffix: '/dbalive',
        0: {
        }
      },
      s: {
        next: 1,
        suffix: '/',
        0: {
        }
      }
    };
    return state;
  }

/** make_fakeUserAgent creates HttpResponses (with only a status code)
    as told by `history`. Once used, items in history are removed.
*/

  function make_fakeUserAgent (history) {
    var fakeUserAgent = function (options) {
      var state = CodeGradX.getCurrentState();
      var i = _.findIndex(history, { path: options.path });
      if ( i >= 0 ) {
        state.debug("fakeUserAgent request " + options.path);
        var item = history[i];
        history.splice(i, 1);
        return when({
          status: { code: item.status },
          headers: {}
        });
      } else {
        return when.reject("Unexpected URL " + options.path);
      }
    };
    return fakeUserAgent;
  }

  it('should create a State', function (done) {
    var state = new CodeGradX.State(initializer);
    expect(state).toBeDefined();
    expect(state instanceof CodeGradX.State).toBeTruthy();
    done();
  });

  it('checks A servers: a0 ok', function (done) {
    // since no A server is initially available, check a0 and a1.
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200,
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 400,
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.checkServers('a').then(function (descriptions) {
      expect(descriptions).toBe(state.servers.a);
      expect(descriptions[0].enabled).toBeTruthy();
      expect(descriptions[0].lastError).not.toBeDefined();
      expect(descriptions[1].enabled).toBeFalsy();
      done();
    }, faildone);
  });

  it('checks A servers: a0 and a1 ok', function (done) {
    // since no A server is initially available, check a0 and a1.
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200,
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 200,
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.checkServers('a').then(function (descriptions) {
      expect(descriptions).toBe(state.servers.a);
      expect(descriptions[0].enabled).toBeTruthy();
      expect(descriptions[0].lastError).not.toBeDefined();
      expect(descriptions[1].enabled).toBeTruthy();
      expect(descriptions[1].lastError).not.toBeDefined();
      expect(descriptions.next).toBe(2);
      done();
    }, faildone);
  });

  it('request an A server once only via a0', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200,
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 400,
      },
      { path: 'http://a0.localdomain/foobar',
        status: 201,
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foobar'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeFalsy();
      done();
    }, faildone);
  });

});
