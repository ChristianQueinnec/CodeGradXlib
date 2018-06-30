# CodeGradXlib

work : lint tests
clean :
	-rm *~
	-rm README.log README.tex

# ############## Working rules:

lint :
	eslint codegradxlib.js

nsp+snyk :
	npm link nsp
	node_modules/.bin/nsp check
#	npm link snyk
#	-node_modules/.bin/snyk test codegradxlib

tests : lint test.with.real.servers test.with.vmauthor

test.with.real.servers :
	jasmine spec/[0-8]*.js 2>&1 | tee /tmp/spec.log

test.with.vmauthor : spec/org.example.fw4ex.grading.check.tgz spec/oefgc.tgz
	@echo " tests require a running vmauthor..."
	ping -c 3 xvmauthor.codegradx.org
	export NODE_TLS_REJECT_UNAUTHORIZED=0 ;\
	jasmine spec/9*.js 2>&1 | tee -a /tmp/spec.log
	@echo "*** Report with         less /tmp/spec.log"

test.batch.with.real.servers : spec/org.example.fw4ex.grading.check.tgz
test.batch.with.real.servers : spec/oefgc.tgz
	jasmine spec/8*.js 2>&1 | tee /tmp/spec.log

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
# Caution: npm takes the whole directory that is . and not the sole
# content of CodeGradXlib.tgz 

publish : lint nsp+snyk bower.json clean
	git status .
	-git commit -m "NPM publication `date`" .
	git push
	-rm -f CodeGradXlib.tgz
	m CodeGradXlib.tgz install
	cd tmp/CodeGradXlib/ && npm version patch && npm publish
	cp -pf tmp/CodeGradXlib/package.json .
	rm -rf tmp
	npm install -g codegradxlib@`jq -r .version < package.json`
#	m propagate

CodeGradXlib.tgz :
	-rm -rf tmp
	mkdir -p tmp
	cd tmp/ && \
	  git clone https://github.com/ChristianQueinnec/CodeGradXlib.git
	rm -rf tmp/CodeGradXlib/.git
	cp -p package.json tmp/CodeGradXlib/ 
	tar czf CodeGradXlib.tgz -C tmp CodeGradXlib
	tar tzf CodeGradXlib.tgz

REMOTE	=	www.paracamplus.com
install :
	-rm CodeGradXlib.tgz
	m CodeGradXlib.tgz
	rsync -avu CodeGradXlib.tgz \
		${REMOTE}:/var/www/www.paracamplus.com/Resources/Javascript/

propagate :
	npm install -g codegradxlib@`jq -r .version < package.json`
	cd ../CodeGradXagent    ; m update
	cd ../CodeGradXagent    ; rm -rf node_modules ; npm install
	cd ../CodeGradXvmauthor ; rm -rf node_modules ; npm install
	cd ../CodeGradXvmauthor ; npm install -S codegradxagent
	cd ../CodeGradXenroll   ; npm install -S codegradxlib
	cd ../CodeGradXmarker   ; npm install -S codegradxlib
	cd ../CodeGradXmarker   ; npm install -S yasmini
	cd ../../Servers/np/Paracamplus-*/;    m refresh.codegradx
	cd ../../Servers/w.js/Paracamplus-*/;  m refresh.codegradx
	cd ../../Servers/w.ncc/Paracamplus-*/; m refresh.codegradx
	cd ../../Servers/w.unx2/Paracamplus-*/; m refresh.codegradx
	cd ../../Servers/w.njfp/Paracamplus-*/; m refresh.codegradx
	grep '"codegradxlib":' ../CodeGradX*/package.json

# ############## bower

bower.json : package.json
	node npm2bower.js

bower.registration :
	node_modules/.bin/bower register codegradxlib https://github.com/ChristianQueinnec/CodeGradXlib.git

# ############## Various experiments (not all finished)

README.tex : README.md
	pandoc -o README.tex -f markdown README.md 
README.pdf : README.tex
	pandoc -o README.pdf -f markdown README.md 

doc : doc/index.html
doc/index.html : codegradxlib.js
	node_modules/.bin/jsdoc -c conf.json codegradxlib.js

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
