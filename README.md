# broccoli-pipeline

[![Build Status](https://travis-ci.org/iangreenleaf/broccoli-pipeline.svg?branch=master)](https://travis-ci.org/iangreenleaf/broccoli-pipeline)

Pipeline thingy for Broccoli.

***Still very much a work in progress.***

## Usage

In your HTML files, use blocks to list your assets.
You can use exact filenames, or globs.

```html
<!-- build:js js/app.js -->
<script src="my.js"></script>
<script src="myjs/**/*.js"></script>
<!-- endbuild -->
```

Then pass the HTML and all assets to the pipeline:

```js
var pipeline = require('broccoli-pipeline');

var sourceTree = pipeline(sourceTree, {
  htmlFiles: [
    'app/index.html'
  ]
});
```

In development, this will write all files as individual script tags in the blocks.
In production, it will concatenate each block into the file named in the block comment.

## Contributing

To run the tests:

```javascript
npm test
```

## License

This project is distributed under the MIT license.
