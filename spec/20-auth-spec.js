// Jasmine test for user authentication
// requires file ./auth-data.json with login and password (not under git!)
// Don't copy code from this, this is not the regular usage of the library.
// This file was more used as a test and experiment code.

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth1-data.json');     // lambda student

describe('CodeGradX', function () {
  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  it('should send authentication request', function (done) {
    var state = new CodeGradX.State();
    function faildone (reason) {
      state.debug('faildone', reason).show();
      fail(reason);
      done();
    }
    state.sendAXServer('x', {
      path: '/direct/check',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      entity: authData
    }).then(function (response) {
      //console.log(response);
      expect(response.status).toBeDefined();
      expect(response.status.code).toBe(200);
      expect(response.headers['Set-Cookie']).toBeDefined();
      expect(response.entity.kind).toBe('authenticationAnswer');
      //console.log(state.currentCookie);
      expect(state.currentCookie).toBeDefined();
      expect(state.currentCookie.length).toBeGreaterThan(0);
      state.currentUser = new CodeGradX.User(response.entity);
      expect(state.currentUser.lastname).toBe('FW4EX');
      expect(CodeGradX.getCurrentState()).toBe(state);
      state.sendAXServer('x', {
        path: '/',
        method: 'GET'
      }).then(function (response) {
        //console.log(response);
        // Check that the received cookie is sent
        expect(response.raw.request._header).toMatch(/\r\nCookie: u=U/);
        expect(response.entity.kind).toBe('authenticationAnswer');
        done();
      }, faildone);
    }, faildone);
  }, 10*1000); // 10 seconds

  it('again with getAuthenticatedUser', function (done) {
    var state = new CodeGradX.State();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    state.getAuthenticatedUser(authData.login, authData.password)
    .then(function (user) {
      //console.log(user);
      expect(user).toBeDefined();
      expect(user.lastname).toBe('FW4EX');
      expect(user).toBe(state.currentUser);
      done();
    }, faildone);
  });

});
