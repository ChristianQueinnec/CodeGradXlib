// Jasmine tests for user authentication

if ( typeof CodeGradX === 'undefined' ) {
  var CodeGradX = require('../codegradxlib.js');
}

describe('CodeGradX', function () {
  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  it('should send authentication request', function (done) {
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

  it('should get list of exercises', function (done) {
    var state = new CodeGradX.State();
    function faildone (reason) {
      fail(reason);
      done();
    }
    var promise1 = state.checkServers('e');
    promise1.then(function (responses) {
      expect(responses.length).toBeGreaterThan(0);
      var promise2 = state.sendESServer('e', {
        path: '/path/insta2',
        headers: {
          'Accept': 'application/json, text/xml'
        }
      }).then(function (response) {
        //console.log(response);
        expect(response.status.code).toBe(200);
        var es = new CodeGradX.ExercisesSet(response.entity);
        expect(es).toBeDefined();
        //console.log(es);
        expect(es.title).not.toBeDefined();
        expect(es.exercises.length).toBeGreaterThan(1);
        //console.log(es.exercises[0]);
        expect(es.exercises[0].title).toBe('Javascript');
        expect(es.exercises[0].exercises[0].nickname).toBe('min3');
        done();
      });
    });
  });


});
