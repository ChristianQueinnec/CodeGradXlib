// Jasmine test related to the vmauthor virtual machine
// This VM must be running, it hosts all the hostnames *vmauthor.vld7net.fr.

var CodeGradX = require('../codegradxlib.js');
var vmauthor = require('./vmauthor-data.js');
var vmauthData = require('./vmauth-data.json');

describe('CodeGradX', function () {

  function make_faildone (done) {
      return function faildone (reason) {
          state.debug('faildone', reason).show();
          //console.log(reason);
          fail(reason);
          done();
      };
  }

  it('authenticates user', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State(vmauthor.initialize);
    var faildone = make_faildone(done);
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
    var faildone = make_faildone(done);
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
  });

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

  it("sends a string answer to exercise1 and waits for report", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(campaign1).toBeDefined();
    expect(exercise1).toBeDefined();
    exercise1.sendStringAnswer(code1).then(function (job) {
      expect(job).toBeDefined();
      job.getReport().then(function (job) {
        expect(job.mark).toBe(0.6);
        done();
      }, faildone);
    }, faildone);
  }, 50*1000); // 50 seconds

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
        expect(job.mark).toBe(1);
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
      step: 5,
      attempts: 30,
      progress: function (parameters) {
        counter = parameters.i;
        //console.log(parameters.i + ', ');
      }
    })
    .then(function (exercise) {
      expect(exercise).toBeDefined();
      expect(counter).toBeGreaterThan(1);
      exercise2 = exercise;
      exercise.getExerciseReport().then(function (e3) {
          expect(e3).toBe(exercise2);
          console.log(exercise); // DEBUG
          var job2 = exercise.pseudojobs.perfect;
          job2.getReport().then(function (job) {
              expect(job).toBe(job2);
              expect(job.mark).toBe(100);
              var job3 = exercise.pseudojobs.half;
              job3.getReport().then(function (job) {
                  expect(job).toBe(job3);
                  expect(job.mark).toBe(45);
                  done();
              }, faildone);
          }, faildone);
      }, faildone);
    }, faildone);
  }, 150*1000); // 150 seconds

  var batchTGZfile = 'spec/oefgc.tgz';

  it("may send a batch", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(exercise2).toBeDefined();
    var counter = 0;
    var parameters = {
        step: 10,
        retry: 40,
        progress: function (parameters) {
          counter++;
          state.log.show();
        }
    };
    exercise2.sendBatch(batchTGZfile).then(function (batch) {
      //console.log(batch);
      batch.getReport(parameters).then(function (batch2) {
        //console.log(batch2);
        expect(batch2).toBe(batch);
        expect(counter).toBeGreaterThan(0);
        batch2.getFinalReport(parameters).then(function (batch3) {
          expect(batch3).toBe(batch2);
          expect(counter).toBeGreaterThan(1);
          expect(batch.finishedjobs).toBeGreaterThan(0);
          expect(batch.totaljobs).toBe(batch.finishedjobs);
          //state.log.show();
          done();
        }, faildone);
      }, faildone);
    }, faildone);
  }, 400*1000); // 400 seconds

});
