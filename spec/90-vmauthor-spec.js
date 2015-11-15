// Jasmine test related to the vmauthor virtual machine

var CodeGradX = require('../codegradxlib.js');
var vmauthor = require('./vmauthor-data.js');
var vmauthData = require('./vmauth-data.json');

describe('CodeGradX', function () {

  it('authenticates user', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State(vmauthor.initialize);
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    state.getAuthenticatedUser(vmauthData.login, vmauthData.password)
    .then(function (user) {
      expect(user).toBeDefined();
      if ( user.firstname !== 'no' && user.firstname !== 'John' ) {
        faildone();
      }
      expect(user.email).toBe('nobody@example.com');
      done();
    }, faildone);
  });

  it("modifies user's properties", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug('faildone', reason).show();
      fail(reason);
      done();
    }
    expect(state.currentUser).toBeDefined();
    state.currentUser.modify({
      lastname: "Doe",
      firstname: "John"
    }).then(function (user) {
      //console.log(user);
      expect(state.currentUser).toBe(user);
      expect(user.lastname).toBe("Doe");
      user.modify({
        firstname: "no",
        lastname: "one"
      }).then(function (user2) {
        expect(user2).toBe(user);
        expect(state.currentUser).toBe(user2);
        expect(user2.firstname).toBe('no');
        expect(user2.lastname).toBe('one');
        done();
      }, faildone);
    }, faildone);
  });

  it("gets the 'free' campaign", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentUser).toBeDefined();
    //console.log(state.currentUser);
    state.currentUser.getCampaign('free').then(function (campaign) {
      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('free');
      expect(state.currentCampaign).toBe(campaign);
      done();
    }, faildone);
  });

  it("gets the exercises of the 'free' campaign", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentCampaign).toBeDefined();
    //console.log(state.currentCampaign);
    //state.log.show();
    state.currentCampaign.getExercisesSet().then(function (es) {
      expect(es).toBeDefined();
      expect(state.currentCampaign.exercisesSet).toBe(es);
      done();
    }, faildone);
  });

  var exercise1;

  it("gets one exercise", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentCampaign).toBeDefined();
    var exerciseName = "com.paracamplus.li205.function.1";
    var promise = state.currentCampaign.getExercise(exerciseName);
    promise.then(function (e) {
      expect(e).toBeDefined();
      expect(e.name).toBe(exerciseName);
      e.getDescription().then(function (e2) {
        expect(e2).toBe(e.description);
        exercise1 = e;
        done();
      }, faildone);
    }, faildone);
  });

  var code1 = "int min(int a, int b) { return a; }\n";

  it("sends an answer to exercise1 and waits for report", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    expect(state.currentCampaign).toBeDefined();
    expect(exercise1).toBeDefined();
    exercise1.sendStringAnswer(code1).then(function (job) {
      expect(job).toBeDefined();
      job.getReport().then(function (job) {
        expect(job.mark).toBe('0.6');
        done();
      }, faildone);
    }, faildone);
  }, 50*1000); // 50 seconds

});
