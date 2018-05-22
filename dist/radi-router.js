(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['radi-router'] = {})));
}(this, (function (exports) { 'use strict';

const version = '0.3.5';

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

  const guard = (before, comp, active, last, resolve, reject, deep, _router) => {
    return before.call(_router, active, last, act => {
      if (typeof act === 'undefined' || act === true) {
        if (typeof deep === 'function') {
          return guard(deep, comp, active, last, resolve, reject, null, _router);
        } else {
          resolve(comp);
        }
      } else if (typeof act === 'string' && act.charCodeAt(0) === SLASH) {
        writeUrl(act);
        return reject();
      } else {
        resolve(renderError(403));
      }

      // Fire afterEach event in routes
      if (current.after) current.after(active, last);
    });
  };

  const extractChildren = routes => {
    let children = routes;
    for (let child in routes) {
      if (routes.hasOwnProperty(child) && routes[child].children) {
        let extracted = extractChildren(routes[child].children);
        for (var nn in extracted) {
          if (extracted.hasOwnProperty(nn)) {
            children[child + nn] = extracted[nn];
          }
        }
      }
    }
    return children;
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
        active: null,
        activeComponent: null
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

      // console.log('[radi-router] Route change', a, this.state.location);

      window.scrollTo(0, 0);

      this.resolve(this.inject(a.key || '', this.state.active));

      return {
        last: this.state.active,
        location: loc,
        params: a.params || {},
        query: a.query || {},
        active: a.key || '',
      }
    }

    resolve(pulse) {
      if (typeof pulse === 'function' && pulse.isComponent) {
        return this.resolve(r(pulse))
      }

      if (typeof pulse === 'function') {
        return this.resolve(pulse())
      }

      if (pulse instanceof Promise) {
        return pulse.then(() => {}).catch(console.warn)
      }

      this.setState({
        activeComponent: pulse,
      });
    }

    // Triggers when route is changed
    inject(active, last) {
      // const { active, last } = this.state
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
            const middleResolve = type => comp => {
              if (comp && comp.default) {
                this.setState({
                  activeComponent: comp.default,
                });
              } else {
                this.setState({
                  activeComponent: comp,
                });
              }
              type(comp);
            };
            // Global guard
            if (typeof current.before === 'function') {
              guard(
                current.before,
                WillRender,
                active,
                last,
                middleResolve(resolve),
                middleResolve(reject),
                RouteComponent.before,
                this
              );
            } else if (typeof RouteComponent.before === 'function') {
              guard(
                RouteComponent.before,
                WillRender,
                active,
                last,
                middleResolve(resolve),
                middleResolve(reject),
                null,
                this
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
  }

  class Link extends Component {
    state() {
      return {
        to: '/',
        active: 'active',
        core: false,
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
              l(this, 'class').process(cls => ([
                (active === to || (this.state.core && new RegExp('^' + to).test(active)))
                  && this.state.active,
                cls
              ]))
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

    view() {
      // return [
      //   l(this.$router, 'active').process(() => r('div', {}, this.inject(this.$router.state))),
      //   ...this.children,
      // ];
      return r(
        'template',
        {},
        l(this.$router, 'activeComponent').process(comp => comp),
        this.children,
      );
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
    routes: extractChildren(routes.routes),
    write: writeUrl,
    Link,
    Router
  };

  // Initiates router component
  headless('router', RouterHead);

  return current;
};

exports.version = version;
exports.default = index;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=radi-router.js.map
