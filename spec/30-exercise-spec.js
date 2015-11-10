// Jasmine test to discover exercises
// requires file ./auth-data.json with login and password (not under git!)

if ( typeof CodeGradX === 'undefined' ) {
  var CodeGradX = require('../codegradxlib.js');
}

var xml2js = require('xml2js').parseString;

function hackForVMauthor (state) {
  state.servers = {
    names: ['a', 'e', 'x', 's'],
    domain: 'vmauthor.vld7net.fr',
    a: {
      next: 1,
      suffix: '/alive',
      0: {
        host: 'avmauthor.vld7net.fr',
        enabled: false
      }
    },
    e: {
      next: 1,
      suffix: '/alive',
      0: {
        host: 'evmauthor.vld7net.fr',
        enabled: false
      }
    },
    x: {
      next: 1,
      suffix: '/dbalive',
      0: {
        host: 'xvmauthor.vld7net.fr',
        enabled: false
      }
    },
    s: {
      next: 1,
      suffix: '/',
      0: {
        host: 'svmauthor.vld7net.fr',
        enabled: false
      }
    }
  };
}

describe('CodeGradX', function () {

  it('should be loaded', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    //hackForVMauthor(state);
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
        campaign.getExercises().then(function (es) {
          expect(es[0] instanceof CodeGradX.ExercisesSet).toBeTruthy();
          expect(es[1] instanceof CodeGradX.ExercisesSet).toBeTruthy();
          expect(es).toBe(campaign.exercises);
          done();
        }, faildone);
    }, faildone);
  });

  var exercise1;

  it("get one exercise", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    var campaign = state.currentCampaign;
    expect(campaign).toBeDefined();
    //console.log(campaign.exercises);
    expect(campaign.exercises).toBeDefined();
    exercise1 = campaign.exercises[0].exercises[0];
    expect(exercise1 instanceof CodeGradX.Exercise).toBeTruthy();
    expect(exercise1.nickname).toBe('croissante');
    done();
  });


});
