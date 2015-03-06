'use strict'

var path     = require('path')
var concat   = require('..')
var pipeline   = require('..')
var expect   = require('expect.js')
var root     = process.cwd()
var fs       = require('fs')
var broccoli = require('broccoli')

var builder

describe('broccoli-pipeline', function(){
  var initialTmpContents;

  function readFile(path) {
    return fs.readFileSync(path, {encoding: 'utf8'})
  }

  function getMtime(path) {
    return fs.lstatSync(path).mtime
  }

  function chdir(path) {
    process.chdir(path)
  }

  before(function() {
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp');
    }
  });

  beforeEach(function() {
    chdir(root)
      initialTmpContents = fs.readdirSync('tmp');
  })

  afterEach(function() {
    if (builder) {
      builder.cleanup()
    }

    expect(fs.readdirSync('tmp')).to.eql(initialTmpContents);
  })

  describe('development mode', function() {
    it('rewrites html files with all files', function() {
      var sourcePath = 'tests/fixtures/input'
        var tree = pipeline(sourcePath, {
          htmlFiles: ['index.html'],
        })

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(results) {
        var dir = results.directory;
        expect(readFile(dir + '/index.html')).to.eql(readFile('tests/fixtures/output/index-dev.html'))
      })
    })

    it('copies other files', function() {
      var sourcePath = 'tests/fixtures/input'
        var tree = pipeline(sourcePath, {
          htmlFiles: ['index.html'],
        })

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(results) {
        var dir = results.directory;
        expect(readFile(dir + '/other.js')).to.eql(readFile('tests/fixtures/input/other.js'))
      })
    })

    it('ignores tags outside of build blocks', function() {
      var sourcePath = 'tests/fixtures/input'
        var tree = pipeline(sourcePath, {
          htmlFiles: ['index-no-blocks.html'],
        })

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(results) {
        var dir = results.directory;
        expect(readFile(dir + '/index-no-blocks.html')).to.eql(readFile('tests/fixtures/input/index-no-blocks.html'))
      })
    })
  })

  describe('production mode', function() {
    it('rewrites html files with bundled files', function() {
      var sourcePath = 'tests/fixtures/input'
        var tree = pipeline(sourcePath, {
          htmlFiles: ['index.html'],
          bundle: true,
        })

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(results) {
        var dir = results.directory;
        expect(readFile(dir + '/index.html')).to.eql(readFile('tests/fixtures/output/index-prod.html'))
      })
    })

    it('concatenates bundled files', function() {
      var sourcePath = 'tests/fixtures/input'
        var tree = pipeline(sourcePath, {
          htmlFiles: ['index.html'],
          bundle: true,
        })

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(results) {
        var dir = results.directory;
        expect(readFile(dir + '/js/vendor.js')).to.eql(readFile('tests/fixtures/output/vendor.js'))
        expect(readFile(dir + '/css/vendor.css')).to.eql(readFile('tests/fixtures/input/reset.css'))
        expect(readFile(dir + '/css/main.css')).to.eql(readFile('tests/fixtures/output/main.css'))
      })
    })
  })
});
