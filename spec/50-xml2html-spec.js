// Jasmine test to check xml to html conversion

var CodeGradX = require('../codegradxlib.js');

describe('CodeGradX', function () {

  it('should be loaded', function (done) {
    expect(CodeGradX).toBeDefined();
    var state = new CodeGradX.State();
    done();
  });

  it("should convert p", function (done) {
    var xml = "<p>Hello</p>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<p>Hello<\/p>/);
    done();
  });

  it("should convert p with attributes", function (done) {
    var xml = "<p a='b'>Hello</p>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<p a="b">Hello<\/p>/);
    done();
  });

  it("should convert pre within p", function (done) {
    var xml = "<p a='b'>Hello<pre>foo()</pre> World</p>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<p a="b">Hello<pre>foo\(\)<\/pre> World<\/p>/);
    done();
  });

  it("should convert warning", function (done) {
    var xml = "<p>H<warning a='b'>ell</warning></p>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<p>H<div class="fw4ex_warning" a="b">ell<\/div><\/p>/);
    done();
  });

  it("should convert section", function (done) {
    var xml = "<section>H<warning a='b'>ell</warning></section>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div class="fw4ex_section1">H<div class="fw4ex_warning" a="b">ell<\/div><\/div>/);
    done();
  });

  it("should convert inner sections", function (done) {
    var xml = "<section>H<section>ell</section>o</section>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div class="fw4ex_section1">H<div class="fw4ex_section2">ell<\/div>o<\/div>/);
    done();
  });

  it("should convert mark", function (done) {
    var xml = "<section>You win <mark value='0.4'/> points</section>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div class="fw4ex_section1">You win <span value="0.4" class="fw4ex_mark">40<\/span> points<\/div>/);
    done();
  });

  it("should ignore FW4EX elements", function (done) {
    var xml = "<section>some <FW4EX a='b'/> thing</section>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div class="fw4ex_section1">some  thing<\/div>/);
    done();
  });

  it("should convert question", function (done) {
    var xml = "<question title='two words'>stem</question>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div title="two words" class="fw4ex_question"><div class="fw4ex_question_title" data_counter="1">two words<\/div>stem<\/div>/);
    done();
  });

  it("should convert questions", function (done) {
    var xml = "<section><question title='two words'>stem</question><question title='other words'>other stem</question></section>";
    var html = CodeGradX.xml2html(xml);
    expect(html).toMatch(/<div class="fw4ex_section1"><div title="two words" class="fw4ex_question"><div class="fw4ex_question_title" data_counter="1">two words<\/div>stem<\/div><div title="other words" class="fw4ex_question"><div class="fw4ex_question_title" data_counter="2">other words<\/div>other stem<\/div><\/div>/);
    done();
  });

});
