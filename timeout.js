/**
 * Code in this file requires jQuery and Backbone.js
 * author: Oleksii Chekulaiev
 * created: March 21, 2014
 */

var $ = jQuery;
var NWGui = require('nw.gui');
var NWWindow = NWGui.Window.get();
var NWFS = require('fs');

var OPTIONS_FILE_PATH = '~/.nw-timer/config.ini';
var SOUNDS_PATH = 'Sounds';

/**
 * Handles
 *  timer:tick
 *  timer:stop
 *  timer:done
 * Triggers
 *  timer:set
 *  timer:tick
 *  timer:done
 * @constructor
 */
var TimerBackend = function() {

  this.id = +(_.uniqueId());

  this.tickInterval = null;
  this.timeLeft = 0;
  this.tickLength = 1000; //milliseconds; timer granularity

  this.init = function() {
    _.extend(this, Backbone.Events);
//    this.off();
    this.on('timer:tick', this.tick, this);
    this.on('timer:stop', this.stop, this);
    this.on('timer:done', this.stop, this);
  };

  /* --================-- */

  /**
   * Triggers
   *  timer:set
   *  timer:tick
   * @param delay
   */
  this.set = function(delay) {
    var _timer = this;
    this.stop();
    this.timeLeft = delay;
    this.tickInterval = setInterval(function() {
      _timer.trigger('timer:tick', _timer);
    }, this.tickLength);
    this.trigger('timer:set', this);
  };

  /**
   * Triggers
   *  timer:done
   * @param onTick
   */
  this.tick = function() {
    if (this.timeLeft > this.tickLength) {
      this.timeLeft -= this.tickLength;
    } else {
      this.trigger('timer:done', this);
    }
  };

  /**
   * Stops timer
   * Handles
   *  timer:done
   *  timer:stop
   */
  this.stop = function() {
    clearInterval(this.tickInterval);
    this.timeLeft = 0;
  };

  /* --================-- */
  this.init();
};

/**
 * Single timer Front-end related code
 * Handles
 *  timer:set
 *  timer:tick
 *  timer:stop
 *  timer:done
 *  form:update
 *  form:error
 * Triggers
 *  timer:stop
 *  form:update
 *  form:error
 *  settings:update
 * @param workBackEnd
 * @param DOM
 * @constructor
 */
