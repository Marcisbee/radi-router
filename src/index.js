export const version = '0.3.27';

// Pass routes to initiate things
export default ({
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
      this.cmp = routes[key] || {};
      this.params = this.cmp.data || {};
      for (var i = 0; i < match[1].length; i++) {
        this.params[match[1][i]] = m[i + 1];
      }
    }
  }

  const combineTitle = (...args) => (
    args.reduce((a, v) => (v ? a.concat(v) : a), [])
  );

  class Title extends Component {
    state() {
      return {
        prefix: null,
        text: null,
        suffix: null,
        seperator: ' | ',
      };
    }

    setPrefix(prefix) {
      return this.setState({prefix});
    }

    setSuffix(suffix) {
      return this.setState({suffix});
    }

    set(text) {
      return this.setState({text});
    }

    setSeperator(seperator) {
      return this.setState({seperator});
    }

    on() {
      return {
        update() {
          let titleConfig = this.$router.getTitle() || {};

          let pefix = (routes.title && routes.title.prefix) || this.state.prefix;
          let text = titleConfig.text || (routes.title && routes.title.text) || this.state.text;
          let suffix = (routes.title && routes.title.suffix) || this.state.suffix;

          let title = combineTitle(
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
        },
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
        activeComponent: null,
        current: {
          title: null,
          tags: [],
          meta: {},
        },
      };
    }

    on() {
      return {
        mount() {
          window.onhashchange = () => (this.setState(this.hashChange()), this.chain());
          this.setState(this.hashChange());
          this.chain();
        }
      }
    }

    chain() {
      this.trigger('changed', this.state.active || '', this.state.last);
    }

    hashChange() {
      var loc = window.location.hash.substr(1) || '/';
      var a = getRoute(loc);

      // console.log('[radi-router] Route change', a, this.state.location);

      window.scrollTo(0, 0);

      // this.resolve(this.inject(a.key || '', this.state.active))

      let title = a.cmp && a.cmp.title;

      return {
        last: this.state.active,
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
      }
    }

    hasTag(...tag) {
      return tag.reduce((acc, t) => acc || (this.state.current.tags.indexOf(t) >= 0), false);
    }

    getMeta() {
      return this.state.current.meta || {};
    }

    getTitle() {
      let title = this.state.current.title;

      return title;
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

    state() {
      return {
        active: null,
      }
    }

    on() {
      return {
        mount() {
          this.setState({active: this.$router.state.active});
          this.$router.when('changed', (active, last) => {
            this.setState({active});
          });
        }
      }
    }

    view() {
      // return [
      //   l(this.$router, 'active').process(() => r('div', {}, this.inject(this.$router.state))),
      //   ...this.children,
      // ];
      return [
        l(this, 'active').process(comp => this.extractComponent(comp)),
        this.children,
      ]
      // return r(
      //   'template',
      //   {},
      //   l(this, 'active').process(comp => this.extractComponent(comp)),
      //   this.children,
      // );
      // return [
      //   l(this.$router, 'activeComponent').process(comp => comp),
      //   this.children,
      // ]
      // return r(
      //   'template',
      //   {},
      //   l(this.$router, 'activeComponent').process(comp => comp),
      //   this.children,
      // );
    }

    // Triggers when route is changed
    extractComponent(active, last) {
      // Route is not yet ready
      // For the future, maybe show cached page or default screen
      // or loading placeholder if time between this and next request
      // is too long
      if (active === null && typeof last === 'undefined') return;

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
      const guards = [
        current.before || null,
        RouteComponent.before || null,
      ].filter(guard => typeof guard === 'function');

      if (guards.length > 0) {
        const checkGuard = (resolve, reject) => {
          const popped = guards.pop();

          if (typeof popped !== 'function') {
            return resolve(WillRender);
          }

          return popped.call(this, active, last, act => {
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

        return () => new Promise(checkGuard);
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

  const before = routes.beforeEach;
  const after = routes.afterEach;

  const getError = (code, fallback) => {
    let error = routes.errors && routes.errors[code];

    if (error) {
      return typeof error === 'function' ? error : () => error;
    }

    return fallback;
  };

  current = {
    config: {
      errors: {
        404: getError(404, () => r('div', {}, 'Error 404: Not Found')),
        403: getError(403, () => r('div', {}, 'Error 403: Forbidden')),
      },
    },
    before,
    after,
    routes: extractChildren(routes.routes),
    write: writeUrl,
    Link,
    Router,
  };

  // Initiates router component
  headless('router', RouterHead);

  // Initiates title component
  headless('title', Title);

  return current;
};
