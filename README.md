# radi-router

`radi-router` is the official router for [Radi.js](https://radi.js.org). It deeply integrates with Radi for seamless application building.

[![npm version](https://img.shields.io/npm/v/radi-router.svg?style=flat-square)](https://www.npmjs.com/package/radi-router)
[![npm downloads](https://img.shields.io/npm/dm/radi-router.svg?style=flat-square)](https://www.npmjs.com/package/radi-router)
[![gzip bundle size](http://img.badgesize.io/https://unpkg.com/radi-router@0.1.1/dist/radi-router.min.js?compression=gzip&style=flat-square)](https://unpkg.com/radi-router@0.1.1/dist/radi-router.js)
[![radi workspace on slack](https://img.shields.io/badge/slack-radijs-3eb891.svg?style=flat-square)](https://join.slack.com/t/radijs/shared_invite/enQtMjk3NTE2NjYxMTI2LWFmMTM5NTgwZDI5NmFlYzMzYmMxZjBhMGY0MGM2MzY5NmExY2Y0ODBjNDNmYjYxZWYxMjEyNjJhNjA5OTJjNzQ)


## Installation

To install the stable version:

```
npm install --save radi-router
```

This assumes you are using [npm](https://www.npmjs.com/) as your package manager.  

If you're not, you can [access these files on unpkg](https://unpkg.com/radi-router/dist/), download them, or point your package manager to them.

#### Browser Compatibility

`radi-router` currently is compatible with browsers that support ES6. In stable release v1 it will support ES5 compatible browsers and even some below that, yes - looking at IE8 too.

## Documentation

Documentation is currently being written. For now just a few examples to work our appetite.

#### Foo bar routing example

```jsx
/** @jsx r **/
import { r, use, mount, component } from 'radi'
import router from 'radi-router'

const index = component({
  view: function() { return <h1>Index</h1> }
});

const foo = component({
  view: function() { return <h1>Foo</h1> }
});

const RouterComponent = use({
  routes: {
    '/': index,
    '/foo': foo
  }
})

mount((
  <div>
    <a href="#/">index</a>
    <a href="#/foo">foo</a>
    <div>
      { new RouterComponent() }
    </div>
  </div>
), document.body);
```

<!-- [View this example on codepen](https://codepen.io/Marcisbee/pen/MQmOWG?editors=0010) -->

<!-- ## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/radi-js/radi/releases). -->

## Stay In Touch

- [Twitter](https://twitter.com/radi_js)
- [Slack](https://join.slack.com/t/radijs/shared_invite/enQtMjk3NTE2NjYxMTI2LWFmMTM5NTgwZDI5NmFlYzMzYmMxZjBhMGY0MGM2MzY5NmExY2Y0ODBjNDNmYjYxZWYxMjEyNjJhNjA5OTJjNzQ)

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2018-present, Marcis (Marcisbee) Bergmanis
