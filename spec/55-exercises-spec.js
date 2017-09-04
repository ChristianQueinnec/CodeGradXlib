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

    it('should authenticate', function (done) {
        expect(CodeGradX).toBeDefined();
        var state = new CodeGradX.State();
        var faildone = make_faildone(done);
        state.getAuthenticatedUser(authData.login, authData.password)
            .then(function (user) {
                expect(user).toBeDefined();
                expect(user).toBe(state.currentUser);
                done();
            }).catch(faildone);
    }, 6*1000); // 6 seconds

    it("should get one campaign", function (done) {
        var state = CodeGradX.getCurrentState();
        var faildone = make_faildone(done);
        expect(state.currentUser instanceof CodeGradX.User).toBeTruthy();
        state.currentUser.getCampaign('insta2-2016oct')
            .then(function (campaign) {
                expect(campaign).toBeDefined();
                //console.log(campaign);//
                campaign.getExercise('org.codegradx.js.min3.3')
                    .then(function (exercise) {
                        expect(exercise).toBeDefined();
                        campaign.getExercisesSet()
                            .then(function (exercisesset) {
                                //console.log(exercisesset);
                                done();
                            })
                            .catch(faildone);
                    }).catch(faildone);
            }).catch(faildone);
    });

    it("fail upload a new ExercisesSet" , function (done) {
        var state = CodeGradX.getCurrentState();
        var faildone = make_faildone(done);
        state.currentUser.getCampaign('insta2-2016oct')
            .then(function (campaign) {
                expect(campaign).toBeDefined();
                //console.log(campaign);//
                campaign.uploadExercisesSet('spec/es.yml')
                    .then(faildone)
                    .catch(done);
            }).catch(faildone);
    });

    it("reconnect as a teacher", function (done) {
        var authData = require('./auth2-data.json');
        var state = new CodeGradX.State();
        var faildone = make_faildone(done);
        state.getAuthenticatedUser(authData.login, authData.password)
            .then(function (user) {
                //console.log(user);
                expect(user.personid).toBe(30882);
                expect(user).toBeDefined();
                expect(user).toBe(state.currentUser);
                done();
            }).catch(faildone);
    });

    it("succeed upload a new ExercisesSet" , function (done) {
        var state = CodeGradX.getCurrentState();
        var faildone = make_faildone(done);
        state.currentUser.getCampaign('insta2-2016oct')
            .then(function (campaign) {
                expect(campaign).toBeDefined();
                //console.log(campaign);//
                campaign.uploadExercisesSet('spec/es.yml')
                    .then(function (exercisesSet1) {
                        expect(exercisesSet1).toBeDefined();
                        //console.log(exercisesSet1);//
                        expect(exercisesSet1.notice[2]).toMatch('30882');
                        //console.log(exercisesSet1.exercises[0]);//
                        expect(exercisesSet1.exercises[0].title).toBe('closures');
                        campaign.getExercisesSet()
                            .then(function (exercisesSet2) {
                                expect(exercisesSet2).toEqual(exercisesSet1);
                                done();
                            }).catch(faildone);
                    }).catch(faildone);
            }).catch(faildone);
    });

});
    
 
