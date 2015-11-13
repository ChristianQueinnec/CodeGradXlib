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
        campaign.getExercisesSet().then(function (es) {
          expect(es instanceof CodeGradX.ExercisesSet).toBeTruthy();
          expect(es).toBe(campaign.exercisesSet);
          done();
        }, faildone);
    }, faildone);
  });

  // Javascript test
  it("checks replace globally", function () {
    var re = new RegExp("^(.)*(<a>(.)*</a>)(.)*$", "g");
    var s1 = "1234<a>X</a>567";
    expect(s1.replace(re, "$2")).toBe("<a>X</a>");

    var reg = new RegExp("<a>.*?</a>", "g");
    expect(s1.match(reg).length).toBe(1);
    expect(s1.match(reg)[0]).toBe("<a>X</a>");

    var s2 = "1234<a>X</a>567<a>YZ</a>89";
    //expect(s1.replace(re, "$2")).toBe("<a>X</a><a>YZ</a>");
    expect(s2.match(reg).length).toBe(2);
    expect(s2.match(reg)[0]).toBe("<a>X</a>");
    expect(s2.match(reg)[1]).toBe("<a>YZ</a>");
  });

  var exercise1;

  it("get one exercise description", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    var campaign = state.currentCampaign;
    expect(campaign).toBeDefined();
    //console.log(campaign.exercisesSet);
    expect(campaign.exercisesSet).toBeDefined();
    exercise1 = campaign.exercisesSet.exercises[0].exercises[0];
    expect(exercise1 instanceof CodeGradX.Exercise).toBeTruthy();
    expect(exercise1.nickname).toBe('croissante');
    //console.log(exercise1);
    exercise1.getDescription().then(function (description) {
      //console.log(e);
      expect(exercise1.XMLdescription).toBeDefined();
      expect(exercise1.description).toBe(description);
      expect(exercise1.description.fw4ex).toBeDefined();
      expect(exercise1.description.fw4ex.exerciseContent).toBeDefined();
      // Check authorship:
      expect(exercise1.authorship.length).toBe(1);
      expect(exercise1.authorship[0].firstname).toBe('Christian');
      // check stem:
      expect(exercise1.XMLstem).toBeDefined();
      // check inlineFileName
      expect(exercise1.inlineFileName).toBe("croissante.scm");
      //console.log(exercise1);
      done();
    }, faildone);
  });

  var exercise2;

  it("get a precise exercise", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    var campaign = state.currentCampaign;
    var exerciseName = "com.paracamplus.li205.function.1";
    campaign.getExercise(exerciseName).then(function (exercise) {
      expect(exercise).toBeDefined();
      expect(exercise.name).toBe(exerciseName);
      exercise.getDescription().then(function (description) {
        expect(exercise.inlineFileName).toBe("min.c");
        exercise2 = exercise;
        done();
      }, faildone);
    }, faildone);
  });

  it("get an absent exercise", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      fail(reason);
      done();
    }
    var campaign = state.currentCampaign;
    var exerciseName = "com.paracamplus.li205.function.1,.XXX";
    campaign.getExercise(exerciseName).then(faildone, function (reason) {
      done();
    });
  });

  var code1 = "" +
  "int min (int a, int b) { \n" +
  "  return (a<b)?a:b; \n" +
  "}\n";

  it("may send an answer", function (done) {
    var state = CodeGradX.getCurrentState();
    function faildone (reason) {
      state.debug(reason).show();
      console.log(reason);
      fail(reason);
      done();
    }
    expect(exercise2).toBeDefined();
    //console.log(exercise2);
    exercise2.sendStringAnswer(code1).then(function (job) {
      expect(job).toBeDefined();
      //console.log(job);
      expect(job instanceof CodeGradX.Job).toBeTruthy();
      expect(job.jobid).toBeDefined();
      job.getReport().then(function (j) {
        //console.log(report);
        expect(j).toBeDefined();
        expect(j).toBe(job);
        expect(j.finished).toBeDefined();
        expect(j.exerciseid).toBeDefined();
        expect(j.report).toBeDefined();
        done();
      });
    }, faildone);
  }, 50*1000); // 50 seconds

});
