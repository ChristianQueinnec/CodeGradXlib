// Jasmine test to check history
// requires file ./auth-data.json with login and password (not under git!)

if ( typeof CodeGradX === 'undefined' ) {
  var CodeGradX = require('../codegradxlib.js');
}

var xml2js = require('xml2js').parseString;

describe('CodeGradX', function () {

  it('should be loaded', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    var authData = require('./auth-data.json');
    state.getAuthenticatedUser(authData.login, authData.password)
    .then(function (user) {
      expect(user).toBeDefined();
      expect(user).toBe(state.currentUser);
      done();
    }, faildone);
  });

  it("should get campaign free", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentUser instanceof CodeGradX.User).toBeTruthy();
    state.currentUser.getCampaign('free').then(function (campaign) {
      expect(campaign instanceof CodeGradX.Campaign).toBeTruthy();
        expect(campaign).toBe(state.currentCampaign);
        //console.log(campaign);
        campaign.getExercisesSet().then(function (es) {
          expect(es instanceof CodeGradX.ExercisesSet).toBeTruthy();
          expect(es).toBe(campaign.exercisesSet);
          done();
        }, faildone);
    }, faildone);
  });

  it("should get history", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentCampaign instanceof CodeGradX.Campaign).toBeTruthy();
    state.currentCampaign.getJobs().then(function (jobs) {
      console.log(jobs);
      expect(jobs.length).toBeGreaterThan(2);
      done();
    }, faildone);
  }, 10*1000); // 10 seconds

});
