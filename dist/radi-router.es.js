const version = '0.3.1';

// Pass routes to initiate things
var index = ({
    r,
    l,
    mount,
    headless,
    Component,
  }, routes) => {
  let current = {};

  const COLON = ':'.charCodeAt(0);
  const SLASH = '/'.charCodeAt(0);
  var cr, crg, lr, ld;

  const parseRoute = route => {
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

  const parseAllRoutes = arr => {
    var len = arr.length,
      ret = new Array(len);
    for (var i = len - 1; i >= 0; i--) {
      ret[i] = parseRoute(arr[i]);
    }
    return ret;
  };

  const renderError = number => {
    return current.config.errors[number]();
  };

  const writeUrl = url => {
    window.location.hash = url;
    return true;
  };

  const guard = (before, comp, active, last, resolve, reject, deep) => {
    return before(active, last, act => {
      if (typeof act === 'undefined' || act === true) {
        if (typeof deep === 'function') {
          return guard(deep, comp, active, last, resolve, reject, null);
        } else {
          resolve({ default: comp });
        }
      } else if (typeof act === 'string' && act.charCodeAt(0) === SLASH) {
        writeUrl(act);
        return reject();
      } else {
        resolve({ default: renderError(403) });
      }

      // Fire afterEach event in routes
      if (current.after) current.after(active, last);
    });
  };

  const getRoute = curr => {
    if (lr === curr) return ld;
    if (!cr) cr = Object.keys(current.routes);
    if (!crg) crg = parseAllRoutes(cr);
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

  class Route {
    constructor(curr, match, routes, key) {
      const query = curr
        .split(/[\?\&]/)
        .slice(1)
        .map(query => query.split('='))
        .reduce(
          (acc, key) =>
            Object.assign(acc, {
              [key[0]]: key[1]
            }),
          {}
        );
      var m = curr.match(match[0]);
      this.path = curr;
      this.key = key;
      this.query = query;
      this.cmp = routes[key];
      this.params = this.cmp.data || {};
      for (var i = 0; i < match[1].length; i++) {
        this.params[match[1][i]] = m[i + 1];
      }
    }
  }

  class RouterHead extends Component {
    state() {
      return {
        location: window.location.hash.substr(1) || '/',
        params: {},
        query: {},
        last: null,
        active: null
      };
    }

    on() {
      return {
        mount() {
          window.onhashchange = () => this.setState(this.hashChange());
          this.setState(this.hashChange());
        }
      }
    }

    hashChange() {
      var loc = window.location.hash.substr(1) || '/';
      var a = getRoute(loc);

      console.log('[radi-router] Route change', a, this.state.location);

      return {
        last: this.state.active,
        location: loc,
        params: a.params || {},
        query: a.query || {},
        active: a.key || '',
      }
    }
  }

  class Link extends Component {
    state() {
      return {
        to: '/',
        active: 'active',
        class: '',
        id: null,
        title: null,
      };
    }
    view() {
      return r(
        'a',
        {
          href: l(this, 'to').process(url => '#'.concat(url)),
          class: l(this, 'to').process(to =>
            l(this.$router, 'active').process(active =>
              l(this, 'class').process(cls =>
                ((active === to ? 'active' : '') + ' ' + cls))
            )
          ),
          id: l(this, 'id'),
          title: l(this, 'title'),
        },
        ...this.children
      );
    }
  }

  class Router extends Component {
    // Triggers when route is changed
    inject({ active, last }) {
      const RouteComponent = current.routes[active];
      const WillRender =
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
        return renderError(WillRender || 404);

      // Plain redirect
      if (typeof RouteComponent.redirect === 'string')
        return writeUrl(RouteComponent.redirect);

      // Check if has any guards to check
      if (
        typeof current.before === 'function' ||
        typeof RouteComponent.before === 'function'
      ) {
        return () =>
          new Promise((resolve, reject) => {
            // Global guard
            if (typeof current.before === 'function') {
              guard(
                current.before,
                WillRender,
                active,
                last,
                resolve,
                reject,
                RouteComponent.before
              );
            } else if (typeof RouteComponent.before === 'function') {
              guard(
                RouteComponent.before,
                WillRender,
                active,
                last,
                resolve,
                reject,
                null
              );
            }
          });
      }

      if (typeof WillRender === 'function') {
        // Route is component
        if (WillRender.isComponent && WillRender.isComponent())
          return r(WillRender);

        // Route is plain function
        return WillRender;
      }

      // Route is plain text/object
      return WillRender;
    }

    view() {
      return [
        l(this.$router, 'active').process(() => this.inject(this.$router.state)),
        ...this.children,
      ];
      // return r(
      //   'template',
      //   {},
      //   l(this.$router, 'active').process(() => this.inject(this.$router.state)),
      //   ...this.children,
      // );
    }
  }

  const before = routes.beforeEach;
  const after = routes.afterEach;

  current = {
    config: {
      errors: {
        404: () => r('div', {}, 'Error 404: Not Found'),
        403: () => r('div', {}, 'Error 403: Forbidden')
      }
    },
    before,
    after,
    routes: routes.routes,
    write: writeUrl,
    Link,
    Router
  };

  // Initiates router component
  headless('router', RouterHead);

  return current;
};

export default index;
export { version };
//# sourceMappingURL=radi-router.es.js.map
