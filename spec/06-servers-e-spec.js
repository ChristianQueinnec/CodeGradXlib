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
      names: ['e', 'e', 'x', 's'],
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
        if ( item.status > 0 ) {
          return when({
            status: { code: item.status },
            headers: {}
          }).delay(100 * Math.random());
        } else {
          return when.reject("Non responding server " + options.path);
        }
      } else {
        // History was probably incomplete:
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

  it('checks E servers: e0 ok', function (done) {
    // since no E server is initially available, check a0 and a1.
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 400
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.checkServers('e').then(function (descriptions) {
      expect(descriptions).toBe(state.servers.e);
      expect(descriptions[0].enabled).toBeTruthy();
      expect(descriptions[0].lastError).not.toBeDefined();
      expect(descriptions[1].enabled).toBeFalsy();
      done();
    }, faildone);
  });

  it('checks E servers: only e0 ok', function (done) {
    // since no E server is initially available, check a0 and a1.
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 0
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.checkServers('e').then(function (descriptions) {
      expect(descriptions).toBe(state.servers.e);
      expect(descriptions[0].enabled).toBeTruthy();
      expect(descriptions[0].lastError).not.toBeDefined();
      expect(descriptions[1].enabled).toBeFalsy();
      done();
    }, faildone);
  });

  it('checks E servers: e0 and e1 ok', function (done) {
    // since no E server is initially available, check a0 and a1.
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 200
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.checkServers('e').then(function (descriptions) {
      expect(descriptions).toBe(state.servers.e);
      expect(descriptions[0].enabled).toBeTruthy();
      expect(descriptions[0].lastError).not.toBeDefined();
      expect(descriptions[1].enabled).toBeTruthy();
      expect(descriptions[1].lastError).not.toBeDefined();
      expect(descriptions.next).toBe(2);
      done();
    }, faildone);
  });

  it('request an E server once via e0', function (done) {
    // since no E server is initially available, this will force a
    // checkServers('e') which in turn will trigger checkServer('e', 0)
    // and checkServer('e', 1).
    var state = new CodeGradX.State(initializer);
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('a', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('a', 1)
      { path: 'http://e1.localdomain/alive',
        status: 0
      },
      { path: 'http://e0.localdomain/foobar',
        status: 201
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('e', {
      path: '/foobar'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeFalsy();
      done();
    }, faildone);
  });

  it('request an E server twice via e0 while e1 ko', function (done) {
    // since no E server is initially available, this will force a
    // checkServers('e') which in turn will trigger checkServer('e', 0)
    // and checkServer('e', 1).
    var state = new CodeGradX.State(initializer);
    var history = [
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 0
      },
      { path: 'http://e0.localdomain/foo',
        status: 201
      },
      { path: 'http://e0.localdomain/bar',
        status: 202
      }
    ];
    state.userAgent = make_fakeUserAgent(history);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('e', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeFalsy();
      state.sendAXServer('e', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(202);
        expect(state.servers.e[0].enabled).toBeTruthy();
        expect(state.servers.e[1].enabled).toBeFalsy();
        expect(history.length).toBe(0);
        done();
      }, faildone);
    }, faildone);
  });

  it('request an E server twice via e0 while e1 becomes ok', function (done) {
    // since no E server is initially available, this will force a
    // checkServers('e') which in turn will trigger checkServer('e', 0)
    // and checkServer('e', 1).
    var state = new CodeGradX.State(initializer);
    var history = [
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 200
      },
      { path: 'http://e0.localdomain/foo',
        status: 201
      },
      { path: 'http://e0.localdomain/bar',
        status: 202
      },
      // Cannot be used:
      { path: 'http://e1.localdomain/bar',
        status: 203
      }
    ];
    state.userAgent = make_fakeUserAgent(history);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('e', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeTruthy();
      state.sendAXServer('e', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(202);
        expect(state.servers.e[0].enabled).toBeTruthy();
        expect(state.servers.e[1].enabled).toBeTruthy();
        expect(history.length).toBe(1);
        done();
      }, faildone);
    }, faildone);
  });

  it('request an E server twice via e0 and e1 (always ok)', function (done) {
    // since no E server is initially available, this will force a
    // checkServers('e') which in turn will trigger checkServer('e', 0)
    // and checkServer('e', 1).
    var state = new CodeGradX.State(initializer);
    state.log.size = 50;
    var history = [
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 200
      },
      // 1st request: ok
      { path: 'http://e0.localdomain/foo',
        status: 201
      },
      // 1st request: ok
      { path: 'http://e1.localdomain/foo',
        status: 201
      },
      // 2nd request: ko since e0 subitly failed!
      { path: 'http://e0.localdomain/bar',
        status: 0
      },
      // 2nd request: ok
      { path: 'http://e1.localdomain/bar',
        status: 212
      }
    ];
    state.userAgent = make_fakeUserAgent(history);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('e', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeTruthy();
      state.sendAXServer('e', {
        path: '/bar'
      }).then(function (response2) {
        expect(response2.status.code).toBe(212);
        expect(state.servers.e[1].enabled).toBeTruthy();
        expect(state.servers.e[0].enabled).toBeFalsy();
        //console.log(history);
        // Promise requesting http://e1.localdomain/foo may not be completed:
        expect(history.length).toBeLessThan(2);
        done();
      }, faildone);
    }, faildone);
  });

  it('request an E server twice via e0 ', function (done) {
    // since no E server is initially available, this will force a
    // checkServers('e') which in turn will trigger checkServer('e', 0)
    // and checkServer('e', 1).
    var state = new CodeGradX.State(initializer);
    state.log.size = 50;
    state.userAgent = make_fakeUserAgent([
      // implicit via checkServer('e', 0)
      { path: 'http://e0.localdomain/alive',
        status: 200
      },
      // implicit via checkServer('e', 1)
      { path: 'http://e1.localdomain/alive',
        status: 200
      },
      // 1st request: ok
      { path: 'http://e0.localdomain/foo',
        status: 201
      },
      // 2nd request: ko since e0 subitly failed!
      { path: 'http://e0.localdomain/bar',
        status: 0
      },
      // 2nd request: ko since e1 also subitly failed!
      { path: 'http://e1.localdomain/bar',
        status: 0
      },
      // checkServers('e') again: e0 still ko
      { path: 'http://e0.localdomain/alive',
        status: 402
      },
      // checkServers('e') again, e1 now ok
      { path: 'http://e1.localdomain/alive',
        status: 0
      }
    ]);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state).toBeDefined();
    state.sendAXServer('e', {
      path: '/foo'
    }).then(function (response) {
      expect(response.status.code).toBe(201);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeTruthy();
      state.sendAXServer('e', {
        path: '/bar'
      }).then(function (response2) {
        faildone();
      }, function (reason) {
        done();
      });
    }, faildone);
  });


});
