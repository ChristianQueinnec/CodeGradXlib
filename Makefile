work : lint doc tests
clean :: cleanMakefile

# ############## Working rules:

lint :
	jshint codegradxlib.js spec/*.js

tests : spec/org.example.fw4ex.grading.check.tgz
	jasmine spec/*-spec.js

spec/org.example.fw4ex.grading.check.tgz : spec/fw4ex.xml
	cd spec/ && tar czf org.example.fw4ex.grading.check.tgz ./fw4ex.xml

doc : doc/index.html
doc/index.html : codegradxlib.js
	node_modules/.bin/jsdoc -c conf.json codegradxlib.js

# ############## Various experiments (not all finished)

docco :
	docco codegradxlib.js

browserify :
	browserify codegradxlib.js -o codegradxlib-bundle.js

uglifyjs :
	uglifyjs codegradx.js -c "evaluate=false" \
		-m --source-map codegradx.min.map -o codegradx.min.js

phantomjs :
	phantomjs test/run-jasmine.js test/jasmine.html

# end of Makefile
