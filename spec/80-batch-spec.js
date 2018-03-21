// Jasmine test related to the vmauthor virtual machine. The vmauthor
// virtual machine hosts a full constellation of CodeGradX servers.
// The vmauthor virtual machine is available from 
//       http://paracamplus.com/CodeGradX/VM/latest/

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth-data.json');

describe('CodeGradX', function () {
  CodeGradX.xml2html.default.markFactor = 100;

  function make_faildone (done) {
      return function faildone (reason) {
          var state = CodeGradX.getCurrentState();
          state.debug('faildone', reason).show();
          //console.log(reason);
          fail(reason);
          done();
      };
  }

  it('authenticates user', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State();
    var faildone = make_faildone(done);
    state.getAuthenticatedUser(authData.login, authData.password)
    .then(function (user) {
      expect(user).toBeDefined();
      done();
    }, faildone);
  }, 20*1000);

  var campaign1;

  it("gets the 'free' campaign", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(state.currentUser).toBeDefined();
    //console.log(state.currentUser);
    state.currentUser.getCampaign('free').then(function (campaign) {
      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('free');
      campaign1 = campaign;
      done();
    }, faildone);
  });

  it("gets the exercises of the 'free' campaign", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(campaign1).toBeDefined();
    //state.log.show();
    campaign1.getExercisesSet().then(function (es) {
      expect(es).toBeDefined();
      expect(campaign1.exercisesSet).toBe(es);
      done();
    }, faildone);
  }, 10*1000);

  var exercise1;

  it("gets one exercise", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(campaign1).toBeDefined();
    var exerciseName = "com.paracamplus.li205.function.1";
    var promise = campaign1.getExercise(exerciseName);
    promise.then(function (e) {
      expect(e).toBeDefined();
      expect(e.name).toBe(exerciseName);
      e.getDescription().then(function (e2) {
        expect(e2).toBe(e._description);
        exercise1 = e;
        done();
      }, faildone);
    }, faildone);
  });

  var code1 = "int min(int a, int b) { return a; }\n";

    // it("show log1", function (done) {
    //     //CodeGradX.getCurrentState().log.show();
    //     CodeGradX.getCurrentState().log.items = [];
    //     // Don't call done() to give time to flush stdout and stderr
    // }, 1*1000);

  it("sends a string answer to exercise1 and waits for report", 
     function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(campaign1).toBeDefined();
    expect(exercise1).toBeDefined();
    exercise1.sendStringAnswer(code1).then(function (job) {
      expect(job).toBeDefined();
      return job.getReport().then(function (job) {
        expect(job.mark).toBe(60);
        done();
      });
    }).catch(faildone);
  }, 50*1000); // 50 seconds

    // it("show log2", function (done) {
    //     CodeGradX.getCurrentState().log.show();
    //     CodeGradX.getCurrentState().log.items = [];
    //     // Don't call done() to give time to flush stdout and stderr
    // }, 10*1000);

    // it("stop", function () { process.exit(0); });

  var file1 = 'spec/min.c';

  it("cannot read a file", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    CodeGradX.readFileContent("unexistent-foo.bar")
    .then(faildone)
    .catch(done);
  });

  it("can read a file", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    CodeGradX.readFileContent(file1).then(function (data) {
      expect(data).toBeDefined();
      expect(data).toMatch(/int x,/);
      done();
    }, faildone);
  });

  it("sends a file answer to exercise1 and waits for report", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(campaign1).toBeDefined();
    expect(exercise1).toBeDefined();
    exercise1.sendFileAnswer(file1).then(function (job) {
      expect(job).toBeDefined();
      job.getReport().then(function (job) {
        expect(job.mark).toBe(100);
        done();
      }, faildone);
    }, faildone);
  }, 50*1000); // 50 seconds

  var exerciseTGZFile1 = "spec/org.example.fw4ex.grading.check.tgz";
  var exercise2;
  var counter = 0;

  it("may submit a new exercise and get one pseudojob", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    state.log.size = 50;
    expect(state.currentUser).toBeDefined();
    counter = 0;
    state.currentUser.submitNewExercise(exerciseTGZFile1, {
      step: 15,
      attempts: 30,
      progress: function (parameters) {
        counter = parameters.i;
        //console.log(parameters.i + ', ');
      }
    })
    .then(function (exercise) {
      expect(exercise).toBeDefined();
      expect(exercise instanceof CodeGradX.Exercise).toBeTruthy();
      exercise2 = exercise;
      exercise.getExerciseReport().then(function (e3) {
          expect(e3).toBe(exercise2);
          //console.log(exercise); // DEBUG
          var job2 = exercise.pseudojobs.perfect;
          job2.getReport().then(function (job) {
              expect(job).toBe(job2);
              expect(job.mark).toBe(10000);
              var job3 = exercise.pseudojobs.half;
              job3.getReport().then(function (job) {
                  expect(job).toBe(job3);
                  expect(job.mark).toBe(4500);
                  done();
              }, faildone);
          }, faildone);
      }, faildone);
    }, faildone);
  }, 100*1000); // 100 seconds

  var batchTGZfile = 'spec/oefgc.tgz';

  it("may send a batch", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(exercise2).toBeDefined();
    var counter = 0;
    var parameters = {
        step: 4,
        retry: 40,
        progress: function (parameters) {
          counter++;
          //state.log.show();
        }
    };
    var job1;
    exercise2.sendBatch(batchTGZfile)
     .delay(CodeGradX.Batch.prototype.getReport.default.step*1000)
     .then(function (batch) {
      //console.log(batch);
      batch.getReport(parameters).then(function (batch2) {
        //console.log(batch2);
        expect(batch2).toBe(batch);
        expect(counter).toBeGreaterThan(0);
        if ( batch.jobs.one ) {
            // Hope that this batch report is not the final one!
            job1 = batch.jobs.one;
        }
        batch2.getFinalReport(parameters).then(function (batch3) {
          expect(batch3).toBe(batch2);
          expect(counter).toBeGreaterThan(1);
          expect(batch.finishedjobs).toBeGreaterThan(0);
          expect(batch.totaljobs).toBe(batch.finishedjobs);
          // Check jobsCache:
          expect(batch.jobs.one === job1).toBeTruthy();
          //state.log.show();
          done();
        }, faildone);
      }, faildone);
    }, faildone);
  }, 500*1000); // 500 seconds

    // it("show log", function (done) {
    //     CodeGradX.getCurrentState().log.show();
    //     //CodeGradX.getCurrentState().log.items = [];
    //     // Don't call done() to give time to flush stdout and stderr
    // }, 10*1000);

});
