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
 * An object to exchange events between objects
 * @type {{}}
 */
var GlobalEvent = {};
_.extend(GlobalEvent, Backbone.Events);

var Metronome = {
  init: setTimeout(function() {
    _.extend(Metronome, Backbone.Events);
    setInterval(function() { Metronome.tick() }, 1000);
  }, 50),

  tick: function() {
    GlobalEvent.trigger('metronome:tick');
  }
};

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

  this.tickInterval = null;
  this.paused = false;
  this.timeLength = 0; // initial time set to count down
  this.timeLeft = 0;
  this.tickLength = 1000; //milliseconds; timer granularity

  this.init = function() {
    _.extend(this, Backbone.Events);
    this.on('timer:stop', this.stop, this);
  };
  /* --================-- */
  /**
   * Triggers
   *  timer:set
   * @param delay
   */
  this.set = function(delay) {
    var _timer = this;
    this.stop();
    this.timeLength = this.timeLeft = delay;
    this.tickInterval = setInterval(function() {
      _timer.tick();
    }, this.tickLength);
    this.trigger('timer:set', this);
  };

  /**
   * Triggers
   *  timer:done
   *  timer:tick
   * @param onTick
   */
  this.tick = function() {
    if (this.paused) {
      return;
    }
    if (this.timeLeft > 0) {
      this.timeLeft -= this.tickLength;
    }
    if (this.timeLeft <= 0) {
      this.stop();
      console.log('Trigger: done')
      this.trigger('timer:done', this);
    } else {
      this.trigger('timer:tick', this);
    }
  };

  /**
   * Stops timer
   * Handles
   *  timer:stop
   */
  this.stop = function() {
    clearInterval(this.tickInterval);
    this.timeLeft = 0;
    this.paused = false;
  };

  /**
   * Pauses timer
   */
  this.pause = function() {
    this.paused = true;
  };

  /**
   * Resumes timer
   */
  this.resume = function() {
    this.paused = false;
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
    var _this = this;
    // handle timer events
    this.workBackEnd.on('timer:set timer:tick', this.setWorkTimeLeftCounter, this);
    this.workBackEnd.on('timer:done', this.setWorkTimerDone, this);
    this.workBackEnd.on('timer:stop', this.setWorkTimerStop, this);
    GlobalEvent.on('user:away', function() { console.log('pause'); _this.workBackEnd.pause(); });
    GlobalEvent.on('user:back', function() { _this.workBackEnd.resume(); });
    this.breakBackEnd.on('timer:set timer:tick', this.setBreakTimeLeftCounter, this);
    this.breakBackEnd.on('timer:done', this.setBreakTimerDone, this);
    this.breakBackEnd.on('timer:stop', this.setBreakTimerStop, this);

    // handle own events
//    this.on('form:update', this.setFormUpdate);
    this.on('form:error', this.setFormError);
    // Get visual elements' references
    this.elements.body          = $('body');
    this.elements.workTimeLeft  = $('.work-time-left', this.dom);
    this.elements.breakTimeLeft = $('.break-time-left', this.dom);
    this.elements.workDelay     = $('.work-delay', this.dom);
    this.elements.breakDelay    = $('.break-delay', this.dom);

    this.elements.progress      = $('progress', this.dom);

    //--- Set visual elements handlers
    // Update button click
    // Triggers
    //  form:update
    $('.settings-update', this.dom).click(function() {
      _this.setFormUpdate();
    });

    // Stop button click handler
    $('.timer-stop', this.dom).click(function() {
      _this.workBackEnd.trigger('timer:stop');
      _this.breakBackEnd.trigger('timer:stop');
    });

  };

  /**
   * Updates time left countdown
   * @param backEnd
   */
  this.setWorkTimeLeftCounter = function(backEnd) {
    this.elements.workTimeLeft.text((backEnd.timeLeft/1000).toTimeString());
    this.setProgress(Math.round((backEnd.timeLeft/this.workDelay)*100));
//    console.log('Handle: tick ' + backEnd.timeLeft);
  };

  /**
   * Updates time left countdown
   * @param backEnd
   */
  this.setBreakTimeLeftCounter = function(backEnd) {
    this.elements.breakTimeLeft.text((backEnd.timeLeft/1000).toTimeString());
    this.setProgress(Math.round((backEnd.timeLeft/this.breakDelay)*100));
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
    this.elements.workTimeLeft.text((0).toTimeString());

    this.breakBackEnd.set(this.breakDelay);
    this.setProgress(100);
    console.log('Handle: done')
  };

  /**
   * Handles
   *  timer:done
   * Visual user interaction
   */
  this.setBreakTimerDone = function() {
    Sounds.playSound(0);
    this.setDefaultStyle();
    this.elements.breakTimeLeft.text((0).toTimeString());

    this.workBackEnd.set(this.workDelay);
    this.setProgress(100);
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
//      this.trigger('settings:update', workDelay, breakDelay);
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

  this.setProgress = function(value) {
    this.elements.progress.attr('value', value );
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

  init: function() {
    _.extend(this, Backbone.Events);
  },

  add: function(element) {
    var uid = _.uniqueId();
    var t = _.template($('#timer-template').html());
    var wrapper = $('#content-wrapper').append(t({ title: 'New timer', id : uid }));
    this.list.push(new TimerFrontend(wrapper.find('#timer-' + uid)));
//    _.last(this.list).on('settings:update', this.save, this);
  },

  save: function(workDelay, breakDelay) {
    var content = '';

    NWFS.writeFile(OPTIONS_FILE_PATH, content);
  },

  setAFKState: function(isAway) {
    GlobalEvent.trigger(isAway ? 'user:away' : 'user:back');
  },

  restore: function() {

  },

  //-------========--------//
  __: setTimeout(function() { Timers.init(); }, 50)
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
};
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
};

/**
 * 01..09, 10, 11...
 * @returns {string}
 */
Number.prototype.leadZero = function() {
  return this > 9 ? String(this) : '0' + this;
};

String.prototype.toInteger = function() {
  var i = parseInt(this);
  return isNaN(i) ? 0 : i;
};