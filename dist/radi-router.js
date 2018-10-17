(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['radi-router'] = {})));
}(this, (function (exports) { 'use strict';

var version = '0.5.0';

// Pass routes to initiate things
var RadiRouter = function (ref, routes) {
  var h = ref.h;
  var l = ref.l;
  var patch = ref.patch;
  var Service = ref.Service;
  var Store = ref.Store;
  var customAttribute = ref.customAttribute;

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
    console.log(current, routes);
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
    var this$1 = this;

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
      this$1.params[match[1][i]] = m[i + 1];
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

  var hashChange = new Subscribe(window).on('hashchange', function (e) { return ({ hash: getHash() }); });

  // const locationState = new Subscribe(window).on('popstate', e => ({
  //   url: document.location.pathname,
  //   state: e.state,
  // }))

  var RouterStore = new Store({
    route: hashChange({ hash: getHash() }).map(function (ref) {
      var hash = ref.hash;

      return hash;
  }),
    params: {},
    query: {},
    current: {
      title: null,
      tags: [],
      meta: {},
    },
    // location: locationState({ url: null, state: null }),
  })
  .map(function (store, oldStore) {
    if ( oldStore === void 0 ) oldStore = {};

    var loc = window.location.hash.substr(1) || '/';
    var a = getRoute(loc) || {};

    // console.log('[radi-router] Route change', a);

    window.scrollTo(0, 0);

    // this.resolve(this.inject(a.key || '', this.state.active))

    var title = a.cmp && a.cmp.title;
    var reHashed = store.route.split('#');

    return {
      route: reHashed[0],
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

  customAttribute('href', function (e, value) {
    if (value[0] === '#') { return RouterStore(function (ref) {
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
    return fn;
  }

  // Triggers when route is changed
  function extractComponent(active, last) {
    // Route is not yet ready
    // For the future, maybe show cached page or default screen
    // or loading placeholder if time between this and next request
    // is too long
    if (active === null && typeof last === 'undefined') { return; }

    // const { active, last } = this.state
    var RouteComponent = current.routes[active];
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
        });
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

    // const self = this;
    // this.onMount = (e) => {
    //
    //   console.log(e, e.parentElement)
    //   patch(e.parentElement, RouterStore(({active}) => extractComponent(active)), null, 0, e);
    // };
    // return h('router');

    // return h('router', {}, [
    //   active,
    // ]);
    // return h(new Promise(e => e(RouteComponent.component)));
    return RouterStore(function (ref) {
      var active = ref.active;
      var route = ref.route;

      var src = new Promise(function (resolve) {
        var evaluated = evalFn(extractComponent(route));

        if (evaluated instanceof Promise) {
          evaluated.then(function (e) { return resolve(evalFn(e)); });
        } else {
          resolve(evaluated);
        }
      });
      return h('await', { src: src, placeholder: placeholder, waitMs: waitMs });
    });
  }

  var titleState = new Store({
    prefix: null,
    text: null,
    suffix: null,
    seperator: ' | ',
  });

  var setPrefix = function (state, prefix) { return ({prefix: prefix}); };
  var setSuffix = function (state, suffix) { return ({suffix: suffix}); };
  var setText = function (state, text) { return ({text: text}); };
  var setSeperator = function (state, seperator) { return ({seperator: seperator}); };

  var Title = function Title() {
    this.state = titleState;
  };

  Title.prototype.setPrefix = function setPrefix$1 (prefix) {
    return titleState.dispatch(setPrefix, prefix);
  };

  Title.prototype.setSuffix = function setSuffix$1 (suffix) {
    return titleState.dispatch(setSuffix, suffix);
  };

  Title.prototype.set = function set (text) {
    return titleState.dispatch(setText, text);
  };

  Title.prototype.setSeperator = function setSeperator$1 (seperator) {
    return titleState.dispatch(setSeperator, seperator);
  };

  Title.prototype.onUpdate = function onUpdate () {
    var titleConfig = this.$router.getTitle() || {};

    var pefix = (routes.title && routes.title.prefix) || this.state.prefix;
    var text = titleConfig.text || (routes.title && routes.title.text) || this.state.text;
    var suffix = (routes.title && routes.title.suffix) || this.state.suffix;

    var title = combineTitle(
      pefix,
      text,
      suffix
    ).join(this.state.seperator);

    if (title && document.title !== title) {
      document.title = title;
    }

    if (this.state.text && text !== this.state.text) {
      this.set(null);
    }
  };

  // function Link(props) {
  //   const {
  //     href = '/',
  //     active = 'active',
  //     core = false,
  //     children,
  //   } = props;

  //   return (
  //     h('a',
  //       {
  //         ...props,
  //         href,
  //         class: [
  //           (active === to || (this.state.core && new RegExp('^' + to).test(active)))
  //             && this.state.active
  //           props.class, active],
  //       },
  //       children,
  //     )
  //   )
  // }

  // class Link extends Component {
  //   constructor(...args) {
  //     super(...args);
  //     this.state = {
  //       to: '/',
  //       active: 'active',
  //       core: false,
  //       class: '',
  //       id: null,
  //       title: null,
  //     };
  //   }
  //   view() {
  //     return r(
  //       'a',
  //       {
  //         href: l(this, 'to').process(url => '#'.concat(url)),
  //         class: l(this, 'to').process(to =>
  //           l(this.$router, 'active').process(active =>
  //             l(this, 'class').process(cls => ([
  //               (active === to || (this.state.core && new RegExp('^' + to).test(active)))
  //                 && this.state.active,
  //               cls
  //             ]))
  //           )
  //         ),
  //         id: l(this, 'id'),
  //         title: l(this, 'title'),
  //       },
  //       ...this.children
  //     );
  //   }
  // }

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
    // Link,
    Router: RouterBody,
  };

  // Initiates router store
  Service.add('routerStore', function () { return RouterStore; });

  // Initiates title plugin
  Service.add('Title', function () { return new Title(); });

  // Initiates router body component
  Service.add('Router', function () { return RouterBody; });

  return current;
};

if (window) { window.RadiRouter = RadiRouter; }

exports.version = version;
exports.default = RadiRouter;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=radi-router.js.map
