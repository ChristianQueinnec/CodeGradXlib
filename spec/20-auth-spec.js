// Jasmine test for user authentication

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
    var promise1 = state.checkServers('x');
    promise1.then(function (responses) {
      //console.log(state.servers.x);
      // At least one X server is available:
      expect(responses.length).toBeGreaterThan(0);
      var promise2 = state.sendAXServer('x', {
        path: '/direct/check',
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/xml',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        entity: {
          login: 'foo',
          password: 'xyzzy'
        }
      }).then(function (response) {
        //console.log(response);
        expect(response.status.code).toBe(400);
        // set currentUser...
        done();
      }, faildone);
    }, faildone);
  });

});
