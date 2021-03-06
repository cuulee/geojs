var path = require('path');
var glob = require('glob').sync;
var fs = require('fs-extra');
var docco = require('docco').document;
var jade = require('jade');

// generate the examples
fs.ensureDirSync('dist/examples');
var examples = glob('examples/*/example.json')
  .map(function (f) {
    // /path/to/example.json
    f = path.resolve(f);

    // content of example.json
    var json = fs.readJSONSync(path.resolve(f));

    // directory of the example
    var dir = path.dirname(f);

    // the main js file for the example
    var main = path.resolve(dir, json.exampleJs[0]);

    // the output directory where the example will be compiled
    var output = path.resolve('dist', 'examples', json.path);

    // create, empty, and copy the source directory
    fs.emptyDirSync(output);
    fs.copySync(dir, output);

    // make docco documentation in:
    //   dist/examples/<name>/docs/
    docco({
      args: [main],
      output: path.resolve(output, 'docs'),
      layout: 'classic'
    }, function () {
      // simplify the docco output to reduce the output size by
      // removing the unnecessary public/ directory
      fs.removeSync(path.resolve(output, 'docs', 'public'));
    });

    json.docHTML = 'docs/' + path.basename(main).replace(/js$/, 'html');
    json.bundle = '../bundle.js';

    var fn = jade.compileFile(path.relative('.', path.resolve(dir, 'index.jade')), {pretty: true});
    fs.writeFileSync(path.resolve(output, 'index.html'), fn(json));
    return json;
  });

// copy common files
fs.copySync('examples/common', 'dist/examples/common');

// create the main example page
var data = {
  hideNavbar: false,
  exampleCss: ['main.css'],
  exampleJs: ['main.js'],
  examples: examples,
  bundle: './bundle.js',
  about: {hidden: true},
  title: 'GeoJS'
};

// copy assets for the main page
fs.copySync('examples/main.js', 'dist/examples/main.js');
fs.copySync('examples/main.css', 'dist/examples/main.css');

var fn = jade.compileFile('./examples/index.jade', {pretty: true});
fs.writeFileSync(
  path.resolve('dist', 'examples', 'index.html'),
  fn(data)
);

