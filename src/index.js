/** @jsx r **/
const { r, l, mount, headless, addComms, component } = require('../../radi').default
let current = {}

export const version = '0.2.0'
var radi

const COLON = ':'.charCodeAt(0)
var cr, crg, lr, ld

function parseRoute(route) {
	var parts = route.split('/'), end = [], p = []
	for (var i = 0; i < parts.length; i++) {
		if (COLON === parts[i].charCodeAt(0)) {
			end.push('([^\/]+?)')
			p.push(parts[i].substr(1))
		} else if (parts[i] !== '') {
			end.push(parts[i])
		}
	}
	return [new RegExp('^/' + end.join('/') + '(?:[\/])?(?:[?&].*)?$', 'i'), p]
}

function parseAllRoutes(arr) {
	var len = arr.length, ret = new Array(len)
	for (var i = len - 1; i >= 0; i--) {
		ret[i] = parseRoute(arr[i])
	}
	return ret
}

class Route {
	constructor(curr, match, routes, key) {
		const query = curr.split(/[\?\&]/)
			.slice(1)
			.map(query => query.split('='))
			.reduce((acc, key) => Object.assign(acc, {
				[key[0]]: key[1],
			}), {})
		var m = curr.match(match[0])
		this.path = curr
		this.key = key
		this.query = query
		this.params = {}
		for (var i = 0; i < match[1].length; i++) {
			this.params[match[1][i]] = m[i + 1]
		}
		this.cmp = routes[key]
	}
}

const getRoute = (curr) => {
	if (lr === curr) return ld
	if (!cr) cr = Object.keys(current.routes)
	if (!crg) crg = parseAllRoutes(cr)
	var cahnged = false

	for (var i = 0; i < crg.length; i++) {
		if (crg[i][0].test(curr)) {
			ld = new Route(curr, crg[i], current.routes, cr[i])
			cahnged = true
			break
		}
	}

	lr = curr
	return (!cahnged) ? {key: null} : ld
}


const RouterHead = component({
	name: 'HeadlessRouter',
  state: {
    location: window.location.hash.substr(1) || '/',
    params: {},
    query: {},
    last: null,
    active: null,
  },
  actions: {

    onMount(state) {
      window.onhashchange = () => this.hashChange(state)
      this.hashChange(state)
    },

    hashChange(state) {
			state.last = state.active
      state.location = window.location.hash.substr(1) || '/'
      var a = getRoute(state.location)
			state.params = a.params || {}
			state.query = a.query || {}
			state.active = a.key || ''
      console.log('[radi-router] Route change', a, state.location)
    },

  },
})

const Link = component({
	name: 'RouterLink',
	props: {
		to: '/',
		active: 'active',
	},
	view(comp) {
		return r('a', {
			href: l(comp, 'to').process(url => '#'.concat(url)),
			class: l(comp, 'to')
				.process(to => (
					l(comp.$router, 'active')
						.process(active => (
							active === to ? 'active' : ''
					))
				)),
		}, ...comp.children);
	},
})

const destructComponent = (comp, ...args) => {
	if (!comp) return 404;
	if (typeof comp.before === 'function' && !comp.before(...args)) return 403;
	return comp.component || 404
}

const Router = component({
	name: 'Router',
	actions: {
		// Triggers when route is chaned
		inject({active, last}) {
			// Fire beforeEach event in routes
			let Rte = (current.before && !current.before(last, active))
				? 403
				: destructComponent(current.routes[active], last, active)

			// Fire afterEach event in routes
			if (current.after) current.after(last, active)

			// Route not found or errored out
			if (typeof Rte === 'undefined' || typeof Rte === 'number' || !Rte)
				return current.config.errors[Rte || 404]()

			if (typeof Rte === 'function') {
				// Route is component
				if (Rte.isComponent && Rte.isComponent())
					return r(Rte)

				// Route is plain function
				return Rte
			}

			// Route is plain text/object
			return Rte
		},
	},
	view(comp) {
		return r('div', {},
			l(comp.$router, 'active')
				.process(() => comp.inject(comp.$router)),
			...comp.children
		)
	},
})

// Pass routes to initiate things
export default routes => {
	const before = routes.beforeEach
	const after = routes.afterEach

	current = {
		config: {
			errors: {
				404: () => r('div', {}, 'Error 404: Not Found'),
				403: () => r('div', {}, 'Error 403: Forbidden'),
			},
		},
		before,
		after,
		routes: routes.routes,
		Link,
		Router,
	}

	// Initiates router component
	headless('router', RouterHead);

	return current
}
