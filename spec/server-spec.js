// Jasmine tests for servers availability related methods.

if ( typeof CodeGradX === 'undefined' ) {
  var CodeGradX = require('../codegradxlib.js');
}

describe('CodeGradX', function () {
  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  it('should create a State', function () {
    var state = new CodeGradX.State();
    expect(state).toBeDefined();
    expect(state instanceof CodeGradX.State).toBeTruthy();
    expect(state.servers.names).toContain('a');
  });

  it('should check running server A0', function (done) {
    var state = new CodeGradX.State();
    var promise = state.checkServer('a', 0);
    promise.then(function (response) {
      //console.log(response.entity);
      //console.log(state.servers.a);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(response.entity.kind).toBe('alive');
      done();
    });
  });

  it('should check new running server A1', function (done) {
    var state = new CodeGradX.State();
    var promise = state.checkServer('a', 1);
    promise.then(function (response) {
      //console.log(response.entity);
      //console.log(state.servers.a);
      expect(state.servers.a[1].enabled).toBeTruthy();
      expect(response.entity.kind).toBe('alive');
      done();
    });
  });

  it('should check new non running server A17', function (done) {
    var state = new CodeGradX.State();
    var promise = state.checkServer('a', 17);
    promise.then(function (response) {
      fail("should not happen!");
      done();
    }).catch(function (error) {
      //console.log(error);
      //console.log(state.servers.a);
      expect(state.servers.a[17].enabled).toBe(false);
      expect(state.servers.a[17].lastError).toBeTruthy();
      done();
    });
  });

  it('should check all server A', function (done) {
    var state = new CodeGradX.State();
    var promise = state.checkServers('a');
    promise.then(function (responses) {
      //console.log(responses);
      //console.log(state.servers.a);
      expect(responses.length).toBe(2);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeTruthy();
      expect(state.servers.a.next).toBe(2);
      done();
    });
  });

  it('should check all servers A, E, X and S', function (done) {
    var state = new CodeGradX.State();
    var promise = state.checkAllServers();
    promise.then(function (responses) {
      //console.log(responses);
      //console.log(state.servers);
      expect(responses.length).toBe(4);
      expect(state.servers.a[0].enabled).toBeTruthy();
      expect(state.servers.a[1].enabled).toBeTruthy();
      expect(state.servers.a.next).toBe(2);
      expect(state.servers.e[0].enabled).toBeTruthy();
      expect(state.servers.e[1].enabled).toBeTruthy();
      expect(state.servers.e.next).toBe(2);
      expect(state.servers.x[0].enabled).toBeTruthy();
      expect(state.servers.x.next).toBe(2);
      expect(state.servers.s[0].enabled).toBeTruthy();
      expect(state.servers.s[1].enabled).toBeTruthy();
      expect(state.servers.s.next).toBe(2);
      done();
    });
  });

});

// end of codegradx-spec.js
