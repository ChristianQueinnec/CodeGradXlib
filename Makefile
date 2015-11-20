work : doc tests
clean :: cleanMakefile

tests : spec/org.example.fw4ex.grading.check.tgz
	jasmine spec/*-spec.js

spec/org.example.fw4ex.grading.check.tgz : spec/fw4ex.xml
	cd spec/ && tar czf org.example.fw4ex.grading.check.tgz ./fw4ex.xml

doc : doc/index.html
doc/index.html : codegradxlib.js
	node_modules/.bin/jsdoc -c conf.json codegradxlib.js

# end of Makefile
