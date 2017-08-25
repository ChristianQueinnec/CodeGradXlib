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

  function make_faildone (done) {
    return function faildone (reason) {
      var state = CodeGradX.getCurrentState();
      state.debug(reason).show();
      fail(reason);
      done();
    };
  }

  function initializer (state) {
    state.servers = {
      domain: '.localdomain',
      names: ['a', 'e', 'x', 's'],
      protocol: 'http',
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
        protocol: 'https',
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
        if ( item.status > 0 ) {
          var js = {
              status: { code: item.status },
              headers: {}
          };
          state.debug("fakeUserAgent response " + item.status);
          return when(js).delay(100 * Math.random());
        } else {
          return when.reject("Non responding server " + options.path);
        }
      } else {
        // History was probably incomplete:
        return when.reject("Unexpected URL " + options.path);
      }
    };
    CodeGradX.getCurrentState().log = new CodeGradX.Log();
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
    var faildone = make_faildone(done);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 400
      }
    ]);
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
    var faildone = make_faildone(done);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 200
      }
    ]);
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

  it('request an A server once via a0', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 400
      },
      { path: 'http://a0.localdomain/foobar',
        status: 201
      }
    ]);
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

  it('request an A server twice via a0 while a1 ko', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 0
      },
      { path: 'http://a0.localdomain/foo',
        status: 201
      },
      { path: 'http://a0.localdomain/bar',
        status: 202
      }
    ]);
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeFalsy();
      state.sendAXServer('a', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(202);
        expect(state.servers.a[0].enabled).toBeTruthy();
        expect(state.servers.a[1].enabled).toBeFalsy();
        done();
      }, faildone);
    }, faildone);
  });

  it('request an A server twice via a0 while a1 ok', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 200
      },
      { path: 'http://a0.localdomain/foo',
        status: 201
      },
      { path: 'http://a0.localdomain/bar',
        status: 202
      }
    ]);
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeTruthy();
      state.sendAXServer('a', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(202);
        expect(state.servers.a[0].enabled).toBeTruthy();
        expect(state.servers.a[1].enabled).toBeTruthy();
        done();
      }, faildone);
    }, faildone);
  });

  it('request an A server twice via a0 then a1 (always ok)', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.log.size = 50;
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 200
      },
      // 1st request: ok
      { path: 'http://a0.localdomain/foo',
        status: 201
      },
      // 2nd request: ko since a0 subitly failed!
      { path: 'http://a0.localdomain/bar',
        status: 0
      },
      // checkServers('a') again: a0 still ko
      { path: 'http://a0.localdomain/alive',
        status: 402
      },
      // checkServers('a') again, a1 now ok
      { path: 'http://a1.localdomain/alive',
        status: 202
      },
      // 2nd request again: ok
      { path: 'http://a1.localdomain/bar',
        status: 203
      }
    ]);
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeTruthy();
      state.sendAXServer('a', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(203);
        expect(state.servers.a[1].enabled).toBeTruthy();
        expect(state.servers.a[0].enabled).toBeFalsy();
        done();
      }, faildone);
    }, faildone);
  });

  it('request an A server twice via a0 then a1 (resurrecting)', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.log.size = 50;
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 0
      },
      // 1st request: ok
      { path: 'http://a0.localdomain/foo',
        status: 201
      },
      // 2nd request: ko since a0 subitly failed!
      { path: 'http://a0.localdomain/bar',
        status: 0
      },
      // checkServers('a') again: a0 still ko
      { path: 'https://a0.localdomain/alive',
        status: 402
      },
      // checkServers('a') again, a1 now ok
      { path: 'https://a1.localdomain/alive',
        status: 202
      },
      // 2nd request again: ok
      { path: 'https://a1.localdomain/bar',
        status: 203
      }
    ]);
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeFalsy();
      state.sendAXServer('a', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(203);
        expect(state.servers.a[1].enabled).toBeTruthy();
        expect(state.servers.a[0].enabled).toBeFalsy();
        done();
      }, faildone);
    }, faildone);
  });

  it('request an A server twice via a0 then a1 dying', function (done) {
    // since no A server is initially available, this will force a
    // checkServers('a') which in turn will trigger checkServer('a', 0)
    // and checkServer('a', 1).
    var state = new CodeGradX.State(initializer);
    var faildone = make_faildone(done);
    state.log.size = 50;
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://a0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://a1.localdomain/alive',
        status: 0
      },
      // 1st request: ok
      { path: 'http://a0.localdomain/foo',
        status: 201
      },
      // 2nd request: ko since a0 subitly failed!
      { path: 'http://a0.localdomain/bar',
        status: 0
      },
      // checkServers('a') again: a0 still ko
      { path: 'http://a0.localdomain/alive',
        status: 402
      },
      // checkServers('a') again, a1 now ok
      { path: 'https://a1.localdomain/alive',
        status: 202
      },
      // 2nd request again, now towards a1: ok
      { path: 'https://a1.localdomain/bar',
        status: 203
      },
      // 3rd request again: ko
      { path: 'https://a1.localdomain/hux',
        status: 0
      },
      // checkServers('a') again: a0 still ko
      { path: 'http://a0.localdomain/alive',
        status: 0
      },
      // checkServers('a') again, a1 still ko
      { path: 'http://a1.localdomain/alive',
        status: 404
      }
    ]);
    expect(state).toBeDefined();
    state.sendAXServer('a', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeFalsy();
      return state.sendAXServer('a', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(203);
        expect(state.servers.a[1].enabled).toBeTruthy();
        expect(state.servers.a[0].enabled).toBeFalsy();
        return state.sendAXServer('a', {
          path: '/hux'
        }).then(function (response3) {
          faildone("should not answer");
        }).catch(function (reason) {
          // all servers unavailable
          expect(state.servers.a[0].enabled).toBeFalsy();
          expect(state.servers.a[1].enabled).toBeFalsy();
          //console.log(reason);
          //state.log.show();
          done();
        });
      }, faildone);
    }, faildone);
  });

});
