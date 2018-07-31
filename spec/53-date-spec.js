// Jasmine test to check parsing of dates (Safari Date.parse does not
// work as in Chrome).

var CodeGradX = require('../codegradxlib.js');

describe('CodeGradX', function () {

    it('should be loaded', function (done) {
        expect(CodeGradX).toBeDefined();
        var state = new CodeGradX.State();
        CodeGradX.xml2html.default.markFactor = 100;
        done();
    });
    
    it("handle ymd hms+", function () {
        var d = '2001-01-01 01:01:01+02';
        expect(CodeGradX._str2Date(d).toJSON())
            .toBe('2000-12-31T23:01:01.000Z');
    });
    it("handle ymd hms+Z", function () {
        var d = '2001-01-02 01:01:01Z';
        expect(CodeGradX._str2Date(d).toJSON())
            .toBe('2001-01-02T01:01:01.000Z');
    });
    it("handle ymdThms", function () {
        var d = '2001-01-03T01:01:01';
        expect(CodeGradX._str2Date(d).toJSON())
            .toBe('2001-01-03T00:01:01.000Z');
    });
    it("handle ymdThms+Z", function () {
        var d = '2001-01-04T01:01:01Z';
        expect(CodeGradX._str2Date(d).toJSON())
            .toBe('2001-01-04T01:01:01.000Z');
    });

    
});
