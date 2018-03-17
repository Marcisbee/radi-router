/** @jsx r **/

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
	return [new RegExp('^/' + end.join('/') + '(?:\/(?=$))?$', 'i'), p]
}

function parseAllRoutes(arr) {
	var len = arr.length, ret = new Array(len)
	for (var i = len - 1; i >= 0; i--) {
		ret[i] = parseRoute(arr[i])
	}
	return ret
}

// TODO: Get rid of class
class Route {
	constructor(curr, match, routes, key) {
		var m = curr.match(match[0])
		this.path = curr
		this.key = key
		this.params = {}
		for (var i = 0; i < match[1].length; i++) {
			this.params[match[1][i]] = m[i + 1]
		}
		this.cmp = routes[key]
	}
}

// function router(src, mixin) {
//   radi = src
//   return function(ro) {
// 	  function getRoute(curr) {
//   		if (lr === curr) return ld
//   		if (!cr) cr = Object.keys(ro.routes)
//   		if (!crg) crg = parseAllRoutes(cr)
// 			var cahnged = false
//
//   		for (var i = 0; i < crg.length; i++) {
//   			if (crg[i][0].test(curr)) {
//   				ld = new Route(curr, crg[i], ro.routes, cr[i])
// 					cahnged = true
//   				break
//   			}
//   		}
//
// 			lr = curr
//   		return (!cahnged) ? {key: '$error'} : ld
//   	}
//
//     // TODO: get rid of window variables
//     window.r_routes = ro.routes
//     window.r_before = ro.beforeEach || true
//     window.r_after = ro.afterEach || null
//
//     var conds = ''
//     for (var route in ro.routes) {
//       conds = conds.concat(`cond(
//         l(this.active === '${route}' && (r_before === true || r_before('${route}',2))),
//         function () { var ret = r('div', new r_routes['${route}']()); if(r_after)r_after(); return ret; }
//       ).`)
//     }
//     if (conds !== '') conds = conds.concat('else(r(\'div\', \'Error 404\'))')
//
//     var fn = `return r('div', ${conds})`
//
// 		var mix = mixin('$router', {
// 			active: '',
// 			params: {},
// 			last: '',
// 			location: '',
// 		})
//
//     return radi.component({
//       name: 'radi-router',
//       view: new Function(fn),
//       state: {
//         // _radi_no_debug: true,
//         location: window.location.hash.substr(1) || '/',
//         params: {},
//         last: null,
//         active: null,
//       },
//       actions: {
//
//         onMount() {
// 					// this.updateMixin()
//           window.onhashchange = this.hashChange
//           this.hashChange()
//         },
//
//         hashChange() {
// 					this.last = this.location
//           this.location = window.location.hash.substr(1) || '/'
//           var a = getRoute(this.location)
// 					this.params = a.params || {}
// 					this.updateMixin()
// 					this.active = a.key || ''
//           // console.log('[radi-router] Route change', a, this.location)
//         },
//
// 				updateMixin() {
// 					mix.params = this.params
// 					mix.active = this.active
// 					mix.last = this.last
// 					mix.location = this.location
// 				},
//
//       }
//     })
//   };
// };

// exports.default = router;




const { r, l, component } = require('../../radi').default
let current = {}

const getRoute = (curr) => {
	if (lr === curr) return ld
	if (!cr) cr = Object.keys(current.routes)
	if (!crg) crg = parseAllRoutes(cr)
	var cahnged = false

	console.log(curr, Object.keys(current.routes), current.routes)

	for (var i = 0; i < crg.length; i++) {
		if (crg[i][0].test(curr)) {
			ld = new Route(curr, crg[i], current.routes, cr[i])
			cahnged = true
			break
		}
	}

	lr = curr
	return (!cahnged) ? {key: '$error'} : ld
}

// TODO:
//   Add support for guards ( beforeEach, afterEach )
//   Pass params, query attributes to childs
const Router = component({
	view(comp) {
		return r('div',
				{},
				'cool: ',
				l(comp, 'active')
					.process(active => r('div', {},
						r('h3', {}, 'active:'),
						comp.inject(current.routes[active]),
					)
			),
			...comp.children
		)
	},
  state: {
    // _radi_no_debug: true,
    location: window.location.hash.substr(1) || '/',
    params: {},
    last: null,
    active: null,
    cmp: null,
  },
  actions: {

		inject(Rte) {
			// Route not found
			if (typeof Rte === 'undefined')
				return current.config.errors[404]

			if (typeof Rte === 'function') {
				// Route is component
				if (Rte.isComponent && Rte.isComponent())
					return new Rte([])

				// Route is plain function
				return Rte
			}
			// Route is plain text/object
			return Rte
		},

    onMount(state) {
      window.onhashchange = () => this.hashChange(state)
      this.hashChange(state)
    },

    hashChange(state) {
			state.last = state.location
      state.location = window.location.hash.substr(1) || '/'
      var a = getRoute(state.location)
			state.params = a.params || {}
			state.active = a.key || ''
      console.log('[radi-router] Route change', a, state.location)
    },

  },
})

// TODO: Currently does nothing
const Link = component({
	view({ children }) {
		return r('a', {}, ...children)
	},
})

// Pass routes to initiate things
export default routes => {
	const before = routes.beforeEach
	const after = routes.afterEach

	return current = {
		config: {
			errors: {
				404: r('div', {}, 'Error 404'),
			},
			before,
			after,
		},
		routes: routes.routes,
		Link,
		Router,
	}
}
