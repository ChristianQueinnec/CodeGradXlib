// Jasmine tests for public interactions

var CodeGradX = require('../codegradxlib.js');
var xml2js = require('xml2js').parseString;

describe('CodeGradX', function () {

  it('should be loaded', function () {
    expect(CodeGradX).toBeDefined();
  });

  function make_faildone (done) {
        return function faildone (reason) {
            agent.state.debug(reason).show();
            //console.log(reason);
            fail(reason);
            done();
        };
    }

  it("cannot authenticate with wrong password", function (done) {
      var state = new CodeGradX.State();
      var faildone = make_faildone(done);
      state.getAuthenticatedUser('nobody:0', 'totallyWrong').then(
          function (user) {
              console.log(user);
              faildone();
          }, function (reason) {
              expect(reason).toBeDefined();
              done();
          });
  });

});