var TimerFrontend = function(DOM) {

  this.dom = DOM;
  this.elements = {};
  this.workBackEnd = new TimerBackend();
  this.breakBackEnd = new TimerBackend();

  /**
   * Initialize all events
   */
  this.init = function() {
    _.extend(this, Backbone.Events);
    // handle timer events
    this.workBackEnd.on('timer:set timer:tick', this.setWorkTimeLeftCounter, this);
    this.workBackEnd.on('timer:done', this.setWorkTimerDone, this);
    this.workBackEnd.on('timer:stop', this.setWorkTimerStop, this);
    this.breakBackEnd.on('timer:set timer:tick', this.setBreakTimeLeftCounter, this);
    this.breakBackEnd.on('timer:done', this.setBreakTimerDone, this);
    this.breakBackEnd.on('timer:stop', this.setBreakTimerStop, this);
    // handle own events
    this.on('form:update', this.setFormUpdate);
    this.on('form:error', this.setFormError);

    // Get visual elements' references
    this.elements.body          = $('body');
    this.elements.workTimeLeft  = $('.work-time-left', this.dom);
    this.elements.breakTimeLeft = $('.break-time-left', this.dom);
    this.elements.workDelay     = $('.work-delay', this.dom);
    this.elements.breakDelay    = $('.break-delay', this.dom);

    var _this = this;

    //--- Set visual elements handlers
    // Update button click
    // Triggers
    //  form:update
    $('.settings-update', this.dom).click(function() {
      _this.trigger('form:update');
    });

//    // Stop button click handler
//    $('.timer-stop', this.dom).click(function() {
//      _this.workBackEnd.trigger('timer:stop');
//      _this.breakBackEnd.trigger('timer:stop');
//    });

  };

  /**
   * Updates time left countdown
   * @param backEnd
   */
  this.setWorkTimeLeftCounter = function(backEnd) {
    this.elements.workTimeLeft.text((backEnd.timeLeft/1000).toTimeString());
  };

  /**
   * Updates time left countdown
   * @param backEnd
   */
  this.setBreakTimeLeftCounter = function(backEnd) {
    this.elements.breakTimeLeft.text((backEnd.timeLeft/1000).toTimeString());
  };

  /**
   * Handles
   *  timer:done
   * Visual user interaction
   */
  this.setWorkTimerDone = function() {
    NWWindow.show();
    NWWindow.focus();
    this.setBreakStyle();
    this.breakBackEnd.set(this.breakDelay);
  };

  /**
   * Handles
   *  timer:done
   * Visual user interaction
   */
  this.setBreakTimerDone = function() {
    Sounds.playSound(0);
    this.setDefaultStyle();
    this.workBackEnd.set(this.workDelay);
  };

  /**
   * Handles
   *  timer:stop
   */
  this.setWorkTimerStop = function() {
    this.setDefaultStyle();
    this.setWorkTimeLeftCounter({ timeLeft: 0 });
  };

  /**
   * Handles
   *  timer:stop
   */
  this.setBreakTimerStop = function() {
    this.setDefaultStyle();
    this.setBreakTimeLeftCounter({ timeLeft: 0 });
  };

  /**
   * You will never guess what this function does
   * @returns {boolean}
   */
  this.formValidate = function() {
    var isValid = true;

    var workDelay = String(this.elements.workDelay.val()).toInteger() * 1000;
    if (workDelay <= 0) {
      this.trigger('form:error', 'Please correct delay value', this.elements.workDelay);
      isValid = false;
    }

    var breakDelay = String(this.elements.breakDelay.val()).toInteger() * 1000;
    if (breakDelay <= 0) {
      this.trigger('form:error', 'Please correct delay value', this.elements.breakDelay);
      isValid = false;
    }

    if (isValid) {
      this.workDelay = workDelay;
      this.breakDelay = breakDelay;
      this.trigger('settings:update', workDelay, breakDelay);
    }

    return isValid;
  };

  /**
   * Start timer with new settings
   * Handles
   *  form:update
   */
  this.setFormUpdate = function() {
    if (this.formValidate()) {
      //stop timers
      this.workBackEnd.trigger('timer:stop');
      this.breakBackEnd.trigger('timer:stop');
      //set new work timer
      this.workBackEnd.set(this.workDelay);
    }
  };

  /**
   * Calls aliens invasion
   * @param message
   * @param element
   */
  this.setFormError = function(message, element) {
    alert(message);
  };

  /**
   * Sets window style to Break time
   */
  this.setBreakStyle = function() {
    this.elements.body.addClass('bg-grey');
  };

  /**
   * Sets window style to Work Time (default)
   */
  this.setDefaultStyle = function() {
    this.elements.body.removeClass('bg-grey');
  };

  /* --================-- */
  this.init();
};

/**
 * Collection of timers' back-ends & front-ends and related code
 * Handles
 *  settings:update
 * @constructor
 */
var Timers = {
  list: [],

  add: function(element) {
    this.list.push(new TimerFrontend(element));
    _.last(this.list).on('settings:update', this.save, this);
  },

  save: function(workDelay, breakDelay) {
    var content = '';

    NWFS.writeFile(OPTIONS_FILE_PATH, content);
  },

  restore: function() {

  }
};

/**
 * Global Sounds object
 * @type {{list: Array, audioElement: null, active: boolean, init: init, set: set, play: play, playSound: playSound}}
 */
var Sounds = {
  list : [],
  audioElement : null,
  active: false,

  init: function() {
    if (this.active) {
      return false;
    }

    var _this = this;
    NWFS.readdir(SOUNDS_PATH, function(err, files) {
      if (!err) {
        _this.list = files;
      }
    });

    this.audioElement = document.createElement('audio');
    this.active = true;
    return true;
  },

  set: function(id) {
    this.audioElement.setAttribute('src', SOUNDS_PATH + '/' + this.list[id]);
  },

  play: function() {
    this.audioElement.play();
  },

  playSound: function(id) {
    this.set(id);
    this.play();
  }
}
Sounds.init();

/* ---=======≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡=======--- */

/**
 * Convert integer to time HH:MM:SS
 * @returns {string}
 */
Number.prototype.toTimeString = function() {
  var hours = Math.floor(this / 3600);
  var _$ = this % 3600;
  var minutes = Math.floor(_$ / 60);
  var seconds = Math.floor(_$ % 60);
  return hours.leadZero() + ':' + minutes.leadZero() + ':' + seconds.leadZero();
}

/**
 * 01..09, 10, 11...
 * @returns {string}
 */
Number.prototype.leadZero = function() {
  return this > 9 ? String(this) : '0' + this;
}

String.prototype.toInteger = function() {
  var i = parseInt(this);
  return isNaN(i) ? 0 : i;
}