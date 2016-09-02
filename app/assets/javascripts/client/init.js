// TODO refactor
lm.init(['LIST_DATA','Item','_','$','Backbone','lmDiff','saveButton','getAndApplyChangesFromServer','jsonToItemTree','getNewGuid'], function (foo, Item, _, $, Backbone, lmDiff, saveButton, getAndApplyChangesFromServer, jsonToItemTree, getNewGuid) {
  var jsonView = window.location.search.split('?json=')[1];
  if (jsonView) {
    window.LIST_DATA = jsonToItemTree(decodeURIComponent(jsonView));
    getAndApplyChangesFromServer = _.constant({then: _.noop});
    saveButton.hide();
  }

  if (!window.LIST_DATA) return;
  $(function() {
    if (!LIST_DATA.guid) {
      LIST_DATA.guid = getNewGuid();
    }
    window.topItem = new Item(LIST_DATA);
    var saveCount = 0, updateCount = 0;
    if (window.FILE_PATH) {
      _.defer(function () {
        var fs = require('fs');
        window.topItem.handlePaste(fs.readFileSync(window.FILE_PATH, 'utf8'));
        var markAsCollapsed = function (item) {
          if (item.$items.length) {
            item.collapsed = item.$parent && true;
            _.each(item.$items, markAsCollapsed);
          }
        };
        markAsCollapsed(window.topItem);
        window.topItem.render();
        window.topItem.focus();
        window.topItem.waitingBeforeSave = false;
        saveButton.changeStatus('saved');
        // fs.watchFile(window.FILE_PATH, { persistent: true, interval: 1007 }, function (a, b) {
        //   if (a.mtime != b.mtime) {
        //     console.log(saveCount, updateCount);
        //     if (++updateCount > saveCount) {
        //       if (window.confirm('This file has changed on disk. Reload?')) {
        //         window.topItem.waitingBeforeSave = false;
        //         window.topItem.saveNow = _.noop;
        //         window.location.reload();
        //       } else {
        //         --updateCount;
        //       }
        //     }
        //   }
        // });
      });
    }
    var ul = document.getElementById('top-level');
    var previousContent = JSON.stringify(LIST_DATA);
    var previousFlatContent = _.keyBy(window.topItem.flatten_v2(), 'guid');
    window.topItem.refreshDepth();
    window.topItem.collapse = _.noop;
    window.topItem.zoomOut = _.noop;
    window.topItem.saveNow = function() {
      ++saveCount;
      if (window.FILE_PATH) {
        var fs = require('fs');
        fs.writeFileSync(window.FILE_PATH, window.topItem.toText(0, false), 'utf8');
        saveButton.changeStatus('saved');
        return window.topItem.waitingBeforeSave = false;
      }
      window.topItem.ensureGuidsAreUnique();
      window.topItem.refreshDepth();
      var newContent = JSON.stringify(window.topItem);
      var newFlatContent = _.keyBy(window.topItem.flatten_v2(), 'guid');
      window.topItem.waitingBeforeSave = false;
      if (newContent === previousContent) {
        saveButton.changeStatus('saved');
      } else {
        var changes = lmDiff.flatItemsByGuidDiff(previousFlatContent, newFlatContent);
        // console.log(changes);
        var list = new Backbone.Model({
          title: window.topItem.key,
          // content: newContent,
          changes: changes,
          id: LIST_ID
        });
        list.url = '/lists/' + LIST_ID;
        saveButton.changeStatus('saving');
        // localStorage.tabsOpen = '';
        // localStorage.$items = newContent;
        // localStorage.tabsOpen = +(localStorage.tabsOpen || '0') + 1;
        getAndApplyChangesFromServer(window.topItem.last_save).then(function (response) {
          // TODO Need to get previous content before getting changes from server, then
          // somehow excluding those changes from the next diff.
          // As it stands now, this can result in bad data.
          var pendingPreviousContent = JSON.stringify(window.topItem);
          var pendingPreviousFlatContent = _.keyBy(window.topItem.flatten_v2(), 'guid');
          list.save(null, {
            success: function(m, response) {
              saveButton.changeStatus('saved');
              previousContent = pendingPreviousContent;
              previousFlatContent = pendingPreviousFlatContent;
              window.topItem.last_save = response.last_save;
            },
            error: function() {
              saveButton.changeStatus('saving failed');
            }
          });
        });
      }
    };
    (function() {
      var debouncedSave;
      debouncedSave = _.debounce(window.topItem.saveNow, 2000);
      window.topItem.save = function() {
        saveButton.changeStatus('save');
        window.topItem.waitingBeforeSave = true;
        if (!window.FILE_PATH) debouncedSave();
      };
    })();
    (function() {
      var focusItem, item;
      ul.appendChild(window.topItem.render().el);
      document.title = _.unescape(LIST_TITLE) + ' | Calculist.io';
      if (sessionStorage.zoomGuid) {
        item = window.topItem.$item(sessionStorage.zoomGuid, 'guid');
        if (!item) sessionStorage.zoomGuid = window.topItem.guid;
        item && item.zoomIn();
      }
      if (sessionStorage.focusGuid) {
        focusItem = window.topItem.$item(sessionStorage.focusGuid, 'guid');
      }
      (focusItem || item || window.topItem).focus();
    })();
    $('#sign-out').on('click', function() {
      var session;
      session = new Backbone.Model();
      session.url = '/logout';
      session.isNew = _.constant(false);
      session.destroy({
        success: function() {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        }
      });
    });
    saveButton.onClick(function () { window.topItem.saveNow(); });
    // localStorage.tabsOpen = +(localStorage.tabsOpen || '0') + 1;
    var refocus = function() {
      _.defer(function() {
        if (!document.hidden) {
          if (sessionStorage.focusGuid) {
            _.defer(function() {
              var item;
              item = window.topItem.$item(sessionStorage.focusGuid, 'guid');
              if (item) {
                item.focus();
              } else if (sessionStorage.zoomGuid) {
                item = window.topItem.$item(sessionStorage.zoomGuid, 'guid');
                if (item) {
                  item.focus();
                } else {
                  sessionStorage.zoomGuid = window.topItem.guid;
                  window.topItem.focus();
                }
              } else {
                window.topItem.focus();
              }
            });
          }
        }
      });
    };
    var throttledGetChanges = _.throttle(getAndApplyChangesFromServer, 1 * 1000);
    document.addEventListener('visibilitychange', function(e) {
      if (document.hidden) {
        if (window.topItem.waitingBeforeSave) window.topItem.saveNow();
      } else {
        refocus();
        throttledGetChanges(window.topItem.last_save).then(refocus);
      }
    });
    if (window.FILE_PATH) {
      window.addEventListener('blur', function (e) {
        window.topItem.saveNow();
      });
    }
    window.addEventListener('beforeunload', function(e) {
      if (window.topItem.waitingBeforeSave) {
        _.delay(_.bind(window.topItem.saveNow, window.topItem), 200);
        e.returnValue = 'Not all changes have saved.';
        return e.returnValue;
      }
    });
    // window.addEventListener('storage', function(storageEvent) {
    //   var data, item, key, newValue, oldValue, zoomGuid;
    //   key = storageEvent.key, newValue = storageEvent.newValue, oldValue = storageEvent.oldValue;
    //   if (key === '$items') {
    //     localStorage.tabsOpen = +(localStorage.tabsOpen || '0') + 1;
    //     if (newValue) {
    //       data = JSON.parse(newValue);
    //       window.topItem.initialize(data);
    //       window.topItem.text = data.text;
    //       zoomGuid = sessionStorage.zoomGuid;
    //       if (zoomGuid && zoomGuid !== window.topItem.guid) {
    //         item = window.topItem.$item(zoomGuid, 'guid');
    //         item.zoomIn({
    //           focus: false
    //         });
    //       } else {
    //         window.topItem.render();
    //       }
    //       refocus();
    //     }
    //   }
    // });
    // window.addEventListener('unload', function() {
    //   localStorage.tabsOpen = +(localStorage.tabsOpen || '1') - 1;
    // });

    window.requestAnimationFrame(function () {
      // This fixes a bug where computed values
      // are not always correct on initial pageload.
      window.topItem.softRenderAll();
    });
  });
});