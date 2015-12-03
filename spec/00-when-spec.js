// Tests with promises as implemented by `when`

var CodeGradX = require('../codegradxlib.js');
var when = require('when');
var rest = require('rest');
var mime = require('rest/interceptor/mime');

describe("when", function () {

    function make_faildone (done) {
        return function faildone (reason) {
            //console.log(reason);
            fail(reason);
            done();
        };
    }

    it("test1", function (done) {
        var faildone = make_faildone(done);
        rest('http://absent.example.org/12345')
        .then(function (response) {
            console.log('response', response);
            faildone();
        }, function (reason) {
            // reason = { 
            //    request: {path: , method: },
            //    error: {["message"], code: '', errno: '', syscall: } }
            //console.log('reason', reason);
            expect(reason).toBeDefined();
            done();
        });
    });

    it("test1 with mime interceptor", function (done) {
        var faildone = make_faildone(done);
        rest.wrap(mime)('http://absent.example.org/12345')
        .then(function (response) {
            console.log('response', response);
            faildone();
        }, function (reason) {
            // reason = { 
            //    request: {path: , method: },
            //    error: {["message"], code: '', errno: 'ENOTFOUND', syscall: } }
            //console.log('reason', reason);
            expect(reason).toBeDefined();
            done();
        });
    });

    it("test2", function (done) {
        var faildone = make_faildone(done);
        rest.wrap(mime)('http://example.org/')
        .then(function (response) {
            expect(response).toBeDefined();
            done();
        }, faildone);
    });

    it("test2a: dynamic add of a then()", function (done) {
        var faildone = make_faildone(done);
        rest.wrap(mime)('http://example.org/')
        .then(function (response) {
            expect(response).toBeDefined();
            return when(response)
               .then(function (response2) {
                   expect(response2).toBe(response);
                   done();
               }, faildone);
        }, faildone);
    });

    it("test2b: catch a reject in a then", function (done) {
        var faildone = make_faildone(done);
        rest.wrap(mime)('http://example.org/')
        .then(function (response) {
                  expect(response).toBeDefined();
                  return when.reject(response);
              })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            done();
        });
    });

    it("test2c: first catch ignored", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when.reject(response1);
        })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            expect(reason).toBe(response);
            done();
        });
    });

    it("test2d: second then ignored", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when.reject(response1);
        })
        .then(function (response2) {
            faildone();
        })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            expect(reason).toBe(response);
            done();
        });
    });

    it("test2d2: second then ignored, second catch run", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when.reject(response1);
        })
        .then(function (response2) {
            faildone();
        })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            expect(reason).toBe(response);
            return when.reject(reason);
        })
        .catch(function (reason2) {
            expect(reason2).toBeDefined();
            expect(reason2).toBe(response);
            done();
        });
    });

    it("test2d3: second catch run, second then ignored", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when.reject(response1);
        })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            expect(reason).toBe(response);
            return when.reject(reason);
        })
        .then(function (response2) {
            faildone();
        })
        .catch(function (reason2) {
            expect(reason2).toBeDefined();
            expect(reason2).toBe(response);
            done();
        });
    });

    it("test2d4: second catch run, second then not ignored", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when.reject(response1);
        })
        .catch(function (reason) {
            expect(reason).toBeDefined();
            expect(reason).toBe(response);
            return when.reject(reason);
        })
        .catch(function (reason2) {
            expect(reason2).toBeDefined();
            expect(reason2).toBe(response);
            return when(reason2);
        })
        .then(function (response2) {
            expect(response2).toBe(response);
            done();
        });
    });

    it("test2e: value transforming", function (done) {
        var faildone = make_faildone(done);
        var response;
        rest.wrap(mime)('http://example.org/')
        .catch(function (reason) {
            faildone();
        })
        .then(function (response1) {
            expect(response1).toBeDefined();
            response = response1;
            return when([response1]);
        })
        .then(function (aresponse2) {
            expect(aresponse2[0]).toBe(response);
            done();
        })
        .catch(function (reason) {
            faildone();
        });
    });

});
