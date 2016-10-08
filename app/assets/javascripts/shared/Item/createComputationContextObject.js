lm.register('createComputationContextObject', ['_','ss','evalculist','isItem'], function (_, ss, evalculist, isItem) {

  'use strict';

  var itemMethods = ['$item', '$$item', '$siblings'];

  // NOTE This is used to prevent code from showing up
  // as the computed value while the user is typing
  var fnToString = _.constant('[Function]');

  function ContextObject (item, includeScope) {
    if (item) {
      var _this = this;
      _.each(itemMethods, function(method) {
        _this[method] = function () {
          return item[method].apply(item, arguments);
        };
        _this[method].toString = fnToString;
      });

      // var fns = item.$$item('functions');

      // if (fns && fns.$items.length) {
      //   _.each(fns.$items, function (fn) {
      //     _this[fn.key] = function () {
      //       return evalculist(fn.val)(_this);
      //     };
      //     _this[fn.key].toString = fnToString;
      //   });
      // }

      if (includeScope) {
        var parents = [],
            nextParent = item.$parent,
            previousParent,
            assignVar = function (sibling) {
              var key = sibling.key.replace(/\s/g, '_');
              if (sibling.hasVal) {
                _this[key] = sibling.valueOf();
                var loops = 0;
                while (_this[key] && isItem(_this[key]) && _this[key].hasVal && ++loops < 100) {
                  _this[key] = _this[key].valueOf();
                }
              } else {
                _this[key] = sibling;
              }
            };
        while (nextParent) {
          parents.unshift(nextParent);
          nextParent = nextParent.$parent;
        }
        while (parents.length) {
          previousParent = nextParent;
          nextParent = parents.shift();
          if (previousParent && nextParent) {
            _.find(previousParent.$items, function (sibling, i) {
              assignVar(sibling);
              return sibling === nextParent;
            });
          }
        }
        this.$index = 0;
        var siblings = item.$parent && item.$parent.$items;
        if (siblings && siblings.length) {
          _.find(siblings, function (sibling, i) {
            if (sibling === item) {
              _this.$index = i;
              return true;
            }
            assignVar(sibling);
          });
        }
      }

      this.$parent = item.$parent;
      this.$index = item.$parent ? item.$parent.$items.indexOf(item) : 0;
      this.$items = item.$items;
      this.$key = item.key;
      this.$name = item.key;
    }
  }

  var proto = ContextObject.prototype;

  var mathKeys = ['E','LN2','LN10','LOG2E','LOG10E','PI','SQRT1_2','SQRT2','abs','acos','acosh','asin','asinh','atan','atan2','atanh','cbrt','ceil','clz32','cos','cosh','exp','expm1','floor','fround','hypot','imul','log','log1p','log2','log10','max','min','pow','random','round','sign','sin','sinh','sqrt','tan','tanh','trunc'];

  _.each(mathKeys, function(key) { proto[key] = Math[key]; });
  _.extend(proto, ss);
  proto.mixin = null;

  var lodashKeys = ['difference','intersection','reverse','union','uniq','xor',
                    'filter','find','findLast','map','reduce','zip','unzip',
                    'ceil','floor','max','min','round','clamp','inRange','range',
                    'camelCase','capitalize','kebabCase','lowerCase','join','split',
                    'parseInt','repeat','replace','snakeCase','split','startCase','toLower',
                    'toUpper','truncate','upperCase','words','times'];
  _.each(lodashKeys, function (key) { proto[key] = _[key]; });

  var valIfItem = function (item) { return isItem(item) ? item.val : item; };

  var conditionals = ['isArray','isNumber','isFunction','isString'];

  _.each(conditionals, function (methodName) {
    proto[methodName] = _.flow(valIfItem, _[methodName]);
  });

  proto.THIS_YEAR = (new Date()).getFullYear();

  proto.average = proto.mean = function (items, defaultValue) {
    return proto.sum(items, defaultValue) / items.length;
  };
  proto.sum = function(items, defaultValue) {
    if (defaultValue != null) {
      return items.reduce(function(sum, item) {
        var val = item && item.valueOf();
        if (!_.isNumber(val) || _.isNaN(val)) val = defaultValue;
        return sum + val;
      }, 0);
    }
    return items.reduce(function(sum, item) {
      var val = item.valueOf();
      return sum + (_.isNumber(val) ? val : NaN);
    }, 0);
  };

  // var multiOps =

  proto.products = function (arr) {
    return _.map(arr, function (pair) {
      return pair.length && _.reduce(pair, function (a, b) { return +a * +b; }, 1);
    });
  };

  // TODO sums, squares, cubes, sqrts,

  proto.binomialCoefficient = function binomial(n, k) {
    // if ((typeof n !== 'number') || (typeof k !== 'number')) return false;
    var coeff = 1;
    for (var x = n-k+1; x <= n; x++) coeff *= x;
    for (x = 1; x <= k; x++) coeff /= x;
    return coeff;
  };
  proto.fraction = function (numerator,denominator){
    var gcd = function gcd(a,b){
      return b != 0 ? gcd(b, a%b) : a;
    };
    gcd = gcd(numerator,denominator);
    return '' + numerator/gcd + '/' +  denominator/gcd;
  };
  proto.polarToCartesian = function (r, theta) {
    var x = r * Math.cos(theta),
        y = r * Math.sin(theta);
    return [x, y];
  };
  proto.cartesianToPolar = function (x, y) {
    var r = Math.sqrt(x * x + y * y),
        theta = Math.atan(y / x);
    return [r, theta];
  };
  proto.degreesToRadians = function (degrees) {
    return (degrees / 360) * (2 * Math.PI);
  };

  proto.radiansToDegrees = function (radians) {
    return 360 * radians / (2 * Math.PI);
  };

  proto.length = proto.count = _.property('length');
  proto.name = proto.key = _.property('key');
  proto.valueOf = _.method('valueOf');
  proto.toString = _.method('toString');
  proto.recursiveCount = function (items) {
    return items.length + _.reduce(items, function (m, item) {
      return m + proto.recursiveCount(item.$items);
    }, 0);
  };

  proto.true = true;
  proto.false = false;
  proto.null = null;

  proto.itemOf = function (item, name) {
    return item.$item(name);
  };
  proto.itemsOf = _.property('$items');
  proto.nameOf = _.property('key');
  proto.pluckItems = function ($items, key) {
    var condition;
    if (_.isFunction(key)) {
      condition = key;
    } else {
      condition = { key: key };
    }
    if (isItem($items)) $items = $items.$items;
    return $items.map(function (item) {
      return _.find(item.$items, condition);
    });
  };

  proto.flowMap = function () {
    var fns = _.flatten(arguments);
    var fmap = _.rest(function (args) {
      return _.map(fns, function (fn) {
        return fn.valueOf().apply(null, args);
      });
    });
    fmap.toString = fnToString;
    return fmap;
  };

  proto.flow = function () {
    var fns = _.flatten(arguments);
    var flow = function () {
      return _.reduce(fns, function (r, fn) {
        return [fn.valueOf().apply(null, r)];
      }, arguments)[0];
    };
    flow.toString = fnToString;
    return flow;
  };

  proto.compose = _.flip(proto.flow);

  var curry2 = function (fn) {
    var fn0, fn1;
    fn0 = function () {
      if (arguments.length === 0) return fn0;
      var arg0 = arguments[0];
      fn1 = function (arg1) { return fn(arg0, arg1); };
      if (arguments.length > 1) return fn1(arguments[1]);
      fn1.toString = fnToString;
      return fn1;
    };
    fn0.toString = fnToString;
    return fn0;
  };

  proto.isEqualTo = proto.eq = curry2(function (b, a) { return a == b; });
  proto.isGreaterThan = proto.gt = curry2(function (b, a) { return a > b; });
  proto.isGreaterThanOrEqualTo = proto.gte = curry2(function (b, a) { return a >= b; });
  proto.isLessThan = proto.lt = curry2(function (b, a) { return a < b; });
  proto.isLessThanOrEqualTo = proto.lte = curry2(function (b, a) { return a <= b; });

  // TODO should these logic functions check and adapt to non-function arguments?
  proto.and = function () {
    var fns = _.flatten(arguments),
        and;
    and = function () {
      var args = arguments;
      return _.every(fns, function (fn) {
        return fn.valueOf().apply(null, args);
      });
    };
    and.toString = fnToString;
    return and;
  };

  proto.or = function () {
    var fns = _.flatten(arguments),
        or;
    or = function () {
      var args = arguments;
      return _.some(fns, function (fn) {
        return fn.valueOf().apply(null, args);
      });
    };
    or.toString = fnToString;
    return or;
  };

  proto.not = function (fn) {
    return function () {
      return !fn.valueOf().apply(null, arguments);
    };
  };

  proto.item = curry2(function (key, list) {
    if (isItem(list)) return list.$item(key);
    if (_.isNumber(key)) return list[key];
    var condition;
    if (_.isFunction(key)) {
      condition = key;
    } else {
      condition = { key: key };
    }
    return _.find(list, condition);
  });

  proto.global_item = function (key) {
    return window.topItem.$item(key);
  };

  // evalculist adds a special "accessor" function for things like a['b']
  // so it becomes accessor(a, 'b')
  proto.accessor = function (obj, key) {
    if (_.isNumber(key) && !isItem(obj[key])) return obj[key];
    return proto.pluckItems(obj, key);
  };

  var iterators = ['sum','count','average','mean','median','mode','standardDeviation','products',
                  'reverse','unzip',
                  'filter','find','findLast','map','reduce'];

  _.each(iterators, function (methodName) {
    var baseFn = proto[methodName];
    proto[methodName] = function () {
      if (isItem(arguments[0])) arguments[0] = arguments[0].$items;
      return baseFn.apply(this, arguments);
    };
  });

  proto.uniq = proto.unique = function (items) {
    if (isItem(items)) items = items.$items;
    items = _.map(items, proto.valueOf);
    return _.uniq(items);
  };

  var doubleIterators = ['difference','intersection','union','xor','zip'];

  _.each(doubleIterators, function (methodName) {
    var baseFn = proto[methodName];
    proto[methodName] = function () {
      var args = arguments;
      _.each(args, function (arg, i) {
        if (isItem(arg)) arg = arg.$items;
        if (_.isArray(arg)) arg = _.map(arg, proto.valueOf);
        args[i] = arg;
      });
      return baseFn.apply(this, args);
    };
  });

  _.each(proto, function (fn) {
    if (_.isFunction(fn)) fn.toString = fnToString;
  });

  return function (item) {
    return new ContextObject(item);
  };

});
