var fs = require('fs')
var path = require('path')
var helpers = require('broccoli-kitchen-sink-helpers')
var Writer = require('broccoli-writer')
var htmlparser = require("htmlparser2")
var domSerializer = require("dom-serializer")
var objectMerge = require("object-merge")

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
}

Pipeline.prototype.write = function (readTree, destDir) {
  var self = this
  return readTree(self.inputTree).then(function (srcDir) {
    helpers.copyRecursivelySync(srcDir, destDir)

    function rewriteFile(filePath) {
      var fileContents = fs.readFileSync(srcDir + '/' + filePath, { encoding: 'utf8' })
      var tagParser = new BundleTagParser(fileContents, srcDir)
      tagParser.parse()
      tagParser.expandTags()

      var rewrittenFileContents = tagParser.rewrittenHtml({bundle: self.bundle})
      fs.writeFileSync(path.join(destDir, filePath), rewrittenFileContents)
    }

    var inputHtml = helpers.multiGlob(self.htmlFiles, {cwd: srcDir})
      for (var i = 0; i < inputHtml.length; i++) {
        var stat = getStat(srcDir + '/' + inputHtml[i]);
        if (stat && stat.isFile()) {
          rewriteFile(inputHtml[i], stat)
        }
      }
  })
}

function BundleTagParser(htmlString, rootDir) {
  this.html = htmlString
  this.rootDir = rootDir
  this.bundles = []
}

BundleTagParser.prototype.parse = function() {
  var self = this
  var inBlock = false;
  var inScriptTag = false;
  var currentScriptTag;
  var leadingWhitespace = {};
  var currentBundleTags = [];
  var currentBundleAttrs;
  var parser = new htmlparser.Parser({
    oncomment: function(text) {
      var matches = text.match(/^\s*build:(js|css)\s*(.+)\s*$/)
      if (matches) {
        inBlock = true
        currentBundleTags = []
        currentBundleAttrs = {
          startIndex: parser.startIndex,
          filename: matches[2],
        }
      } else if (text.match(/^\s*endbuild\s*$/)) {
        inBlock = false
        inScriptTag = false
        currentBundleAttrs.endIndex = parser.endIndex
        currentBundleAttrs.contents = currentBundleTags
        self.bundles.push(currentBundleAttrs)
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
        inScriptTag = false
        currentBundleTags.push({
          startIndex: currentScriptTag.startIndex,
          endIndex: parser.endIndex,
          attributes: currentScriptTag.attrs,
          leadingWhitespace: currentScriptTag.whitespace
        })
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
  parser.write(self.html);
  parser.end();
}

BundleTagParser.prototype.expandTags = function() {
  var self = this
  self.bundles.forEach(function(bundle) {
    bundle.expandedContents = []
    bundle.contents.forEach(function(tag) {
      bundle.expandedContents.push(objectMerge(tag, {
        files: helpers.multiGlob([tag.attributes.src], {cwd: self.rootDir})
      }))
    })
  })
}

BundleTagParser.prototype.rewrittenHtml = function(options) {
  var self = this
  options = objectMerge({bundle: false}, options)

  function makeScriptTag(attrs) {
    var scriptDom = {
      type: 'tag',
      name: 'script',
      attribs: attrs,
      children: []
    }
    return domSerializer(scriptDom)
  }
  function bundleTagToHtml(bundleTag) {
    return bundleTag.files.map(function(file) {
      return makeScriptTag(objectMerge(bundleTag.attributes, { src: file }))
    }).join(bundleTag.leadingWhitespace)
  }

  var lastIndex = 0
  var newHtmlChunks = []
  self.bundles.forEach(function(bundle) {
    if (options.bundle) {
      newHtmlChunks.push(self.html.slice(lastIndex, bundle.startIndex))
      newHtmlChunks.push(makeScriptTag({src: bundle.filename}))
      lastIndex = bundle.endIndex + 1
    } else {
      bundle.expandedContents.forEach(function(tag) {
        newHtmlChunks.push(self.html.slice(lastIndex, tag.startIndex))
        newHtmlChunks.push(bundleTagToHtml(tag))
        lastIndex = tag.endIndex + 1
      })
    }
  })
  newHtmlChunks.push(self.html.slice(lastIndex))
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
