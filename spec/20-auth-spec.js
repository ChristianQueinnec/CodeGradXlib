// Jasmine test for user authentication
// requires file ./auth-data.json with login and password (not under git!)

if ( typeof CodeGradX === 'undefined' ) {
  var CodeGradX = require('../codegradxlib.js');
}

var xml2js = require('xml2js').parseString;

describe('CodeGradX', function () {
  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  it('should send failing authentication request', function (done) {
    var state = new CodeGradX.State();
    function faildone (reason) {
      fail(reason);
      done();
    }
    var authData = require('./auth-data.json');
    var promise1 = state.checkServers('x');
    promise1.then(function (responses) {
      //console.log(state.servers.x);
      // At least one X server is available:
      expect(responses.length).toBeGreaterThan(0);
      var promise2 = state.sendAXServer('x', {
        path: '/direct/check',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        entity: authData
      }).then(function (response) {
        //console.log(response);
        expect(response.status.code).toBe(200);
        expect(response.headers['Set-Cookie']).toBeDefined();
        expect(response.entity.kind).toBe('authenticationAnswer');
        //console.log(state.currentCookie);
        expect(state.currentCookie).toBeDefined();
        expect(state.currentCookie.length).toBeGreaterThan(0);
        state.currentUser = new CodeGradX.User(response.entity);
        expect(state.currentUser.lastname).toBe('Nemo');
        expect(CodeGradX.getCurrentState()).toBe(state);
        var promise3 = state.sendAXServer('x', {
          path: '/',
          method: 'GET'
        }).then(function (response) {
          //console.log(response.raw.request._header);
          // Check that the received cookie is sent
          expect(response.raw.request._header).toMatch(/\r\nCookie: u=U/);
          expect(response.entity.kind).toBe('authenticationAnswer');
          done();
        });
      }, faildone);
    }, faildone);
  });

});
