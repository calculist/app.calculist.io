lm.register('commands', ['_','$','transaction','computeItemValue','cursorPosition','commandTypeahead','getNewGuid','copyToClipboard','downloadFile','isItem','userPreferences','undoManager','jsonToItemTree','importFile','urlFinder','Item','commands.executePreviousCommand','commands.gotoList','commands.goHome'], function (_, $, transaction, computeItemValue, cursorPosition, commandTypeahead, getNewGuid, copyToClipboard, downloadFile, isItem, userPreferences, undoManager, jsonToItemTree, importFile, urlFinder, Item, executePreviousCommand, gotoList, goHome) {

  var commands = {
    openFile: function (_this) {

    },
    newList: function (_this, title, handle) {
      if (!title) return alert('New lists need titles.');
      handle || (handle = _.lowerCase(title).replace(/\s/g,''));
      window.topItem.saveNow().then(function () {
        window.location.assign('/list/new?title=' + encodeURIComponent(title) + '&handle=' + encodeURIComponent(handle));
      }).catch(function () {
        alert('saving failed');
      })
    },
    searchFor: function (_this, item, caseSensitive) {
      if (_.isString(item)) {
        if (caseSensitive) item = new RegExp(_.escapeRegExp(item));
        if (!caseSensitive) item = new RegExp(_.escapeRegExp(item), 'i');
      }
      this.goto(_this, item);
    },
    goto: function (_this, item) {
      if (!isItem(item)) item = _this.$item(item) || _this.$$item(item);
      item.$parent ? item.$parent.expand(true).then(function () {
        item.focus();
      }) : item.focus();
    },
    gotoItem: function (_this, item) {
      this.goto(_this, item);
    },
    gotoList: gotoList,
    goHome: goHome,
    changeTheme: function (_this, theme) {
      if (_.includes(['light','dark','sandcastle'], theme)) {
        $('#main-container').removeClass().addClass('theme-' + theme);
      }
    },
    enterCommandMode: function (_this) {
      if (_this.mode !== 'command') {
        _this.enterCommandMode();
      }
    },
    exitCommandMode: function (_this) {
      if (_this.mode === 'command') {
        _this.exitCommandMode();
      }
    },
    toggleCommandMode: function (_this) {
      if (_this.mode === 'command') {
        _this.exitCommandMode();
      } else {
        _this.enterCommandMode();
      }
    },
    addText: function (_this, text) {
      if (_this.hasFocus) {
        var cursorIndex = cursorPosition.get(_this.depth);
        if (_this.mode !== 'command' && (cursorIndex >= _this.text.length || !(cursorIndex >= 0))) {
          _this.text += text;
        } else if (_this.mode === 'command') {
          var $input = _this.$('#input' + _this.id);
          var textArray = _.toArray($input.text());
          textArray.splice(cursorIndex, 0, text);
          $input.text(textArray.join(''));
          var range = document.createRange();
          var sel = window.getSelection();
          range.collapse(true);
          range.setStart($input[0].childNodes[0], cursorIndex + text.length);
          range.setEnd($input[0].childNodes[0], cursorIndex + text.length);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          var textArray = _.toArray(_this.text);
          textArray.splice(cursorIndex, 0, text);
          _this.text = textArray.join('');
          cursorPosition.set(_this.text, _this.depth, cursorIndex + text.length);
        }
        if (_this.mode !== 'command') _this.focus();
      } else {
        _this.text += text;
      }
      if (!_this.hasFocus) _this.render();
      _this.save();
    },
    addPrefix: function (_this, text) {
      _this.text = text + _this.text;
      if (!_this.hasFocus) _this.render();
      _this.save();
    },
    removeText: function (_this, text) {
      _this.text = _this.text.split(new RegExp(_.escapeRegExp(text || _this.text), 'g')).join('');
      _this.render();
      _this.save();
    },
    replaceText: function (_this, text, newText) {
      _this.text = _this.text.split(new RegExp(_.escapeRegExp(text || _this.text), 'g')).join(newText || '');
      if (!_this.hasFocus) _this.render();
      _this.save();
    },
    changeTextOf: function (_this, item, text) {
      item.text = text;
      item.render();
      item.save();
    },
    changeText: function (_this, text) {
      this.changeTextOf(_this, _this, text);
    },
    freezeComputedValue: function (_this) {
      if (_this.valIsComputed) {
        _this.text = _this.text.split('[=]')[0] + '[:] ' + _this.val;
        _this.render();
        _this.save();
      }
    },
    template: function(_this, key) {
      var nextUp, template, templates;
      if (_this.$items.length) {
        if (!confirm('Are you sure you want to overwrite the existing list?')) {
          return;
        }
      }
      templates = [];
      nextUp = _this.$$item('templates');
      while (nextUp) {
        templates.push(nextUp);
        nextUp = nextUp.$$item('templates');
      }
      var globalTemplates = userPreferences.$item('templates');
      if (globalTemplates) templates.push(globalTemplates);
      while (templates.length && !template) {
        template = templates.shift().$item(key);
      }
      if (template && template.$items.length === 1) {
        template = template.$items[0];
        _this.addText(template.text);
        _this.render();
      }
      if (template && template.$items.length) {
        _this.$items = _.map(template.$items, _.method('clone', _this));
        _this.renderChildren();
      } else if (template) {
        _this.text += template.valueOf();
      }
      _this.focus();
      _this.save();
    },
    makeTemplate: function(_this, key) {
      var clone, templates;
      templates = _this.$$item('templates');
      if (!templates) {
        var topItem = _this.getTopItem();
        templates = new Item({
          text: 'templates',
          guid: getNewGuid(),
          $items: [],
          $parent: topItem
        });
        topItem.$items.unshift(templates);
        topItem.renderChildren();
      }
      clone = _this.clone(templates);
      if (key) {
        clone.text = key;
      }
      templates.$items.push(clone);
      templates.renderChildren();
      _this.save();
    },
    newItem: function (_this) {
      var parent = _this.$parent;
      if (parent) {
        parent.addNewChildAfter(_this, "");
      } else {
        _this.addNewChildBefore(_this.items[0], "");
      }
    },
    addItem: function (_this, text) {
      var newItem;
      if (isItem(text)) {
        newItem = text.clone(_this);
      } else {
        newItem = new Item({
          text: ('' + text) || '',
          guid: getNewGuid(),
          $items: [],
          $parent: _this
        });
      }
      _this.$items.push(newItem);
      newItem.refreshDepth();
      newItem.refreshSortOrder();
      _this.renderChildren();
    },
    addItems: function (_this) {
      var args = _.flatten(arguments);
      if (isItem(args)) args = args.$items;
      _.each(args, function (text) {
        var newItem;
        if (isItem(text)) {
          newItem = text.clone(_this);
        } else {
          newItem = new Item({
            text: ('' + text) || '',
            guid: getNewGuid(),
            $items: [],
            $parent: _this
          });
        }
        _this.$items.push(newItem);
        newItem.refreshDepth();
        newItem.refreshSortOrder();
      });
      _this.renderChildren();
    },
    sort: function() {},
    copy: function() {},
    // TODO abstract file import into service
    importFromCsv: function(_this, labelKey) {
      importFile().then(function (file) {
        var data = Papa.parse(file).data;
        var headerRow = _.map(data.shift(), _.trim);
        var labelIndex = labelKey ? headerRow.indexOf(labelKey) : 0;
        _this.$items = _.map(data, function(row) {
          var item;
          item = new Item({
            guid: getNewGuid(),
            text: row[labelIndex],
            $parent: _this,
            collapsed: true
          });
          item.$items = _.map(row, function(val, i) {
            return new Item({
              guid: getNewGuid(),
              text: "" + headerRow[i] + " [:] " + val,
              $parent: item
            });
          });
          return item;
        });
        _this.save();
        _this.renderChildren();
      });
    },
    importFromTxt: function (_this) {
      // TODO fix the empty line bug
      importFile().then(function (file) {
        _this.handlePaste(file);
      });
    },
    importFromJson: function (_this) {
      var parseJson = _.bind(this.parseJson, this);
      importFile().then(function (file) {
        parseJson(_this, file);
      });
    },
    parseJson: function (_this, json) {
      var text;
      if (json) text = _this.text;
      var tree = jsonToItemTree(json || _this.text, text);
      _this.text = tree.text;
      _this.$items = _.map(tree.$items, function (itemData) {
        var item = new Item(itemData);
        item.$parent = _this;
        return item;
      });
      _this.refreshDepth();
      _this.refreshSortOrder()
      _this.renderChildren();
    },
    followLink: function (_this, link) {
      if (!link) {
        var val = _this.valueOf();
        if (_.isString(val) && urlFinder.hasUrl(val)) {
          link = urlFinder.getUrls(val)[0];
        } else if (urlFinder.hasUrl(_this.text)) {
          link = urlFinder.getUrls(_this.text)[0];
        } else {
          return;
        }
      }
      if (urlFinder.isUrl(link)) window.topItem.saveNow().then(function () {
        window.location.assign(link);
      }).catch(function () {
        alert('saving failed');
      });
    },
    copyToClipboard: _.rest(function (_this, options) {
      options = _.flatten(options);
      if (_.includes(options, 'formatted')) return this.copyToClipboardFormatted(_this, options);
      var computed = _.includes(options, 'computed');
      var hideCollapsed = _.includes(options, 'hide collapsed');
      var itemsOnly = _.includes(options, 'items only');
      var text;
      if (itemsOnly) {
        text = _.map(_this.$items, _.method('toText', 0, computed, hideCollapsed)).join('');
      } else {
        text = _this.toText(0, computed, hideCollapsed);
      }
      copyToClipboard(text).then(function () {
        _this.focus();
      });
    }),
    copyItemsToClipboard: _.rest(function (_this, options) {
      options.push('items only');
      this.copyToClipboard(_this, options);
    }),
    copyToClipboardFormatted: _.rest(function (_this, options) {
      options = _.flatten(options);
      var computed = _.includes(options, 'computed');
      var hideCollapsed = _.includes(options, 'hide collapsed');
      var itemsOnly = _.includes(options, 'items only');
      var el;
      if (itemsOnly) {
        el =  $('<ul>' +
                  _.map(_this.$items, _.method('toHTML', !computed, hideCollapsed)).join('') +
                '</ul>')[0];
      } else {
        el = $(_this.toHTML(!computed, hideCollapsed))[0];
      }
      $(document.body).append(el);
      copyToClipboard(el).then(function () {
        $(el).remove();
        _this.focus();
      });
    }),
    copyToClipboardAsMarkdown: function (_this) {
      copyToClipboard(_this.toMarkdown(0)).then(function () {
        _this.focus();
      });
    },
    exportItemsAsText: function (_this, options) {
      var computed, hideCollapsed;
      if (options == null) {
        options = {};
      }
      computed = options.computed, hideCollapsed = options.hideCollapsed;
      var text = _.map(_this.$items, _.method('toText', 0, computed, hideCollapsed)).join('');
      $('#export-display')
        .val(text)
        .show();

      _.defer(function () {
        $('#export-display').focus().select();
      });
    },
    exportAsMarkdown: function(_this, options) {
      var computed, hideCollapsed;
      if (options == null) {
        options = {};
      }
      computed = options.computed, hideCollapsed = options.hideCollapsed;
      $('#export-display')
        .val(_this.toMarkdown(0, computed, hideCollapsed))
        .show();

      _.defer(function () {
        $('#export-display').focus().select();
      });
    },
    exportItemsAsMarkdown: function (_this, options) {
      var computed, hideCollapsed;
      if (options == null) {
        options = {};
      }
      computed = options.computed, hideCollapsed = options.hideCollapsed;
      var text = _.map(_this.$items, _.method('toMarkdown', 0, computed, hideCollapsed)).join('\n');
      $('#export-display')
        .val(text)
        .show();

      _.defer(function () {
        $('#export-display').focus().select();
      });
    },
    downloadAsCsv: function (_this) {
      var rows = _.map(_this.$items, function (item) {
        return _.reduce(item.$items, function (row, it) {
          row[it.key] = it.val;
          return row;
        }, {});
      });
      var csv = Papa.unparse(rows);
      downloadFile(csv, 'text/csv', _this.text + '.csv');
    },
    downloadAsTxt: function (_this, filename, computed) {
      filename || (filename =  _this.text);
      downloadFile(_this.toText(0, computed), 'text/txt', filename + '.txt');
    },
    downloadAsComputedTxt: function (_this, filename) {
      this.downloadAsTxt(_this, filename, true);
    },
    downloadBackup: function (_this, filename) {
      filename || (filename =  window.topItem.text + '_' + (new Date()).toJSON().substring(0, 10));
      downloadFile(window.topItem.toText(0, false), 'text/txt', filename + '.txt');
    },
    // exportAsPDF: ,
    // exportAsHTML: ,
    duplicate: function (_this) {
      var dup;
      dup = _this.clone(_this.$parent);
      _this.$parent.insertAfter(dup, _this);
      dup.refreshSortOrder();
      _this.$parent.renderChildren();
      dup.focus();
      _this.handleBlur();
      _this.softRenderAll();
      _this.save();
    },
    expandAll: function (_this) {
      _this.expandRecursive(true);
    },
    expandItemsRecursively: function (_this) {
      this.expandAll();
    },
    collapseAll: function (_this){
      _this.collapseRecursive(true);
    },
    collapseSiblings: function(_this) {
      _.each(_this.$parent.$items, function(item) {
        item.collapse();
      });
      _this.save();
      _this.focus();
    },
    collapseItemsRecursively: function (_this) {
      if (_.every(_this.$items, function (item) {
        return item.collapsed || item.$items.length === 0;
      })) {
        _.noop();
        // this.collapseAll();
      } else {
        transaction.stall();
        Promise.all(_.map(_this.$items, function(item) {
          return item.collapseRecursive();
        })).then(transaction.end).catch(transaction.end);
      }
      _this.save();
      _this.focus();
    },
    toggleCollapseSiblings: function (_this) {
      if (_this.collapsed) {
        this.expandSiblings(_this);
      } else {
        this.collapseSiblings(_this);
      }
    },
    expandSiblings: function (_this) {
      _.each(_this.$parent.$items, function(item) {
        item.expand();
      });
      _this.save();
      _this.focus();
    },
    // TODO make this an item instance method
    indentSiblings: function (_this) {
      var parent = _this.$parent;
      if (!parent) return;
      var index = parent.$items.indexOf(_this) + 1;
      _.invokeMap(parent.$items.slice(index), 'indent');
      parent.renderChildren();
      _this.save();
    },
    // indentStraight:
    // TODO make this an item instance method
    outdentStraight: function (_this) {
      this.indentSiblings();
      _this.outdent();
      _this.$parent.renderChildren();
      _this.save();
      _this.focus();
    },
    slideOut: function (_this) {
      this.outdentStraight();
    },
    outdentItems: function (_this) {
      _.eachRight(_this.$items.slice(), _.method('outdent'));
      _this.$parent.renderChildren();
      _this.save();
    },
    sortItems: function(_this, order) {
      _this.$items.sort(function(a, b) {
        a = a.valueOf();
        b = b.valueOf();
        if (a > b) {
          return 1;
        } else if (a < b) {
          return -1;
        }
        return 0;
      });
      if (_.includes(order, 'desc')) {
        _this.$items.reverse();
      }
      _this.save();
      _this.renderChildren();
    },
    sortItemsBy: function(_this, sorter, order) {
      var previousItems;
      previousItems = _this.$items;
      try {
        _this.$items = _this.sortItemsBy(sorter);
        _this.$items.sortBy = previousItems.sortBy;
        if (_.includes(order, 'desc')) {
          _this.$items.reverse();
        }
        _this.save();
        _this.renderChildren();
      } catch (_error) {
        _this.$items = previousItems;
      }
    },
    groupItemsBy: function(_this, grouper, options) {
      _this.groupItemsBy(grouper, options);
      _this.save();
      _this.renderChildren();
    },
    ungroup: function(_this, groupAttribute) {
      var _ref;
      _this.ungroup(groupAttribute);
      _this.save();
      if ((_ref = _this.$parent) != null) {
        _ref.renderChildren();
      }
    },
    ungroupItems: function(_this, groupAttribute) {
      _this.ungroupItems(groupAttribute);
      _this.save();
      _this.renderChildren();
    },
    pivotItems: function (_this) {
      _this.pivotItems();
    },
    shuffleItems: function(_this) {
      _this.$items = _.shuffle(_this.$items);
      _this.refreshDepth();
      _this.save();
      _this.renderChildren();
    },
    forEachItem: function(_this, cmd) {
      _.each(_this.$items.slice(), _.method('executeCommand', cmd));
    },
    forEachItemRecursively: function (_this, cmd) {
      var execCmd = _.method('executeCommand', cmd),
          recurse = function (items) {
            _.each(items, function (item) {
              execCmd(item);
              if (item.$items.length) recurse(item.$items.slice());
            });
          };
      recurse(_this.$items.slice());
    },
    flatten: function (_this) {
      var parent = _this.$parent;
      if (!parent) return; // TODO
      // parent.$items.splice = _this._flatten();
    },
    reverseItems: function (_this) {
      _this.$items.reverse();
      _.each(_this.$items, _.method('refreshSortOrder'));
      _this.save();
      _this.renderChildren();
    },
    generateList: _.noop,
    deleteItems: function(_this) {
      _this.$items = [];
      _this.save();
      _this.renderChildren();
    },
    moveToList: function (_this, listName) {
      var oldParent = _this.$parent,
          newParent = _this.$$item(listName) || window.topItem.$item(listName);
      if (newParent) {
        _this.$parent.removeChild(_this);
        newParent.$items.push(_this);
        _this.$parent = newParent;
        _this.refreshDepth();
        _this.refreshSortOrder();
        oldParent.renderChildren();
        newParent.renderChildren();
        _this.save();
      } else {
        // TODO
      }
    },
    splitToList: function (_this, splitter, replacer) {
      _this.splitToList(splitter, replacer);
      _this.$parent.renderChildren();
      _this.save();
    },
    _delete: function(_this) {
      _this.deleteItem(true);
    },
    undo: function (_this) {
      undoManager.undo();
    },
    redo: function (_this) {
      undoManager.redo();
    },
    executePreviousCommand: executePreviousCommand,
    // reverseText
    // upperCase
    // lowerCase
    // hideUntil: function (_this, date) {

    // },
    headsOrTails: function (_this) {
      var outcome = _.sample(['heads','tails']);
      if (_this.text) {
        var parent = _this.$parent || _this;
        parent.insertAfter(new Item({
          text: outcome,
          $items: [],
          $parent: parent,
          guid: getNewGuid()
        }), _this);
        parent.save();
        parent.renderChildren();
      } else {
        _this.text = outcome;
        _this.save();
      }
    },
    randomNumberBetween: function (_this, x, y) {

    },
    // randomName
    randomTip: function (_this) {

    },
    noop: _.noop,
    log: function (_this) {
      var args = _.toArray(arguments);
      args.unshift(_this.toJSON());
      console.log.apply(console, args);
    },
    search: function (_this, query) {

    },
    select: function (_this, item) {
      if (_.isString(item) || _.isNumber(item)) {
        item = _this.$item(item) || _this.$$item(item);
      }
      window.requestAnimationFrame(function () {
        item && item.focus();
      });
    },
    selectParent: function (_this) {
      window.requestAnimationFrame(function () {
        _this.$parent && _this.$parent.focus();
      });
    },
    down: function (_this) {
      window.requestAnimationFrame(function () {
        _this.down();
      });
    },
    up: function (_this) {
      window.requestAnimationFrame(function () {
        _this.up();
      });
    },
    shareListWith: function (_this) {

    },
    unshareListWith: function (_this) {

    },
    unshareList: function (_this) {

    },
    // randomWord:
    // randomAdjective:
    // randomNoun:
    // randomAdverb:
    // randomVerb:
  };
  var itemMethods = [
    'zoomIn','zoomOut','moveUp','moveDown','toggleCollapse',
    'indent','outdent','expand','collapse',
  ];
  _.each(itemMethods, function (methodName) {
    commands[methodName] = _.method(methodName);
  });
  return commands;
});
