work : lint doc tests
clean :: cleanMakefile

# ############## Working rules:

lint :
	jshint codegradxlib.js spec/*.js

doc : doc/index.html
doc/index.html : codegradxlib.js
	node_modules/.bin/jsdoc -c conf.json codegradxlib.js

tests : spec/org.example.fw4ex.grading.check.tgz spec/oefgc.tgz
	for spec in spec/*-spec.js ; do jasmine $$spec || exit 1 ; done

spec/org.example.fw4ex.grading.check.tgz : spec/fw4ex.xml
	cd spec/ && tar czf org.example.fw4ex.grading.check.tgz ./fw4ex.xml

spec/oefgc.tgz : Makefile spec/oefgc/fw4ex.xml
	cd spec/oefgc/ && for d in 1 2 3 4 5 6 7 8 9 ; do \
		mkdir -p $$d && echo "$${d}0" > $$d/mark.txt ;\
	  tar czf $$d.tgz -C $$d mark.txt ; \
	done
	cd spec/oefgc/ && tar czf ../oefgc.tgz fw4ex.xml [0-9]*.tgz
	tar tzf spec/oefgc.tgz

# ############## NPM package

CodeGradXlib.tgz :
	-rm -rf tmp
	mkdir -p tmp
	cd tmp/ && git clone https://github.com/ChristianQueinnec/CodeGradXlib.git
	rm -rf tmp/CodeGradXlib/.git
	cp -p package.json tmp/CodeGradXlib/ 
	tar czf CodeGradXlib.tgz -C tmp CodeGradXlib
	tar tzf CodeGradXlib.tgz

REMOTE	=	www.paracamplus.com
install : CodeGradXlib.tgz
	rsync -avu CodeGradXlib.tgz \
		${REMOTE}:/var/www/www.paracamplus.com/Resources/Javascript/

# Caution: npm takes the whole directory that is . and not the sole
# content of CodeGradXlib.tgz 
publish : 
	git status .
	-git commit -m "NPM publication `date`" .
	git push
	-rm -f CodeGradXlib.tgz
	m CodeGradXlib.tgz install
	cd tmp/CodeGradXlib/ && npm version patch && npm publish
	cp -pf tmp/CodeGradXlib/package.json .
	rm -rf tmp

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
