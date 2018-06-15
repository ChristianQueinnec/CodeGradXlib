// define a new bad exercise

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

  var exerciseTGZFile1 = "spec/org.example.fw4ex.bad.check.tgz";
  var exercise2;

  it("may submit a new bad exercise", function (done) {
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
                  //console.log(exercise); // DEBUG
                  expect(e3).toBe(exercise2);
                  expect(e3.totaljobs).toBe(2);
                  expect(e3.finishedjobs).toBe(2);
                  expect(e3.globalReport).toMatch(/Discrepancy/);
                  var job2 = exercise.pseudojobs.perfect;
                  expect(job2.problem).toBeTruthy();
                  expect(job2.problem)
                      .toMatch(/No corresponding opening element for/);
                  done();
              });
          }).catch(faildone);
  }, 100*1000); // 100 seconds

});
