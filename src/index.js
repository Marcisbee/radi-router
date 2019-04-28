import Navigo from './navigo';

const Radi = typeof window !== 'undefined' ? window.Radi : Radi;

const version = '0.5.0';

const RouterAction = Radi.action('Router Action');
const RouterStore = Radi.store({
  path: '/',
  meta: {},
  params: {},
  component: null,
  tags: [],
  title: '',
}).on(RouterAction, (state, newState) => {
  return Object.assign({}, state, newState);
});

const Title = {
  setText: Radi.action('Router Set Title Text'),
  setPrefix: Radi.action('Router Set Title'),
  setSuffix: Radi.action('Router Set Title'),
  setSeparator: Radi.action('Router Set Title'),
};
const TitleStore = Radi.store({
  prefix: '',
  suffix: '',
  separator: '|',
  text: 'Radi',
})
  .on(Title.setText, (state, text) => Object.assign({}, state, { text }))
  .on(Title.setPrefix, (state, prefix) => Object.assign({}, state, { prefix }))
  .on(Title.setSuffix, (state, suffix) => Object.assign({}, state, { suffix }))
  .on(Title.setSeparator, (state, separator) => Object.assign({}, state, { separator }));

TitleStore.subscribe(({ prefix, suffix, separator, text }) => {
  document.title = []
    .concat((text && prefix) ? [prefix, separator] : [prefix])
    .concat(text)
    .concat((text && suffix) ? [separator, suffix] : [suffix])
    .filter((item) => !!item)
    .join(' ');
});

const root = null;
const useHash = false; // Defaults to: false
const hash = '#'; // Defaults to: '#'
const router = new Navigo(root, useHash, hash);

function getPath() {
  return router._cLoc().replace(router._getRoot(), '') || '/';
}

function Forbidden() {
  return 'Access Forbidden';
}

function NotFound() {
  return 'Not Found';
}

function spreadChildren(current, path = [], source = {}) {
  return Object.keys(current).reduce(
    (acc, key) => {
      const item = current[key];
      const localPath = path.concat(key);
      const children = (item.children) ? spreadChildren(item.children, localPath, source) : {};

      if (item.children) {
        delete item.children;
      }

      return Object.assign(acc, { [('/' + localPath.join('/')).replace(/\/\//g, '/')]: item }, children);
    },
    source,
  );
}

function Setup({
  routes,
  beforeEach,
  afterEach,
  title = {
    text: 'Radi',
    suffix: null,
    prefix: null,
    separator: null,
  },
  errors: {
    404: Custom404 = NotFound,
    403: Custom403 = Forbidden,
  },
}) {
  const spreadRoutes = spreadChildren(routes);
  const routeKeys = Object.keys(spreadRoutes);

  function checkAccess(done, routeConfig) {
    return response => {
      if (response === false) {
        RouterAction({
          path: routeConfig.path || '/',
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

  if (title.text) Title.setText(title.text);
  if (title.suffix) Title.setSuffix(title.suffix);
  if (title.prefix) Title.setPrefix(title.prefix);
  if (title.separator) Title.setSeparator(title.separator);

  router.notFound((params = {}) => {
    return RouterAction({
      params,
      component: Custom404,
    });
  });

  router.hooks({
    before(done, params) {
      const path = getPath();
      const m = router.helpers.match(path, router._routes);
      const mPath = m ? (m.route && m.route.route) : path;
      const routeConfig = Object.assign(
        {
          path: mPath,
        },
        routesConfig[mPath],
        { params },
      );

      if (typeof beforeEach === 'function') {
        return beforeEach(checkAccess(done, routeConfig), routeConfig);
      }

      return done();
    },
    after(params) {
      window.scrollTo(0, 0);
      const path = getPath();
      if (typeof afterEach === 'function') {
        return afterEach({
          path,
          params,
        });
      }
    }
  });

  const routesConfig = {};

  routeKeys
    .reduce((accRouter, key) => {
      const config = Object.assign({}, spreadRoutes[key], { path: key, params: {} });

      routesConfig[key] = config;

      return accRouter.on(
        key,
        (params = {}) => {
          const component = config.component();
          return RouterAction(Object.assign({}, config, {
            params,
            component,
          }));
        },
        {
          before(done, params) {
            const path = getPath();
            const m = router.helpers.match(path, router._routes);
            const mPath = m ? (m.route && m.route.route) : path;
            const routeConfig = Object.assign(
              {
                path: mPath,
              },
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

function RouterBody({ placeholder = 'Loading..' }) {
  const { component, title } = Radi.watch(RouterStore);

  if (typeof title === 'string') {
    Title.setText(title);
  }

  if (title && typeof title === 'object') {
    if (title.text) Title.setText(title.text);
    if (title.suffix) Title.setSuffix(title.suffix);
    if (title.prefix) Title.setPrefix(title.prefix);
    if (title.separator) Title.setSeparator(title.separator);
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
  const route = e.target.getAttribute('href');

  router.navigate(route);
}

function Link(params) {
  const { children, onclick, active = 'strict', ...restParams } = params;

  return Radi.html('a', Object.assign({}, restParams, {
    onclick: (e) => (navigate(e), typeof onclick === 'function' && onclick(e)),
    onmount: (a) => {
      if (!active || active === 'none') return false;

      const link = a.target;
      RouterStore.subscribe((state) => {
        if (
          (active === 'loose' && new RegExp('^' + params.href).test(state.path)) ||
          (active === 'strict' && params.href === state.path)
        ) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    },
  }), children);
}

export default {
  version,
  Title,
  TitleStore,
  Setup,
  RouterStore,
  RouterBody,
  Body: RouterBody,
  navigate: router.navigate,
  Link,
};
