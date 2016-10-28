calculist.require(['Item','_','parseItemText','computeItemValue','somethingHasChanged','syncAnimationFrame','eventHub'], function (Item, _, parseItemText, computeItemValue, somethingHasChanged, syncAnimationFrame, eventHub) {

  'use strict';

  Item.prototype.toString = function () {
    return '' + this._valueOf;
  };

  Item.prototype.valueOf = function () {
    if ((this.parsedText || {}).text !== this.text || (this.hasVariableReference && this.lastAnimationFrame !== syncAnimationFrame() && somethingHasChanged())) {
      this.lastAnimationFrame = syncAnimationFrame();
      var prevKey = this.key;
      var parsedText = this.parsedText;
      if (!parsedText || parsedText.text !== this.text) {
        this.evalFn = null;
        parsedText = (this.parsedText = parseItemText(this.text));
      }

      this.valIsComputed = false;
      this.hasVariableReference = false;
      this.key = parsedText.key;
      if (parsedText.separator) {
        switch (parsedText.separator) {
          case ('[=]'):
            this.hasVal = true;
            this.valIsComputed = true;
            this.val = computeItemValue(parsedText.val, this);
            this._valueOf = this.val;
            break;
          case ('[=>]'):
            this.hasVal = true;
            this.valIsComputed = true;
            var _this = this;
            // TODO abstract this logic into a service
            this.val = function () {
              var pieces = parsedText.val.split('|'),
                  argObject = {};
              if (pieces.length > 1) {
                var argNames = pieces.shift().split(','),
                    args = arguments;
                _.each(argNames, function (name, i) {
                  argObject[_.trim(name)] = args[i];
                });
              }
              var val = computeItemValue(pieces.join('|'), _this, argObject);
              _this.hasVariableReference = false;
              return val;
            };
            this.val.toString = _.constant( parsedText.val);
            this._valueOf = this.val;
            break;
          case ('[:]'):
            this.hasVal = true;
            this.val = _.trim(parsedText.val);
            if (this.val !== '' && !_.isNaN(+this.val)) this.val = +this.val;
            this._valueOf = this.val;
            break;
          default:
            throw new Error('Unexpected separator ' + parsedText.separator);
        }
      } else {
        this.key = this.text;
        this.hasVal = false;
        this.val = null;
        this._valueOf = this.text;
      }
      if (this.key !== prevKey) eventHub.trigger('keychange', prevKey, this.key);
    }

    return this._valueOf;

  };

});
