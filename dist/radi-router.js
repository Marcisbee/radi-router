(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['radi-router'] = {})));
}(this, (function (exports) { 'use strict';

/**
 * This is a fork of Navigo https://github.com/krasimir/navigo
 * Modified and fixed some issues that don't get merged and more.
 */

function isPushStateAvailable() {
  return !!(
    typeof window !== "undefined" &&
    window.history &&
    window.history.pushState
  );
}

function Navigo(r, useHash, hash) {
  this.root = null;
  this._routes = [];
  this._useHash = useHash;
  this._hash = typeof hash === "undefined" ? "#" : hash;
  this._paused = false;
  this._destroyed = false;
  this._lastRouteResolved = null;
  this._lastRouteFailed = null;
  this._notFoundHandler = null;
  this._defaultHandler = null;
  this._usePushState = !useHash && isPushStateAvailable();
  this._onLocationChange = this._onLocationChange.bind(this);
  this._genericHooks = null;
  this._historyAPIUpdateMethod = "pushState";

  if (r) {
    this.root = useHash
      ? r.replace(/\/$/, "/" + this._hash)
      : r.replace(/\/$/, "");
  } else if (useHash) {
    this.root = this._cLoc()
      .split(this._hash)[0]
      .replace(/\/$/, "/" + this._hash);
  }

  this._listen();
  this.updatePageLinks();
}

function clean(s) {
  if (s instanceof RegExp) { return s; }
  return s.replace(/\/+$/, "").replace(/^\/+/, "^/");
}

function regExpResultToParams(match, names) {
  if (names.length === 0) { return null; }
  if (!match) { return null; }
  return match.slice(1, match.length).reduce(function (params, value, index) {
    if (params === null) { params = {}; }
    params[names[index]] = decodeURIComponent(value);
    return params;
  }, null);
}

function replaceDynamicURLParts(route) {
  var paramNames = [],
    regexp;

  if (route instanceof RegExp) {
    regexp = route;
  } else {
    regexp = new RegExp(
      route
        .replace(Navigo.PARAMETER_REGEXP, function (full, dots, name) {
          paramNames.push(name);
          return Navigo.REPLACE_VARIABLE_REGEXP;
        })
        .replace(Navigo.WILDCARD_REGEXP, Navigo.REPLACE_WILDCARD) +
      Navigo.FOLLOWED_BY_SLASH_REGEXP,
      Navigo.MATCH_REGEXP_FLAGS
    );
  }
  return { regexp: regexp, paramNames: paramNames };
}

function getUrlDepth(url) {
  return url.replace(/\/$/, "").split("/").length;
}

function compareUrlDepth(urlA, urlB) {
  return getUrlDepth(urlB) - getUrlDepth(urlA);
}

function findMatchedRoutes(url, routes) {
  if ( routes === void 0 ) routes = [];

  return routes
    .map(function (route) {
      var ref = replaceDynamicURLParts(clean(route.route));
      var regexp = ref.regexp;
      var paramNames = ref.paramNames;
      var match = url.replace(/^\/+/, "/").match(regexp);
      var params = regExpResultToParams(match, paramNames);

      return match ? { match: match, route: route, params: params } : false;
    })
    .filter(function (m) { return m; });
}

function match(url, routes) {
  return findMatchedRoutes(url, routes)[0] || false;
}

function root(url, routes) {
  var matched = routes.map(function (route) { return route.route === "" || route.route === "*"
      ? url
      : url.split(new RegExp(route.route + "($|/)"))[0]; }
  );
  var fallbackURL = clean(url);

  if (matched.length > 1) {
    return matched.reduce(function (result, url) {
      if (result.length > url.length) { result = url; }
      return result;
    }, matched[0]);
  } else if (matched.length === 1) {
    return matched[0];
  }
  return fallbackURL;
}

function isHashChangeAPIAvailable() {
  return typeof window !== "undefined" && "onhashchange" in window;
}

function extractGETParameters(url) {
  return url
    .split(/\?(.*)?$/)
    .slice(1)
    .join("");
}

function getOnlyURL(url, useHash, hash) {
  var onlyURL = url,
    split;
  var cleanGETParam = function (str) { return str.split(/\?(.*)?$/)[0]; };

  if (typeof hash === "undefined") {
    // To preserve BC
    hash = "#";
  }

  if (isPushStateAvailable() && !useHash) {
    onlyURL = cleanGETParam(url).split(hash)[0];
  } else {
    split = url.split(hash);
    onlyURL =
      split.length > 1 ? cleanGETParam(split[1]) : cleanGETParam(split[0]);
  }

  return onlyURL;
}

function manageHooks(handler, hooks, params) {
  if (hooks && typeof hooks === "object") {
    if (hooks.before) {
      hooks.before(function (shouldRoute) {
        if ( shouldRoute === void 0 ) shouldRoute = true;

        if (!shouldRoute) { return; }
        handler();
        hooks.after && hooks.after(params);
      }, params);
      return;
    } else if (hooks.after) {
      handler();
      hooks.after && hooks.after(params);
      return;
    }
  }
  handler();
}

function isHashedRoot(url, useHash, hash) {
  if (isPushStateAvailable() && !useHash) {
    return false;
  }

  if (!url.match(hash)) {
    return false;
  }

  var split = url.split(hash);

  return split.length < 2 || split[1] === "";
}

Navigo.prototype = {
  helpers: {
    match: match,
    root: root,
    clean: clean,
    getOnlyURL: getOnlyURL
  },
  navigate: function (path, absolute) {
    var to;

    path = path || "";
    if (this._usePushState) {
      to = (!absolute ? this._getRoot() + "/" : "") + path.replace(/^\/+/, "/");
      to = to.replace(/([^:])(\/{2,})/g, "$1/");
      history[this._historyAPIUpdateMethod]({}, "", to);
      this.resolve();
    } else if (typeof window !== "undefined") {
      path = path.replace(new RegExp("^" + this._hash), "");
      window.location.href =
        window.location.href
          .replace(/#$/, "")
          .replace(new RegExp(this._hash + ".*$"), "") +
        this._hash +
        path;
    }
    return this;
  },
  on: function () {
    var this$1 = this;
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    if (typeof args[0] === "function") {
      this._defaultHandler = { handler: args[0], hooks: args[1] };
    } else if (args.length >= 2) {
      if (args[0] === "/") {
        var func = args[1];

        if (typeof args[1] === "object") {
          func = args[1].uses;
        }

        this._defaultHandler = { handler: func, hooks: args[2] };
      } else {
        this._add(args[0], args[1], args[2]);
      }
    } else if (typeof args[0] === "object") {
      var orderedRoutes = Object.keys(args[0]).sort(compareUrlDepth);

      orderedRoutes.forEach(function (route) {
        this$1.on(route, args[0][route]);
      });
    }
    return this;
  },
  off: function (handler) {
    if (
      this._defaultHandler !== null &&
      handler === this._defaultHandler.handler
    ) {
      this._defaultHandler = null;
    } else if (
      this._notFoundHandler !== null &&
      handler === this._notFoundHandler.handler
    ) {
      this._notFoundHandler = null;
    }
    this._routes = this._routes.reduce(function (result, r) {
      if (r.handler !== handler) { result.push(r); }
      return result;
    }, []);
    return this;
  },
  notFound: function (handler, hooks) {
    this._notFoundHandler = { handler: handler, hooks: hooks };
    return this;
  },
  resolve: function (current) {
    var this$1 = this;

    var handler, m;
    var url = (current || this._cLoc()).replace(this._getRoot(), "");

    if (this._useHash) {
      url = url.replace(new RegExp("^/" + this._hash), "/");
    }

    var GETParameters = extractGETParameters(current || this._cLoc());
    var onlyURL = getOnlyURL(url, this._useHash, this._hash);

    if (this._paused) { return false; }

    if (
      this._lastRouteStopped &&
      this._lastRouteResolved &&
      onlyURL === this._lastRouteResolved.url &&
      GETParameters === this._lastRouteResolved.query
    ) {
      this._lastRouteStopped = true;
      if (
        this._lastRouteResolved.hooks &&
        this._lastRouteResolved.hooks.already
      ) {
        this._lastRouteResolved.hooks.already(this._lastRouteResolved.params);
      }
      return false;
    }

    m = match(onlyURL, this._routes);

    if (m) {
      this._callLeave();
      this._lastRouteStopped = null;
      this._lastRouteResolved = {
        url: onlyURL,
        query: GETParameters,
        hooks: m.route.hooks,
        params: m.params,
        name: m.route.name
      };
      handler = m.route.handler;
      manageHooks(
        function () {
          manageHooks(
            function () {
              m.route.route instanceof RegExp
                ? handler.apply(void 0, m.match.slice(1, m.match.length))
                : handler(m.params, GETParameters);
            },
            m.route.hooks,
            m.params,
            this$1._genericHooks
          );
        },
        this._genericHooks,
        m.params
      );
      return m;
    } else if (
      this._defaultHandler &&
      (onlyURL === "" ||
        onlyURL === "/" ||
        onlyURL === this._hash ||
        isHashedRoot(onlyURL, this._useHash, this._hash))
    ) {
      manageHooks(function () {
        manageHooks(function () {
          this$1._callLeave();
          this$1._lastRouteStopped = null;
          this$1._lastRouteResolved = {
            url: onlyURL,
            query: GETParameters,
            hooks: this$1._defaultHandler.hooks
          };
          this$1._defaultHandler.handler(GETParameters);
        }, this$1._defaultHandler.hooks);
      }, this._genericHooks);
      return true;
    } else if (this._notFoundHandler) {
      manageHooks(function () {
        manageHooks(function () {
          this$1._callLeave();
          this$1._lastRouteStopped = null;
          this$1._lastRouteResolved = {
            url: onlyURL,
            query: GETParameters,
            hooks: this$1._notFoundHandler.hooks
          };
          this$1._notFoundHandler.handler(GETParameters);
        }, this$1._notFoundHandler.hooks);
      }, this._genericHooks);
    }
    return false;
  },
  destroy: function () {
    this._routes = [];
    this._destroyed = true;
    this._lastRouteResolved = null;
    this._genericHooks = null;
    clearTimeout(this._listeningInterval);
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this._onLocationChange);
      window.removeEventListener("hashchange", this._onLocationChange);
    }
  },
  updatePageLinks: function () {
    var self = this;

    if (typeof document === "undefined") { return; }

    this._findLinks().forEach(function (link) {
      if (!link.hasListenerAttached) {
        link.addEventListener("click", function (e) {
          if (
            (e.ctrlKey || e.metaKey) &&
            e.target.tagName.toLowerCase() == "a"
          ) {
            return false;
          }
          var location = self.getLinkPath(link);

          if (!self._destroyed) {
            e.preventDefault();
            self.navigate(location.replace(/\/+$/, "").replace(/^\/+/, "/"));
          }
        });
        link.hasListenerAttached = true;
      }
    });
  },
  generate: function (name, data) {
    if ( data === void 0 ) data = {};

    var result = this._routes.reduce(function (result, route) {
      var key;

      if (route.name === name) {
        result = route.route;
        for (key in data) {
          result = result.toString().replace(":" + key, data[key]);
        }
      }
      return result;
    }, "");

    return this._useHash ? this._hash + result : result;
  },
  link: function (path) {
    return this._getRoot() + path;
  },
  pause: function (status) {
    if ( status === void 0 ) status = true;

    this._paused = status;
    if (status) {
      this._historyAPIUpdateMethod = "replaceState";
    } else {
      this._historyAPIUpdateMethod = "pushState";
    }
  },
  resume: function () {
    this.pause(false);
  },
  historyAPIUpdateMethod: function (value) {
    if (typeof value === "undefined") { return this._historyAPIUpdateMethod; }
    this._historyAPIUpdateMethod = value;
    return value;
  },
  disableIfAPINotAvailable: function () {
    if (!isPushStateAvailable()) {
      this.destroy();
    }
  },
  lastRouteResolved: function lastRouteResolved() {
    return this._lastRouteResolved;
  },
  getLinkPath: function getLinkPath(link) {
    return link.getAttribute("href");
  },
  hooks: function hooks(hooks$1) {
    this._genericHooks = hooks$1;
  },
  _add: function (route, handler, hooks) {
    if ( handler === void 0 ) handler = null;
    if ( hooks === void 0 ) hooks = null;

    if (typeof route === "string") {
      route = encodeURI(route);
    }
    this._routes.push(
      typeof handler === "object"
        ? {
          route: route,
          handler: handler.uses,
          name: handler.as,
          hooks: hooks || handler.hooks,
          tags: handler.tags,
          title: handler.title,
        }
        : { route: route, handler: handler, hooks: hooks }
    );

    return this._add;
  },
  _getRoot: function () {
    if (this.root !== null) { return this.root; }
    this.root = root(this._cLoc().split("?")[0], this._routes);
    return this.root;
  },
  _listen: function () {
    var this$1 = this;

    if (this._usePushState) {
      window.addEventListener("popstate", this._onLocationChange);
    } else if (isHashChangeAPIAvailable()) {
      window.addEventListener("hashchange", this._onLocationChange);
    } else {
      var cached = this._cLoc(),
        current,
        check;

      check = function () {
        current = this$1._cLoc();
        if (cached !== current) {
          cached = current;
          this$1.resolve();
        }
        this$1._listeningInterval = setTimeout(check, 200);
      };
      check();
    }
  },
  _cLoc: function () {
    if (typeof window !== "undefined") {
      if (typeof window.__NAVIGO_WINDOW_LOCATION_MOCK__ !== "undefined") {
        return window.__NAVIGO_WINDOW_LOCATION_MOCK__;
      }
      return clean(window.location.href);
    }
    return "";
  },
  _findLinks: function () {
    return [].slice.call(document.querySelectorAll("[data-navigo]"));
  },
  _onLocationChange: function () {
    this.resolve();
  },
  _callLeave: function _callLeave() {
    var lastRouteResolved = this._lastRouteResolved;

    if (
      lastRouteResolved &&
      lastRouteResolved.hooks &&
      lastRouteResolved.hooks.leave
    ) {
      lastRouteResolved.hooks.leave(lastRouteResolved.params);
    }
  }
};

Navigo.PARAMETER_REGEXP = /([:*])(\w+)/g;
Navigo.WILDCARD_REGEXP = /\*/g;
Navigo.REPLACE_VARIABLE_REGEXP = "([^/]+)";
Navigo.REPLACE_WILDCARD = "(?:.*)";
Navigo.FOLLOWED_BY_SLASH_REGEXP = "(?:/$|$)";
Navigo.MATCH_REGEXP_FLAGS = "";

function objectWithoutProperties (obj, exclude) { var target = {}; for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && exclude.indexOf(k) === -1) target[k] = obj[k]; return target; }
var Radi = typeof window !== 'undefined' ? window.Radi : Radi;

var version = '0.5.0';

var RouterAction = Radi.Action('Router Action');
var RouterStore = Radi.Store({
  meta: {},
  params: {},
  component: null,
  tags: [],
  title: '',
}).on(RouterAction, function (state, newState) {
  return Object.assign({}, state, newState);
});

var Title = {
  setText: Radi.Action('Router Set Title Text'),
  setPrefix: Radi.Action('Router Set Title'),
  setSuffix: Radi.Action('Router Set Title'),
  setSeparator: Radi.Action('Router Set Title'),
};
var TitleStore = Radi.Store({
  prefix: '',
  suffix: '',
  separator: '|',
  text: 'Radi',
})
  .on(Title.setText, function (state, text) { return Object.assign({}, state, { text: text }); })
  .on(Title.setPrefix, function (state, prefix) { return Object.assign({}, state, { prefix: prefix }); })
  .on(Title.setSuffix, function (state, suffix) { return Object.assign({}, state, { suffix: suffix }); })
  .on(Title.setSeparator, function (state, separator) { return Object.assign({}, state, { separator: separator }); });

TitleStore.subscribe(function (ref) {
  var prefix = ref.prefix;
  var suffix = ref.suffix;
  var separator = ref.separator;
  var text = ref.text;

  document.title = []
    .concat((text && prefix) ? [prefix, separator] : [prefix])
    .concat(text)
    .concat((text && suffix) ? [separator, suffix] : [suffix])
    .filter(function (item) { return !!item; })
    .join(' ');
});

var root$1 = null;
var useHash = false; // Defaults to: false
var hash = '#'; // Defaults to: '#'
var router = new Navigo(root$1, useHash, hash);

function getPath() {
  return router._cLoc().replace(router._getRoot(), '') || '/';
}

function Forbidden() {
  return 'Access Forbidden';
}

function NotFound() {
  return 'Not Found';
}

function spreadChildren(current, path, source) {
  if ( path === void 0 ) path = [];
  if ( source === void 0 ) source = {};

  return Object.keys(current).reduce(
    function (acc, key) {
      var obj;

      var item = current[key];
      var localPath = path.concat(key);
      var children = (item.children) ? spreadChildren(item.children, localPath, source) : {};

      if (item.children) {
        delete item.children;
      }

      return Object.assign(acc, ( obj = {}, obj[('/' + localPath.join('/')).replace(/\/\//g, '/')] = item, obj), children);
    },
    source
  );
}

function Setup(ref) {
  var routes = ref.routes;
  var beforeEach = ref.beforeEach;
  var afterEach = ref.afterEach;
  var title = ref.title; if ( title === void 0 ) title = {
    text: 'Radi',
    suffix: null,
    prefix: null,
    separator: null,
  };
  var ref_errors = ref.errors;
  var Custom404 = ref_errors[404]; if ( Custom404 === void 0 ) Custom404 = NotFound;
  var Custom403 = ref_errors[403]; if ( Custom403 === void 0 ) Custom403 = Forbidden;

  var spreadRoutes = spreadChildren(routes);
  var routeKeys = Object.keys(spreadRoutes);

  function checkAccess(done, routeConfig) {
    return function (response) {
      if (response === false) {
        RouterAction({
          params: routeConfig.params || {},
          meta: routeConfig.meta || {},
          tags: routeConfig.tags || [],
          title: routeConfig.title || '',
          component: Custom403,
        });
        return done(false);
      }
      return done(true);
    };
  }

  if (title.text) { Title.setText(title.text); }
  if (title.suffix) { Title.setSuffix(title.suffix); }
  if (title.prefix) { Title.setPrefix(title.prefix); }
  if (title.separator) { Title.setSeparator(title.separator); }

  router.notFound(function (params) {
    if ( params === void 0 ) params = {};

    return RouterAction({
      params: params,
      component: Custom404,
    });
  });

  router.hooks({
    before: function before(done, params) {
      var path = getPath();
      var m = router.helpers.match(path, router._routes);
      var mPath = m ? (m.route && m.route.route) : path;
      var routeConfig = Object.assign(
        {},
        routesConfig[mPath],
        { params: params }
      );

      if (typeof beforeEach === 'function') {
        return beforeEach(checkAccess(done, routeConfig), routeConfig);
      }

      return done();
    },
    after: function after(params) {
      window.scrollTo(0, 0);
      var path = getPath();
      if (typeof afterEach === 'function') {
        return afterEach({
          path: path,
          params: params,
        });
      }
    }
  });

  var routesConfig = {};

  routeKeys
    .reduce(function (accRouter, key) {
      var config = Object.assign({}, spreadRoutes[key], { params: {} });

      routesConfig[key] = config;

      return accRouter.on(
        key,
        function (params) {
          if ( params === void 0 ) params = {};

          var component = config.component();
          return RouterAction(Object.assign({}, config, {
            params: params,
            component: component,
          }));
        },
        {
          before: function before(done, params) {
            var path = getPath();
            var m = router.helpers.match(path, router._routes);
            var mPath = m ? (m.route && m.route.route) : path;
            var routeConfig = Object.assign(
              {},
              routesConfig[mPath],
              Object.assign({}, config.params, params)
            );

            if (typeof config.before === 'function') {
              return config.before(checkAccess(done, routeConfig), routeConfig);
            }

            return done();
          }
        }
      );
    }, router)
    .resolve();

  return router;
}

function RouterBody(ref) {
  var placeholder = ref.placeholder; if ( placeholder === void 0 ) placeholder = 'Loading..';

  var ref$1 = Radi.Watch(RouterStore);
  var component = ref$1.component;
  var title = ref$1.title;

  if (typeof title === 'string') {
    Title.setText(title);
  }

  if (title && typeof title === 'object') {
    if (title.text) { Title.setText(title.text); }
    if (title.suffix) { Title.setSuffix(title.suffix); }
    if (title.prefix) { Title.setPrefix(title.prefix); }
    if (title.separator) { Title.setSeparator(title.separator); }
  }

  if (component instanceof Promise) {
    return Radi.html(Radi.Await, {
      src: component,
      placeholder: placeholder,
    });
  }

  return component;
}

function navigate(e) {
  e.preventDefault();
  var route = e.target.getAttribute('href');

  router.navigate(route);
}

function Link(params) {
  var children = params.children;
  var onclick = params.onclick;
  var rest = objectWithoutProperties( params, ["children", "onclick"] );
  var restParams = rest;
  return Radi.html('a', Object.assign({}, restParams, {
    onclick: function (e) { return (navigate(e), typeof onclick === 'function' && onclick(e)); },
  }), children);
}

var index = {
  version: version,
  Title: Title,
  TitleStore: TitleStore,
  Setup: Setup,
  RouterStore: RouterStore,
  RouterBody: RouterBody,
  navigate: navigate,
  Link: Link,
};

exports.version = version;
exports.RouterStore = RouterStore;
exports.Title = Title;
exports.TitleStore = TitleStore;
exports.Setup = Setup;
exports.RouterBody = RouterBody;
exports.navigate = navigate;
exports.Link = Link;
exports.default = index;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=radi-router.js.map
