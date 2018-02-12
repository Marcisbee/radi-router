(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['radi-router'] = {})));
}(this, (function (exports) { 'use strict';

const version = '0.1.1';
var radi;

const COLON = ':'.charCodeAt(0);
var cr;
var crg;
var lr;
var ld;

function parseRoute(route) {
	var parts = route.split('/'), end = [], p = [];
	for (var i = 0; i < parts.length; i++) {
		if (COLON === parts[i].charCodeAt(0)) {
			end.push('([^\/]+?)');
			p.push(parts[i].substr(1));
		} else if (parts[i] !== '') {
			end.push(parts[i]);
		}
	}
	return [new RegExp('^/' + end.join('/') + '(?:\/(?=$))?$', 'i'), p]
}

function parseAllRoutes(arr) {
	var len = arr.length, ret = new Array(len);
	for (var i = len - 1; i >= 0; i--) {
		ret[i] = parseRoute(arr[i]);
	}
	return ret
}

class Route {
	constructor(curr, match, routes, key) {
		var m = curr.match(match[0]);
		this.path = curr;
		this.key = key;
		this.params = {};
		for (var i = 0; i < match[1].length; i++) {
			this.params[match[1][i]] = m[i + 1];
		}
		this.cmp = routes[key];
	}
}

function router(src) {
  radi = src;
  return function(ro) {
	  function getRoute(curr) {
  		if (lr === curr) return ld
  		if (!cr) cr = Object.keys(ro.routes);
  		if (!crg) crg = parseAllRoutes(cr);

  		for (var i = 0; i < crg.length; i++) {
  			if (crg[i][0].test(curr)) {
  				ld = new Route(curr, crg[i], ro.routes, cr[i]);
  				break
  			}
  		}
  		return ld
  	}

    // TODO: get rid of window variables
    window.r_routes = ro.routes;
    window.r_before = ro.beforeEach || true;
    window.r_after = ro.afterEach || null;

    var conds = '';
    for (var route in ro.routes) {
      conds = conds.concat(`cond(
        l(this.active === '${route}' && (r_before === true || r_before('${route}',2))),
        function () { var ret = r('div', new r_routes['${route}']()); if(r_after)r_after(); return ret; }
      ).`);
    }
    if (conds !== '') conds = conds.concat('else(\'Error 404\')');

    var fn = `return r('div', ${conds})`;

    return radi.component({
      name: 'radi-router',
      view: new Function(fn),
      state: {
        // _radi_no_debug: true,
        location: window.location.hash.substr(1),
        active: null
      },
      actions: {
        onMount() {
          window.onhashchange = this.hashChange;
          this.hashChange();
        },
        hashChange() {
          this.location = window.location.hash.substr(1);
          var a = getRoute(this.location);
          if (a) {
            this.active = a.key;
          }
          // console.log('[radi-router] Route change', a)
        }
      }
    })
  };
}

exports.default = router;

exports.version = version;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=radi-router.js.map
