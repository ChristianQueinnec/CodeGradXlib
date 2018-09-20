// define a new exercise and send a new job against it.

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth3-data.json');      // author

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
    state.log.size = 500;
    state.getAuthenticatedUser(authData.login, authData.password)
    .then(function (user) {
      expect(user).toBeDefined();
      done();
    }, faildone);
  }, 20*1000);

  var exerciseTGZFile1 = "spec/org.example.fw4ex.grading.check.tgz";
  var exercise2;
  var counter = 0;

  it("may submit a new exercise and get one pseudojob", function (done) {
    var state = CodeGradX.getCurrentState();
    var faildone = make_faildone(done);
    expect(state.currentUser).toBeDefined();
    state.currentUser.submitNewExercise(exerciseTGZFile1)
          .then(function (exercise) {
              state.debug("***Exercise.tgz sent");
              expect(exercise).toBeDefined();
              expect(exercise instanceof CodeGradX.Exercise).toBeTruthy();
              exercise2 = exercise;
              return exercise.getExerciseReport().then(function (e3) {
                  state.debug("***ExerciseReport got");
                  expect(e3).toBe(exercise2);
                  //console.log(exercise); // DEBUG
                  var job2 = exercise.pseudojobs.perfect;
                  return job2.getReport().then(function (job) {
                      state.debug("***ExercisePseudoJob perfect got");
                      expect(job).toBe(job2);
                      expect(job.mark).toBe(100);
                      var job3 = exercise.pseudojobs.half;
                      return job3.getReport().then(function (job) {
                          state.debug("***ExercisePseudoJob half got");
                          expect(job).toBe(job3);
                          expect(job.mark).toBe(45);
                          CodeGradX.getCurrentState().log
                              .show(null, '/tmp/79.txt');
                          done();
                      });
                  });
              });
          }).catch(faildone);
  }, 100*1000); // 100 seconds

});
