// Jasmine test. Get current user

var CodeGradX = require('../codegradxlib.js');
var authData = require('./auth1-data.json');      // lambda student

describe('CodeGradX', function () {

    it('should be loaded', function () {
        expect(CodeGradX).toBeDefined();
    });
    
    function make_faildone (done) {
        return function faildone (reason) {
            var state = CodeGradX.getCurrentState();
            state.debug('faildone', reason).show();
            //console.log(reason);
            fail(reason);
            done();
        };
    }

    it("really authenticate and check", function (done) {
        var state = new CodeGradX.State();
        var faildone = make_faildone(done);
        state.getAuthenticatedUser(authData.login, authData.password)
            .then(function (user) {
                expect(user).toBeDefined();
                expect(user).toBe(state.currentUser);
                CodeGradX.getCurrentUser()
                .then(function (user2) {
                    expect(user2).toBe(user);
                    done();
                }).catch(faildone);
            }, faildone);
    });

    it("really authenticate and re-check", function (done) {
        var state = new CodeGradX.State();
        var faildone = make_faildone(done);
        state.getAuthenticatedUser(authData.login, authData.password)
            .then(function (user) {
                expect(user).toBeDefined();
                expect(user).toBe(state.currentUser);
                state.currentUser = null; // erase currentUser
                CodeGradX.getCurrentUser()
                .then(function (user2) {
                    expect(user2.personid).toBe(user.personid);
                    expect(user2).toBe(state.currentUser);
                    done();
                }).catch(faildone);
            }, faildone);
    });

});


    
