(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['radi-router'] = {})));
}(this, (function (exports) { 'use strict';

var version = '0.5.0';

// Pass routes to initiate things
var RadiRouter = function (ref, routes) {
  var h = ref.h;
  var Await = ref.Await;
  var Event = ref.Event;
  var Service = ref.Service;
  var Store = ref.Store;
  var customAttribute = ref.customAttribute;
  if ( routes === void 0 ) routes = [];

  if (!routes) {
    console.warn('[Radi:Router] Routes should be set as a second parameter');
  }
  var current = {};

  var COLON = ':'.charCodeAt(0);
  var SLASH = '/'.charCodeAt(0);
  var cr, crg, lr, ld;

  var parseRoute = function (route) {
    var parts = route.split('/'),
      end = [],
      p = [];
    for (var i = 0; i < parts.length; i++) {
      if (COLON === parts[i].charCodeAt(0)) {
        end.push('([^/]+?)');
        p.push(parts[i].substr(1));
      } else if (parts[i] !== '') {
        end.push(parts[i]);
      }
    }
    return [new RegExp('^/' + end.join('/') + '(?:[/])?(?:[?&].*)?$', 'i'), p];
  };

  var parseAllRoutes = function (arr) {
    var len = arr.length,
      ret = new Array(len);
    for (var i = len - 1; i >= 0; i--) {
      ret[i] = parseRoute(arr[i]);
    }
    return ret;
  };

  var renderError = function (number) {
    return current.config.errors[number]();
  };

  var writeUrl = function (url) {
    window.location.hash = url;
    return true;
  };

  var extractChildren = function (routes) {
    var children = routes;
    for (var child in routes) {
      if (routes.hasOwnProperty(child) && routes[child].children) {
        var extracted = extractChildren(routes[child].children);
        for (var nn in extracted) {
          if (extracted.hasOwnProperty(nn)) {
            children[child + nn] = extracted[nn];
          }
        }
      }
    }
    return children;
  };

  var getRoute = function (curr) {
    if (lr === curr) { return ld; }
    if (!cr) { cr = Object.keys(current.routes); }
    if (!crg) { crg = parseAllRoutes(cr); }
    var cahnged = false;

    for (var i = 0; i < crg.length; i++) {
      if (crg[i][0].test(curr)) {
        ld = new Route(curr, crg[i], current.routes, cr[i]);
        cahnged = true;
        break;
      }
    }

    lr = curr;
    return !cahnged ? { key: null } : ld;
  };

  var Route = function Route(curr, match, routes, key) {
    var query = curr
      .split(/[\?\&]/)
      .slice(1)
      .map(function (query) { return query.split('='); })
      .reduce(
        function (acc, key) {
            var obj;

            return Object.assign(acc, ( obj = {}, obj[key[0]] = key[1], obj));
    },
        {}
      );
    var m = curr.match(match[0]);
    this.path = curr;
    this.key = key;
    this.query = query;
    this.cmp = routes[key] || {};
    this.params = this.cmp.data || {};
    for (var i = 0; i < match[1].length; i++) {
      this.params[match[1][i]] = m[i + 1];
    }
  };

  var combineTitle = function () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return (
    args.reduce(function (a, v) { return (v ? a.concat(v) : a); }, [])
  );
  };


  var getHash = function () { return location.hash.substr(1) || '/'; };
  var getPath = function () { return decodeURI(location.pathname + location.search) || '/'; };

  var mode = routes.mode === 'hash'
    ? 'hash'
    : 'history';

  var routeUpdate = mode === 'hash'
    ? new Event(window, 'hashchange', function (e) { return getHash(); })(getHash())
    : new Event(window, 'popstate', function (e) { return getPath(); })(getPath());

  var RouterStore = new Store({
    route: routeUpdate,
    params: {},
    query: {},
    current: {
      title: null,
      tags: [],
      meta: {},
    },
    // location: locationState({ url: null, state: null }),
  }, null)
  .map(function (store, oldStore) {
    if ( oldStore === void 0 ) oldStore = {};

    var loc = mode === 'hash' ? getHash() : getPath();
    var a = getRoute(loc) || {};

    // console.log('[radi-router] Route change', a);

    window.scrollTo(0, 0);

    // this.resolve(this.inject(a.key || '', this.state.active))

    var title = a.cmp && a.cmp.title;
    var reHashed = store.route.split('#');

    Service.Title.set(title);

    return {
      route: reHashed[0].split(/[\?\&]/)[0],
      hash: reHashed[1],
      last: store.active,
      location: loc,
      params: a.params || {},
      query: a.query || {},
      active: a.key || '',
      current: {
        title: (typeof title === 'object') ? title : {
          text: title,
        } || null,
        tags: (a.cmp && a.cmp.tags) || [],
        meta: (a.cmp && a.cmp.meta) || {},
      },
    };
  });

  customAttribute('route', function (e, value) {
    if (mode === 'history') {
      e.onclick = function (ev) {
        ev.preventDefault();

        RouterStore.push(value);
      };
      e.href = value;
      return;
    }

    e.href = '#' + value;
  }, {
    addToElement: false,
  });

  customAttribute('href', function (e, value) {
    if (mode === 'history') {

      if (value[0] === '/' && value[1] !== '/') {
        e.onclick = function (ev) {
          ev.preventDefault();

          RouterStore.push(value);
        };
      }

      return value;
    }

    if (value[0] === '#') { return RouterStore.listener(function (ref) {
      var route = ref.route;

      return (
      '#' + route + value
    );
      }); }

    return '#' + value;
  }, {
    allowedTags: ['a'],
    addToElement: true,
  });

  function evalFn(fn) {
    if (typeof fn === 'function') { return evalFn(fn()); }
    if (typeof fn === 'object' && fn.default) { return evalFn(fn.default); }
    return fn;
  }

  // Triggers when route is changed
  function extractComponent(active, route, last) {
    // Route is not yet ready
    // For the future, maybe show cached page or default screen
    // or loading placeholder if time between this and next request
    // is too long
    if (active === null && typeof last === 'undefined') { return; }

    // const { active, last } = this.state
    var RouteComponent = current.routes[active] || current.routes[route];
    var WillRender =
      typeof RouteComponent === 'object'
        ? RouteComponent.component
        : RouteComponent;

    // Route not found or predefined error
    if (
      (typeof WillRender === 'undefined' ||
        typeof WillRender === 'number' ||
        !WillRender) &&
      typeof RouteComponent === 'undefined'
    )
      { return renderError(WillRender || 404); }

    // Plain redirect
    if (typeof RouteComponent.redirect === 'string')
      { return writeUrl(RouteComponent.redirect); }

    // Check if has any guards to check
    var guards = [
      current.before || null,
      RouteComponent.before || null ].filter(function (guard) { return typeof guard === 'function'; });

    if (guards.length > 0) {
      var checkGuard = function (resolve, reject) {
        var popped = guards.pop();

        if (typeof popped !== 'function') {
          return resolve(WillRender);
        }

        return popped(active, last, function (act) {
          // Render
          if (typeof act === 'undefined' || act === true) {
            if (guards.length > 0) {
              return checkGuard(resolve, reject);
            } else {
              return resolve(WillRender);
            }
          }

          if (act) {
            if (guards.length > 0) {
              return checkGuard(resolve, reject);
            } else {
              return resolve(act);
            }
          }

          // Redirect
          // if (typeof act === 'string' && act.charCodeAt(0) === SLASH) {
          //   reject();
          //   return writeUrl(act);
          // }

          // Restricted
          return resolve(renderError(403));
        }, RouterStore.get());
      };

      // return h('div', {}, h('await', {src: new Promise(checkGuard)}));
      return new Promise(checkGuard);
    }

    // Route is plain text/object
    return WillRender;
  }

  // Components
  function RouterBody(ref) {
    var placeholder = ref.placeholder;
    var waitMs = ref.waitMs;

    var ref$1 = RouterStore.state;
    var route = ref$1.route;
    var active = ref$1.active;
    var last = ref$1.last;

    var src = new Promise(function (resolve) {
      var evaluated = evalFn(extractComponent(active, route, last));

      if (evaluated instanceof Promise) {
        evaluated.then(resolve);
      } else {
        resolve(evaluated);
      }
    });

    return h(Await, { src: src, placeholder: placeholder, waitMs: waitMs });
  }

  function QueryToUrl(query) {
    var url = '';
    var n = url.split('?').length - 1;
    for (var i in query) {
      if (typeof query[i] !== 'undefined') {
        url = url.concat(((!n) ? '?' : '&') + i + '=' + query[i]);
        n += 1;
      }
    }
    return url;
  }

  RouterStore.push = function push(url) {
    if (url[0] === '/' && url[1] !== '/') {
      history.pushState(null, null, url);
      routeUpdate.dispatch(getPath);
    }
  };

  RouterStore.query = function push(data) {
    var state = RouterStore.get();
    var url = state.location.split(/[\?\&]/)[0];

    var search = (typeof data === 'function')
      ? QueryToUrl(data(state.query))
      : QueryToUrl(data);

    RouterStore.push(url + search);
  };

  RouterStore.replace = function replace(url) {
    if (url[0] === '/' && url[1] !== '/') {
      history.replaceState(null, null, url);
      routeUpdate.dispatch(getPath);
    }
  };

  var titleState = new Store({
    prefix: null,
    text: null,
    suffix: 'Radi.js',
    seperator: ' | ',
  }, null);

  var Title = function Title() {
    this.onUpdate = this.onUpdate.bind(this);
    titleState.subscribe(this.onUpdate);
  };

  Title.prototype.setPrefix = function setPrefix (prefix) {
    return titleState.dispatch(function (state, prefix) { return (Object.assign({}, state, {prefix: prefix})); }, prefix);
  };

  Title.prototype.setSuffix = function setSuffix (suffix) {
    return titleState.dispatch(function (state, suffix) { return (Object.assign({}, state, {suffix: suffix})); }, suffix);
  };

  Title.prototype.set = function set (text) {
    return titleState.dispatch(function (state, text) { return (Object.assign({}, state, {text: text})); }, text);
  };

  Title.prototype.setSeperator = function setSeperator (seperator) {
    return titleState.dispatch(function (state, seperator) { return (Object.assign({}, state, {seperator: seperator})); }, seperator);
  };

  Title.prototype.onUpdate = function onUpdate (state) {
    var titleConfig = state || {};

    var pefix = (routes.title && routes.title.prefix) || titleConfig.prefix;
    var text = titleConfig.text || (routes.title && routes.title.text) || titleConfig.text;
    var suffix = (routes.title && routes.title.suffix) || titleConfig.suffix;

    var title = combineTitle(
      pefix,
      text,
      suffix
    ).join(titleConfig.seperator);

    if (title && document.title !== title) {
      document.title = title;
    }

    if (titleConfig.text && text !== titleConfig.text) {
      this.set(null);
    }
  };

  var before = routes.beforeEach;
  var after = routes.afterEach;

  var getError = function (code, fallback) {
    var error = routes.errors && routes.errors[code];

    if (error) {
      return typeof error === 'function' ? error : function () { return error; };
    }

    return fallback;
  };

  current = {
    config: {
      errors: {
        404: getError(404, function () { return h('div', {}, 'Error 404: Not Found'); }),
        403: getError(403, function () { return h('div', {}, 'Error 403: Forbidden'); }),
      },
    },
    before: before,
    after: after,
    routes: extractChildren(routes.routes),
    write: writeUrl,
    Router: RouterBody,
  };

  // Initiates router store
  Service.add('Router', function () { return RouterStore; });

  // Initiates title plugin
  Service.add('Title', function () { return new Title(); });

  // Initiates router body component
  Service.add('RouterBody', function () { return RouterBody; });

  return current;
};

if (window) { window.RadiRouter = RadiRouter; }

exports.version = version;
exports.default = RadiRouter;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=radi-router.js.map
