// Build a bower.json from the current package.json

let fs = require('fs');

let pjson = require('./package.json');
let ignore = fs.readFileSync('./.gitignore', 'utf-8');

let result = {
    name:            pjson.name,
    version:         pjson.version,
    dependencies:    pjson.dependencies,
    devDependencies: pjson.devDependencies,
    description:     pjson.description,
    keywords:        pjson.keywords,
    moduleType:  ["node"],
    licences:        pjson.licenses.filter(function (item) {
        return item.url }),
    ignore:    ignore.split(/\n/),
    authors:         pjson.author,
    homepage:        pjson.homepage,
    repository:      pjson.repository
};
fs.writeFileSync('bower.json', JSON.stringify(result) + '\n');
