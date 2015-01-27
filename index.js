var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var helpers = require('broccoli-kitchen-sink-helpers')
var Writer = require('broccoli-writer')
var jsStringEscape = require('js-string-escape')
var crypto = require('crypto')
var quickTemp = require('quick-temp')
var glob = require('glob')

module.exports = Concat

Concat.prototype = Object.create(Writer.prototype)
Concat.prototype.constructor = Concat
function Concat(inputTree, options) {
  if (!(this instanceof Concat)) return new Concat(inputTree, options)
  this.inputTree = inputTree
  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key]
    }
  }

  this.cache = {}
  this.cachedConcatenatedOutputHash = null
}

Concat.prototype.cleanup = function(){
  Writer.prototype.cleanup.call(this)
  quickTemp.remove(this, 'tmpCacheDir')
}

Concat.prototype.write = function (readTree, destDir) {
  var self = this
    return readTree(this.inputTree).then(function (srcDir) {
      function rewriteFile(filePath, stat) {
        var fileContents = fs.readFileSync(srcDir + '/' + filePath, { encoding: 'utf8' })
          var rewrittenFileContents = fileContents.replace(
              /([\r\n]? *<script\b[^>]*src=['"])([^"']+)(['"][^>]*><\/script> *\r?)/,
              function(m, prefix, glob, suffix) {
                var files = helpers.multiGlob([glob], {cwd: srcDir})
                  return files.map(function(file) {
                    return prefix + file + suffix
                  }).join('')
              }
              )
          fs.writeFileSync(path.join(destDir, filePath), rewrittenFileContents)
      }

      var inputHtml = helpers.multiGlob(self.htmlFiles, {cwd: srcDir})
        for (i = 0; i < inputHtml.length; i++) {
          var stat = getStat(srcDir + '/' + inputHtml[i]);
          if (stat && stat.isFile()) {
            rewriteFile(inputHtml[i], stat)
          }
        }
    })
}

function getStat(path) {
  try {
    return fs.statSync(path);
  } catch(error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return null;
  }
}
