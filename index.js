var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var helpers = require('broccoli-kitchen-sink-helpers')
var Writer = require('broccoli-writer')
var jsStringEscape = require('js-string-escape')
var crypto = require('crypto')
var quickTemp = require('quick-temp')
var glob = require('glob')
var htmlparser = require("htmlparser2")
var domSerializer = require("dom-serializer")

module.exports = Pipeline

Pipeline.prototype = Object.create(Writer.prototype)
Pipeline.prototype.constructor = Pipeline
function Pipeline(inputTree, options) {
  if (!(this instanceof Pipeline)) return new Pipeline(inputTree, options)
  this.inputTree = inputTree
  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key]
    }
  }

  this.cache = {}
  this.cachedConcatenatedOutputHash = null
}

Pipeline.prototype.cleanup = function(){
  Writer.prototype.cleanup.call(this)
  quickTemp.remove(this, 'tmpCacheDir')
}

Pipeline.prototype.write = function (readTree, destDir) {
  var self = this
    return readTree(this.inputTree).then(function (srcDir) {
      helpers.copyRecursivelySync(srcDir, destDir)

      function rewriteFile(filePath, stat) {
        var fileContents = fs.readFileSync(srcDir + '/' + filePath, { encoding: 'utf8' })
        var rewrittenFileContents = rewriteString(fileContents, srcDir)
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

function rewriteString(s, rootDir) {
  var replacements = []
  var inBlock = false;
  var inScriptTag = false;
  var currentScriptTag;
  var leadingWhitespace = {};
  var parser = new htmlparser.Parser({
    oncomment: function(text) {
      if (text.match(/^\s*build:(js|css)\s*(.+)\s*$/)) {
        inBlock = true
      } else if (text.match(/^\s*endbuild\s*$/)) {
        inBlock = false
        inScriptTag = false
      }
    },
    onopentag: function(name, attributes) {
      if (inBlock && name === "script" && attributes.src) {
        inScriptTag = true
        currentScriptTag = {
          attrs: attributes,
          startIndex: parser.startIndex,
          whitespace: ''
        }

        if (leadingWhitespace.endIndex === parser.startIndex - 1) {
          currentScriptTag.whitespace = leadingWhitespace.str
        }
      }
    },
    onclosetag: function(name) {
      if (inScriptTag && name === "script") {
        attributes = currentScriptTag.attrs
        inScriptTag = false
        var files = helpers.multiGlob([attributes.src], {cwd: rootDir})
        var newTags = files.map(function(file) {
          attributes.src = file
          scriptDom = {
            type: 'tag',
            name: 'script',
            attribs: attributes,
            children: []
          }
          return domSerializer(scriptDom)
        }).join(currentScriptTag.whitespace)
        replacements.push({startIndex: currentScriptTag.startIndex, endIndex: parser.endIndex, str: newTags})
      }
    },
    ontext: function(text) {
      if (text.match(/^\s+$/)) {
        var lastNewline = text.lastIndexOf(/\r|\n/)
        if (lastNewline === -1) {
          lastNewline = 0
        }
        leadingWhitespace = {endIndex: parser.endIndex, str: text.slice(lastNewline )}
      }
    }
  })
  parser.write(s);
  parser.end();

  lastIndex = 0
  newHtmlChunks = []
  replacements.forEach(function(replacement) {
    newHtmlChunks.push(s.slice(lastIndex, replacement.startIndex))
    newHtmlChunks.push(replacement.str)
    lastIndex = replacement.endIndex + 1
  })
  newHtmlChunks.push(s.slice(lastIndex))
  return newHtmlChunks.join('')
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
