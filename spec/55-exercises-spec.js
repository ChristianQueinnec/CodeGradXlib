// Jasmine test to check getting exercises.json

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth-data.json');

describe('CodeGradX', function () {

    function make_faildone (done) {
        return function faildone (reason) {
            var state = CodeGradX.getCurrentState();
            state.debug('faildone', reason).show();
            //console.log(reason);
            fail(reason);
            done();
        };
    }

    it('should be loaded', function (done) {
        expect(CodeGradX).toBeDefined();
        var state = new CodeGradX.State();
        var faildone = make_faildone(done);
        state.getAuthenticatedUser(authData.login, authData.password)
            .then(function (user) {
                expect(user).toBeDefined();
                expect(user).toBe(state.currentUser);
                done();
            }, faildone);
    });

  it("should get all campaigns", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(state.currentUser instanceof CodeGradX.User).toBeTruthy();
    state.currentUser.getCampaign('insta2-2016oct').then(function (campaign) {
        expect(campaign).toBeDefined();
        //console.log(campaign);//
        campaign.getExercise('org.codegradx.js.gfilter.1')
            .then(function (exercise) {
                expect(exercise).toBeDefined();
                campaign.getExercisesSet()
                    .then(console.log);
                done();
            }).catch(faildone);
    }).catch(faildone);
  });

});
    
 
