// Jasmine test to check progress
// requires file ./auth-data.json with login and password (not under git!)

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth1-data.json');      // lambda student
var _ = require('lodash');

describe('CodeGradX', function () {

  it('should be loaded', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    state.getAuthenticatedUser(authData.login, authData.password)
    .then(function (user) {
      expect(user).toBeDefined();
      expect(user).toBe(state.currentUser);
      done();
    }, faildone);
  });

  var campaign0;

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
        //console.log(campaign);//DEBUG
        campaign0 = campaign;
        campaign.getExercisesSet().then(function (es) {
          expect(es instanceof CodeGradX.ExercisesSet).toBeTruthy();
          expect(es).toBe(campaign.exercisesSet);
          done();
        }, faildone);
    }, faildone);
  });

  it("should get progress", function (done) {
      var state = CodeGradX.getCurrentState();
      function faildone (reason) {
          state.debug(reason).show();
          fail(reason);
          done();
      }
      expect(state.currentUser instanceof CodeGradX.User).toBeTruthy();
      state.currentUser.getProgress(campaign0).then(function (user) {
          expect(user.results.length).toBeGreaterThan(0);
          console.log(user.results);//DEBUG
          expect(user.results[0].name).toBe('com.paracamplus.li205.function.1');
          expect(user.results[0].nickname).toBe('min');
          expect(user.results[0].mark).toBe(1);
          expect(user.badges.length).toBe(0);
          done();
      }, faildone);
  }, 10*1000); // 10 seconds
    
});
