export const version = '0.5.0';

// Pass routes to initiate things
const RadiRouter = ({
    h,
    Await,
    Event,
    Service,
    Store,
    customAttribute,
  }, routes = []) => {
  if (!routes) {
    console.warn('[Radi:Router] Routes should be set as a second parameter');
  }
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


  const getHash = () => location.hash.substr(1) || '/';
  const getPath = () => decodeURI(location.pathname + location.search) || '/';

  const mode = routes.mode === 'hash'
    ? 'hash'
    : 'history';

  const routeUpdate = mode === 'hash'
    ? new Event(window, 'hashchange', e => getHash())(getHash())
    : new Event(window, 'popstate', e => getPath())(getPath());

  const RouterStore = new Store({
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
  .map((store, oldStore = {}) => {
    var loc = mode === 'hash' ? getHash() : getPath();
    var a = getRoute(loc) || {};

    // console.log('[radi-router] Route change', a);

    window.scrollTo(0, 0);

    // this.resolve(this.inject(a.key || '', this.state.active))

    let title = a.cmp && a.cmp.title;
    const reHashed = store.route.split('#');

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

  customAttribute('route', (e, value) => {
    if (mode === 'history') {
      e.onclick = (ev) => {
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

  customAttribute('href', (e, value) => {
    if (mode === 'history') {

      if (value[0] === '/' && value[1] !== '/') {
        e.onclick = (ev) => {
          ev.preventDefault();

          RouterStore.push(value);
        };
      }

      return value;
    }

    if (value[0] === '#') return RouterStore.listener(({route}) => (
      '#' + route + value
    ));

    return '#' + value;
  }, {
    allowedTags: ['a'],
    addToElement: true,
  });

  function evalFn(fn) {
    if (typeof fn === 'function') return evalFn(fn());
    if (typeof fn === 'object' && fn.default) return evalFn(fn.default);
    return fn;
  }

  // Triggers when route is changed
  function extractComponent(active, route, last) {
    // Route is not yet ready
    // For the future, maybe show cached page or default screen
    // or loading placeholder if time between this and next request
    // is too long
    if (active === null && typeof last === 'undefined') return;

    // const { active, last } = this.state
    const RouteComponent = current.routes[active] || current.routes[route];
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

        return popped(active, last, act => {
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
  function RouterBody({ placeholder, waitMs }) {
    const { route, active, last } = RouterStore.state;

    const src = new Promise(resolve => {
      const evaluated = evalFn(extractComponent(active, route, last));

      if (evaluated instanceof Promise) {
        evaluated.then(resolve);
      } else {
        resolve(evaluated);
      }
    });

    return h(Await, { src, placeholder, waitMs });
  }

  function QueryToUrl(query) {
    let url = '';
    let n = url.split('?').length - 1
    for (let i in query) {
      if (typeof query[i] !== 'undefined') {
        url = url.concat(((!n) ? '?' : '&') + i + '=' + query[i])
        n += 1
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
    const state = RouterStore.get();
    const url = state.location.split(/[\?\&]/)[0];

    const search = (typeof data === 'function')
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

  const titleState = new Store({
    prefix: null,
    text: null,
    suffix: 'Radi.js',
    seperator: ' | ',
  }, null);

  class Title {
    constructor() {
      this.onUpdate = this.onUpdate.bind(this);
      titleState.subscribe(this.onUpdate);
    }

    setPrefix(prefix) {
      return titleState.dispatch((state, prefix) => ({ ...state, prefix }), prefix);
    }

    setSuffix(suffix) {
      return titleState.dispatch((state, suffix) => ({ ...state, suffix }), suffix);
    }

    set(text) {
      return titleState.dispatch((state, text) => ({ ...state, text }), text);
    }

    setSeperator(seperator) {
      return titleState.dispatch((state, seperator) => ({ ...state, seperator }), seperator);
    }

    onUpdate(state) {
      let titleConfig = state || {};

      let pefix = (routes.title && routes.title.prefix) || titleConfig.prefix;
      let text = titleConfig.text || (routes.title && routes.title.text) || titleConfig.text;
      let suffix = (routes.title && routes.title.suffix) || titleConfig.suffix;

      let title = combineTitle(
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
        404: getError(404, () => h('div', {}, 'Error 404: Not Found')),
        403: getError(403, () => h('div', {}, 'Error 403: Forbidden')),
      },
    },
    before,
    after,
    routes: extractChildren(routes.routes),
    write: writeUrl,
    Router: RouterBody,
  };

  // Initiates router store
  Service.add('Router', () => RouterStore);

  // Initiates title plugin
  Service.add('Title', () => new Title());

  // Initiates router body component
  Service.add('RouterBody', () => RouterBody);

  return current;
};

if (window) window.RadiRouter = RadiRouter;
export default RadiRouter;
