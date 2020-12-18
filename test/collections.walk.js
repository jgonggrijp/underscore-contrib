$(document).ready(function() {

  QUnit.module("underscore.collections.walk");

  var getSimpleTestTree = function() {
    return {
      val: 0,
      l: { val: 1, l: { val: 2 }, r: { val: 3 } },
      r: { val: 4, l: { val: 5 }, r: { val: 6 } }
    };
  };

  var getMixedTestTree = function() {
    return {
      current:
        { city: 'Munich', aliases: ['Muenchen'], population: 1378000 },
      previous: [
        { city: 'San Francisco', aliases: ['SF', 'San Fran'], population: 812826 },
        { city: 'Toronto', aliases: ['TO', 'T-dot'], population: 2615000 }
      ]
    };
  };

  var getArrayValues = function() {
    return ["a", "a", "a", "a", "b", "c", "d", "e" ];
  };

  QUnit.test("basic", function(assert) {
    // Updates the value of `node` to be the sum of the values of its subtrees.
    // Ignores leaf nodes.
    var visitor = function(node) {
      if (node.l && node.r)
        node.val = node.l.val + node.r.val;
    };

    var tree = getSimpleTestTree();
    _.walk.postorder(tree, visitor);
    assert.equal(tree.val, 16, 'should visit subtrees first');

    tree = getSimpleTestTree();
    _.walk.preorder(tree, visitor);
    assert.equal(tree.val, 5, 'should visit subtrees after the node itself');
  });

  QUnit.test("circularRefs", function(assert) {
    var tree = getSimpleTestTree();
    tree.l.l.r = tree;
    assert.throws(function() { _.walk.preorder(tree, _.identity); }, TypeError, 'preorder throws an exception');
    assert.throws(function() { _.walk.postrder(tree, _.identity); }, TypeError, 'postorder throws an exception');

    tree = getSimpleTestTree();
    tree.r.l = tree.r;
    assert.throws(function() { _.walk.preorder(tree, _.identity); }, TypeError, 'exception for a self-referencing node');
  });

  QUnit.test("simpleMap", function(assert) {
    var visitor = function(node, key, parent) {
      if (_.has(node, 'val')) return node.val;
      if (key !== 'val') throw new Error('Leaf node with incorrect key');
      return this.leafChar || '-';
    };
    var visited = _.walk.map(getSimpleTestTree(), _.walk.preorder, visitor).join('');
    assert.equal(visited, '0-1-2-3-4-5-6-', 'pre-order map');

    visited = _.walk.map(getSimpleTestTree(), _.walk.postorder, visitor).join('');
    assert.equal(visited, '---2-31--5-640', 'post-order map');

    var context = { leafChar: '*' };
    visited = _.walk.map(getSimpleTestTree(), _.walk.preorder, visitor, context).join('');
    assert.equal(visited, '0*1*2*3*4*5*6*', 'pre-order with context');

    visited = _.walk.map(getSimpleTestTree(), _.walk.postorder, visitor, context).join('');
    assert.equal(visited, '***2*31**5*640', 'post-order with context');

    if (document.querySelector) {
      var root = document.querySelector('#map-test');
      var ids = _.walk.map(root, _.walk.preorder, function(el) { return el.id; });
      assert.deepEqual(ids, ['map-test', 'id1', 'id2'], 'preorder map with DOM elements');

      ids = _.walk.map(root, _.walk.postorder, function(el) { return el.id; });
      assert.deepEqual(ids, ['id1', 'id2', 'map-test'], 'postorder map with DOM elements');
    }
  });

  QUnit.test("mixedMap", function(assert) {
    var visitor = function(node, key, parent) {
      return _.isString(node) ? node.toLowerCase() : null;
    };

    var tree = getMixedTestTree();
    var preorderResult = _.walk.map(tree, _.walk.preorder, visitor);
    assert.equal(preorderResult.length, 19, 'all nodes are visited');
    assert.deepEqual(_.reject(preorderResult, _.isNull),
        ['munich', 'muenchen', 'san francisco', 'sf', 'san fran', 'toronto', 'to', 't-dot'],
        'pre-order map on a mixed tree');

    var postorderResult = _.walk.map(tree, _.walk.postorder, visitor);
    assert.deepEqual(preorderResult.sort(), postorderResult.sort(), 'post-order map on a mixed tree');

    tree = [['foo'], tree];
    var result = _.walk.map(tree, _.walk.postorder, visitor);
    assert.deepEqual(_.difference(result, postorderResult), ['foo'], 'map on list of trees');
  });

  QUnit.test("pluck", function(assert) {
    var tree = getSimpleTestTree();
    tree.val = { val: 'z' };

    var plucked = _.walk.pluckRec(tree, 'val');
    assert.equal(plucked.shift(), tree.val);
    assert.equal(plucked.join(''), 'z123456', 'pluckRec is recursive');

    plucked = _.walk.pluck(tree, 'val');
    assert.equal(plucked.shift(), tree.val);
    assert.equal(plucked.join(''), '123456', 'regular pluck is not recursive');

    tree.l.r.foo = 42;
    assert.equal(_.walk.pluck(tree, 'foo'), 42, 'pluck a value from deep in the tree');

    tree = getMixedTestTree();
    assert.deepEqual(_.walk.pluck(tree, 'city'), ['Munich', 'San Francisco', 'Toronto'], 'pluck from a mixed tree');
    tree = [tree, { city: 'Loserville', population: 'you' }];
    assert.deepEqual(_.walk.pluck(tree, 'population'), [1378000, 812826, 2615000, 'you'], 'pluck from a list of trees');
  });

  QUnit.test("reduce", function(assert) {
    var add = function(a, b) { return a + b; };
    var leafMemo = [];
    var sum = function(memo, node) {
      if (_.isObject(node))
        return _.reduce(memo, add, 0);

      assert.strictEqual(memo, leafMemo);
      return node;
    };
    var tree = getSimpleTestTree();
    assert.equal(_.walk.reduce(tree, sum, leafMemo), 21);

    // A more useful example: transforming a tree.

    // Returns a new node where the left and right subtrees are swapped.
    var mirror = function(memo, node) {
      if (!_.has(node, 'r')) return node;
      return _.extend(_.clone(node), { l: memo.r, r: memo.l });
    };
    // Returns the '-' for internal nodes, and the value itself for leaves.
    var toString =  function(node) { return _.has(node, 'val') ? '-' : node; };

    tree = _.walk.reduce(getSimpleTestTree(), mirror);
    assert.equal(_.walk.reduce(tree, sum, leafMemo), 21);
    assert.equal(_.walk.map(tree, _.walk.preorder, toString).join(''), '-0-4-6-5-1-3-2', 'pre-order map');
  });

  QUnit.test("find", function(assert) {
    var tree = getSimpleTestTree();

    // Returns a visitor function that will succeed when a node with the given
    // value is found, and then raise an exception the next time it's called.
    var findValue = function(value) {
      var found = false;
      return function(node) {
        if (found) throw 'already found!';
        found = (node.val === value);
        return found;
      };
    };

    assert.equal(_.walk.find(tree, findValue(0)).val, 0);
    assert.equal(_.walk.find(tree, findValue(6)).val, 6);
    assert.deepEqual(_.walk.find(tree, findValue(99)), undefined);
  });

  QUnit.test("filter", function(assert) {
    var tree = getSimpleTestTree();
    tree.r.val = '.oOo.';  // Remove one of the numbers.
    var isEvenNumber = function(x) {
      return _.isNumber(x) && x % 2 === 0;
    };

    assert.equal(_.walk.filter(tree, _.walk.preorder, _.isObject).length, 7, 'filter objects');
    assert.equal(_.walk.filter(tree, _.walk.preorder, _.isNumber).length, 6, 'filter numbers');
    assert.equal(_.walk.filter(tree, _.walk.postorder, _.isNumber).length, 6, 'postorder filter numbers');
    assert.equal(_.walk.filter(tree, _.walk.preorder, isEvenNumber).length, 3, 'filter even numbers');

    // With the identity function, only the value '0' should be omitted.
    assert.equal(_.walk.filter(tree, _.walk.preorder, _.identity).length, 13, 'filter on identity function');
  });

  QUnit.test("reject", function(assert) {
    var tree = getSimpleTestTree();
    tree.r.val = '.oOo.';  // Remove one of the numbers.

    assert.equal(_.walk.reject(tree, _.walk.preorder, _.isObject).length, 7, 'reject objects');
    assert.equal(_.walk.reject(tree, _.walk.preorder, _.isNumber).length, 8, 'reject numbers');
    assert.equal(_.walk.reject(tree, _.walk.postorder, _.isNumber).length, 8, 'postorder reject numbers');

    // With the identity function, only the value '0' should be kept.
    assert.equal(_.walk.reject(tree, _.walk.preorder, _.identity).length, 1, 'reject with identity function');
  });

  QUnit.test("customTraversal", function(assert) {
    var tree = getSimpleTestTree();

    // Set up a walker that will not traverse the 'val' properties.
    var walker = _.walk(function(node) {
      return _.omit(node, 'val');
    });
    var visitor = function(node) {
      if (!_.isObject(node)) throw new Error("Leaf value visited when it shouldn't be");
    };
    assert.equal(walker.pluck(tree, 'val').length, 7, 'pluck with custom traversal');
    assert.equal(walker.pluckRec(tree, 'val').length, 7, 'pluckRec with custom traversal');

    assert.equal(walker.map(tree, _.walk.postorder, _.identity).length, 7, 'traversal strategy is dynamically scoped');

    // Check that the default walker is unaffected.
    assert.equal(_.walk.map(tree, _.walk.postorder, _.identity).length, 14, 'default map still works');
    assert.equal(_.walk.pluckRec(tree, 'val').join(''), '0123456', 'default pluckRec still works');
  });

  QUnit.test("containsAtLeast", function(assert){
    var array = getArrayValues();

    assert.equal(_.walk.containsAtLeast(array, 3, "a"), true, "list contains at least 3 items");
    assert.equal(_.walk.containsAtLeast(array, 1, "b"), true, "list contains at least 1 items");
    assert.equal(_.walk.containsAtLeast(array, 1, "f"), false, "list doesn't contain item for that value");
  });

  QUnit.test("containsAtMost", function(assert){
    var array = getArrayValues();

    assert.equal(_.walk.containsAtMost(array, 4, "a"), true, "list contains at most 4 items");
    assert.equal(_.walk.containsAtMost(array, 1, "b"), true, "list contains at most 1 value");
    assert.equal(_.walk.containsAtMost(array, 1, "f"), true, "list contains at most 1 value");
  });
});
