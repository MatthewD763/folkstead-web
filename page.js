// The page around Folkstead's web build (November 27, 2026): who is playing,
// the play record sent on to the sheet, the welcome, and the three questions.
//
// It is loaded in the engine's own page, in the head, after words.js and
// config.js. It runs before the body exists, so that window.folksteadLine is
// there before the engine starts; the welcome, the tab and the questions are
// built once the body has been read. No libraries, no build step, and no
// network call but the record's. Every use of the device's storage may fail
// (a private window, blocked site data), and the page works without it.
(function () {
  'use strict';

  var words = window.FOLKSTEAD_WORDS || {};
  var config = window.FOLKSTEAD_CONFIG || {};
  var PREFIX = 'folkstead.';
  var NAME_MAX = 24;
  // One send stays well under what the sheet takes (200,000 characters, 400
  // lines), a beacon under the 64 KB a browser allows, and a single line that
  // is longer still is kept only as its type and number.
  var SEND_CHARACTERS = 150000;
  var SEND_LINES = 300;
  var BEACON_CHARACTERS = 60000;
  var LINE_CHARACTERS = 40000;
  // One quick double tap must not answer two questions, nor close what it has
  // just opened, nor reach the game under a card that has just gone: a press
  // this soon after the page changes what it shows is ignored or absorbed.
  var GUARD_MS = 400;

  var startedAt = clock();

  function clock() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  // Seconds since the page opened, to a tenth.
  function since() {
    return Math.round((clock() - startedAt) / 100) / 10;
  }

  function pad(number) {
    return (number < 10 ? '0' : '') + number;
  }

  // The local time, written as the game writes its own: 2026-11-27T18:05:09.
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function word(key) {
    var text = words[key];
    return typeof text === 'string' ? text : '';
  }

  function fill(text, name) {
    return String(text || '').split('{name}').join(name);
  }

  // --- The device's storage, which may be blocked --------------------------

  function load(key) {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch (error) {
      return null;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  // --- Who is playing -------------------------------------------------------

  function randomHex(length) {
    var bytes = new Uint8Array(Math.ceil(length / 2));
    var text = '';
    var i;
    try {
      window.crypto.getRandomValues(bytes);
    } catch (error) {
      for (i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    for (i = 0; i < bytes.length; i++) {
      text += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return text.slice(0, length);
  }

  // Letters, digits, spaces, hyphens and apostrophes only, at most 24 of them.
  function cleanName(raw) {
    if (raw === null || raw === undefined) {
      return '';
    }
    var text = String(raw);
    try {
      text = text.normalize('NFC');
    } catch (error) {
      // An old browser keeps the name as it came.
    }
    text = text.replace(/\s+/g, ' ');
    try {
      text = text.replace(new RegExp("[^\\p{L}\\p{M}\\p{N} '\\u2019-]", 'gu'), '');
    } catch (error) {
      text = text.replace(/[^A-Za-z0-9À-ɏ '’-]/g, '');
    }
    text = text.replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '');
    var characters = Array.from ? Array.from(text) : text.split('');
    return characters.slice(0, NAME_MAX).join('').replace(/ +$/, '');
  }

  function nameInLink() {
    var search = String(window.location.search || '');
    try {
      return new URLSearchParams(search).get('n');
    } catch (error) {
      var found = /[?&]n=([^&#]*)/.exec(search);
      if (!found) {
        return null;
      }
      try {
        return decodeURIComponent(found[1].replace(/\+/g, ' '));
      } catch (error2) {
        return null;
      }
    }
  }

  // A coarse description of the device, never the browser's whole description
  // of itself: such as "iPhone, touch, 390x844".
  function describe() {
    var agent = String(navigator.userAgent || '');
    var touchPoints = navigator.maxTouchPoints || 0;
    var device = 'other';
    if (/iPhone|iPod/.test(agent)) {
      device = 'iPhone';
    } else if (/iPad/.test(agent) || (/Macintosh/.test(agent) && touchPoints > 1)) {
      device = 'iPad';
    } else if (/Android/.test(agent)) {
      device = 'Android';
    } else if (/Windows/.test(agent)) {
      device = 'Windows';
    } else if (/Macintosh|Mac OS X/.test(agent)) {
      device = 'Mac';
    }
    var coarse = false;
    try {
      coarse = window.matchMedia('(pointer: coarse)').matches;
    } catch (error) {
      coarse = touchPoints > 0;
    }
    var root = document.documentElement || {};
    var width = Math.round(window.innerWidth || root.clientWidth || 0);
    var height = Math.round(window.innerHeight || root.clientHeight || 0);
    return device + ', ' + (coarse ? 'touch' : 'mouse') + ', ' + width + 'x' + height;
  }

  var who = { name: '', mark: '', visit: randomHex(8), where: describe() };
  (function () {
    var given = cleanName(nameInLink());
    if (given) {
      who.name = given;
      save('name', given);
    } else {
      who.name = cleanName(load('name'));
    }
    var mark = load('mark');
    if (!/^[0-9a-f]{16}$/.test(mark || '')) {
      mark = randomHex(16);
      save('mark', mark);
    }
    who.mark = mark;
  }());

  // --- Lines and the outbox -------------------------------------------------

  // A number that only goes up for this browser, kept across visits. Read
  // again before each use, so that two open tabs do not give out the same one.
  var seq = 0;
  function nextSeq() {
    var kept = parseInt(load('seq'), 10);
    if (kept > seq) {
      seq = kept;
    }
    seq += 1;
    save('seq', String(seq));
    return seq;
  }

  // The lines waiting to be sent. The stored copy is read again each time, as
  // another tab may have changed it; this page's own copy is the only one
  // once storing has failed.
  var box = [];
  var boxStored = true;

  function readBox() {
    if (boxStored) {
      var text = load('outbox');
      if (text) {
        try {
          var list = JSON.parse(text);
          if (Array.isArray(list)) {
            box = list;
          }
        } catch (error) {
          // A damaged copy is left; this page's own stands.
        }
      }
    }
    return box;
  }

  function writeBox(list) {
    var most = Math.max(1, parseInt(config.outboxMax, 10) || 300);
    if (list.length > most) {
      list = list.slice(list.length - most);
    }
    box = list;
    boxStored = save('outbox', JSON.stringify(list));
  }

  function keyOf(line) {
    return line.visit + ':' + line.seq;
  }

  // Every line made in this page load, for the page's own check.
  var made = [];

  function add(line) {
    line.seq = nextSeq();
    line.visit = who.visit;
    var length = JSON.stringify(line).length;
    if (length > LINE_CHARACTERS) {
      line = { type: line.type, seq: line.seq, visit: line.visit, cut: length };
    }
    var list = readBox().slice();
    list.push(line);
    writeBox(list);
    if (made.length < 2000) {
      made.push(line);
    }
    return line;
  }

  // --- Sending --------------------------------------------------------------

  function address() {
    if (config.record) {
      return String(config.record);
    }
    var host = String(window.location.hostname || '');
    if (host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1') {
      return String(config.local || '/record');
    }
    return '';
  }

  function envelope(lines) {
    return JSON.stringify({
      v: 1, name: who.name, mark: who.mark, visit: who.visit, where: who.where,
      page: window.location.host, lines: lines
    });
  }

  // As many lines as fit, the oldest first, or the newest for a beacon.
  function batch(list, characters, newest) {
    var order = newest ? list.slice().reverse() : list;
    var chosen = [];
    var size = 300;
    for (var i = 0; i < order.length && chosen.length < SEND_LINES; i++) {
      var length = JSON.stringify(order[i]).length + 1;
      if (chosen.length > 0 && size + length > characters) {
        break;
      }
      chosen.push(order[i]);
      size += length;
    }
    return newest ? chosen.reverse() : chosen;
  }

  var sending = false;
  var again = false;
  var lastReply = '';
  var confirmed = 0;

  function send() {
    var url = address();
    if (!url) {
      return;
    }
    if (sending) {
      again = true;
      return;
    }
    var waiting = readBox();
    var chosen = batch(waiting, SEND_CHARACTERS, false);
    if (chosen.length === 0) {
      return;
    }
    var partial = chosen.length < waiting.length;
    sending = true;
    again = false;
    var finished = false;
    var controller = null;
    try {
      controller = new AbortController();
    } catch (error) {
      controller = null;
    }
    var timer = setTimeout(function () {
      if (controller) {
        try {
          controller.abort();
        } catch (error) {
          // Nothing more to stop.
        }
      }
      finish('no answer');
    }, Math.max(5, parseFloat(config.sendTimeoutSeconds) || 20) * 1000);

    function finish(text) {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      sending = false;
      lastReply = String(text === null || text === undefined ? '' : text).slice(0, 100);
      if (!/^ok/.test(lastReply.replace(/^\s+/, ''))) {
        // The lines wait for the next send.
        again = false;
        return;
      }
      var sent = {};
      for (var i = 0; i < chosen.length; i++) {
        sent[keyOf(chosen[i])] = true;
      }
      writeBox(readBox().filter(function (line) {
        return !sent[keyOf(line)];
      }));
      confirmed += chosen.length;
      if ((again || partial) && readBox().length > 0) {
        again = false;
        setTimeout(send, 0);
      }
    }

    try {
      var options = {
        method: 'POST', body: envelope(chosen), credentials: 'omit',
        cache: 'no-store', redirect: 'follow'
      };
      if (controller) {
        options.signal = controller.signal;
      }
      window.fetch(url, options).then(function (response) {
        return response.text().then(function (text) {
          return response.ok ? text : 'refused ' + response.status;
        });
      }).then(finish, function () {
        finish('failed');
      });
    } catch (error) {
      finish('failed');
    }
  }

  // When the page is hidden or closed, what waits goes by beacon. Those lines
  // stay waiting until a later send is answered "ok": the sheet may then have
  // a line twice, and its seq tells it.
  var lastBeacon = '';
  var lastBeaconAt = -1e9;

  function beacon() {
    var url = address();
    if (!url || !navigator.sendBeacon) {
      return false;
    }
    var chosen = batch(readBox(), BEACON_CHARACTERS, true);
    if (chosen.length === 0) {
      return false;
    }
    var keys = chosen.map(keyOf).join(',');
    if (keys === lastBeacon && clock() - lastBeaconAt < 5000) {
      return false;
    }
    lastBeacon = keys;
    lastBeaconAt = clock();
    try {
      return navigator.sendBeacon(url, envelope(chosen));
    } catch (error) {
      return false;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      beacon();
    } else if (readBox().length > 0) {
      send();
    }
  });
  window.addEventListener('pagehide', beacon);
  window.addEventListener('online', function () {
    if (readBox().length > 0) {
      send();
    }
  });
  setInterval(function () {
    if (readBox().length > 0) {
      send();
    }
  }, Math.max(5, parseFloat(config.retrySeconds) || 60) * 1000);

  // A line of the page's own, of type "page", sent at once.
  function note(event, details, quiet) {
    var line = { type: 'page', event: event, at: stamp(), seconds: since() };
    if (details) {
      for (var key in details) {
        if (Object.prototype.hasOwnProperty.call(details, key)) {
          line[key] = details[key];
        }
      }
    }
    add(line);
    if (!quiet) {
      send();
    }
    return line;
  }

  // --- Lines from the game --------------------------------------------------

  var heard = false;

  // The game hands each line of its play record here, as JSON text.
  window.folksteadLine = function (text) {
    var line = null;
    if (typeof text === 'string') {
      try {
        line = JSON.parse(text);
      } catch (error) {
        line = null;
      }
    } else if (text && typeof text === 'object') {
      try {
        line = JSON.parse(JSON.stringify(text));
      } catch (error) {
        line = null;
      }
    }
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      line = { type: 'unreadable', text: String(text).slice(0, 300) };
    }
    var now = false;
    if (!heard) {
      // The first line says the game is up: how long it took to load. Being a
      // page line it is sent at once, together with the game's first line.
      heard = true;
      now = true;
      note('ready', null, true);
      gameReady();
    }
    add(line);
    var type = String(line.type || '');
    if (now || type === 'board' || type === 'more' || type === 'closed') {
      send();
    }
    if (type === 'more' && config.askAtTheEnd !== false) {
      openPanel('more');
    }
  };

  note('open');

  // --- What the player sees -------------------------------------------------

  var ui = {};
  var built = false;
  var shown = { welcome: true, panel: false };
  var played = false;
  var waitingToPlay = false;
  var ready = false;
  var failed = false;
  var step = 0;
  var changedAt = -1e9;
  var pendingPanel = '';
  var statusSeen = false;
  var watcher = null;

  function questions() {
    return Array.isArray(words.questions) ? words.questions : [];
  }

  function make(tag, className, text) {
    var element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== null && text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function makeButton(className, text) {
    var element = make('button', className, text);
    element.type = 'button';
    return element;
  }

  function focusQuietly(element) {
    if (!element) {
      return;
    }
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      try {
        element.focus();
      } catch (error2) {
        // Nothing to focus.
      }
    }
  }

  function canvas() {
    return document.getElementById('canvas');
  }

  // The game's canvas takes the keys again.
  function focusGame() {
    var element = canvas();
    if (!element) {
      return;
    }
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
    focusQuietly(element);
  }

  function changed() {
    changedAt = clock();
  }

  function tooSoon() {
    return clock() - changedAt < GUARD_MS;
  }

  function showLayer(layer) {
    if (layer.fsTimer) {
      clearTimeout(layer.fsTimer);
      layer.fsTimer = null;
    }
    layer.classList.remove('fs-leaving');
    layer.removeAttribute('aria-hidden');
    layer.hidden = false;
  }

  // A card fades as it goes, and goes on taking presses while it fades.
  function hideLayer(layer) {
    layer.classList.add('fs-leaving');
    layer.setAttribute('aria-hidden', 'true');
    if (layer.fsTimer) {
      clearTimeout(layer.fsTimer);
    }
    layer.fsTimer = setTimeout(function () {
      layer.fsTimer = null;
      layer.hidden = true;
      layer.classList.remove('fs-leaving');
    }, GUARD_MS);
  }

  // A press that starts on the page's own parts never reaches the game. Ends
  // of presses (mouseup, touchend) still pass, so that a drag begun in the
  // game always ends there.
  function shield(element) {
    var types = ['mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu', 'dblclick', 'keydown', 'keyup', 'keypress'];
    types.forEach(function (type) {
      element.addEventListener(type, function (event) {
        event.stopPropagation();
      }, { passive: true });
    });
  }

  function buildWelcome() {
    var layer = make('div', 'fs-layer fs-welcome');
    layer.id = 'fs-welcome';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-labelledby', 'fs-title');
    var scroll = make('div', 'fs-scroll');
    var card = make('div', 'fs-card');
    var title = make('h1', 'fs-title', word('title'));
    title.id = 'fs-title';
    card.appendChild(title);
    if (who.name) {
      var hello = make('p', 'fs-hello', fill(word('hello'), who.name));
      hello.id = 'fs-hello';
      card.appendChild(hello);
    }
    var paragraphs = Array.isArray(words.welcome) ? words.welcome : [word('welcome')];
    paragraphs.forEach(function (text) {
      if (text) {
        card.appendChild(make('p', 'fs-text', text));
      }
    });
    var record = make('p', 'fs-note', fill(who.name ? word('recordNamed') : word('record'), who.name));
    record.id = 'fs-record';
    card.appendChild(record);
    var play = makeButton('fs-button fs-main', word('play'));
    play.id = 'fs-play';
    play.setAttribute('aria-live', 'polite');
    play.addEventListener('click', pressPlay);
    card.appendChild(play);
    var bar = make('div', 'fs-bar');
    bar.hidden = true;
    var barFill = make('div', 'fs-bar-fill');
    bar.appendChild(barFill);
    card.appendChild(bar);
    scroll.appendChild(card);
    layer.appendChild(scroll);
    shield(layer);
    ui.welcome = layer;
    ui.play = play;
    ui.bar = bar;
    ui.barFill = barFill;
    return layer;
  }

  function buildTab() {
    var tab = makeButton('fs-tab', word('tab'));
    tab.id = 'fs-tab';
    tab.hidden = true;
    tab.setAttribute('aria-haspopup', 'dialog');
    tab.addEventListener('click', function () {
      if (!tooSoon()) {
        openPanel('tab');
      }
    });
    shield(tab);
    ui.tab = tab;
    return tab;
  }

  function buildPanel() {
    var layer = make('div', 'fs-layer fs-panel');
    layer.id = 'fs-panel';
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    var scroll = make('div', 'fs-scroll');
    var card = make('div', 'fs-card');
    ui.steps = [];
    ui.dots = [];
    questions().forEach(function (question, index) {
      var part = make('div', 'fs-step');
      part.hidden = true;
      part.setAttribute('data-step', String(index + 1));
      var ask = make('h2', 'fs-ask', question.ask || '');
      ask.id = 'fs-ask-' + (index + 1);
      part.appendChild(ask);
      var choices = make('div', 'fs-choices');
      (question.choices || []).forEach(function (choice, place) {
        var button = makeButton('fs-button fs-choice', choice);
        button.setAttribute('data-q', String(index + 1));
        button.setAttribute('data-a', String(place + 1));
        button.addEventListener('click', function () {
          answer(index, place);
        });
        choices.appendChild(button);
      });
      part.appendChild(choices);
      card.appendChild(part);
      ui.steps.push(part);
    });
    var thanks = make('div', 'fs-step fs-thanks');
    thanks.hidden = true;
    thanks.id = 'fs-thanks';
    thanks.appendChild(make('p', 'fs-text', word('thanks')));
    var leave = make('p', 'fs-text', word('leave'));
    leave.id = 'fs-leave';
    thanks.appendChild(leave);
    card.appendChild(thanks);
    ui.steps.push(thanks);
    var dots = make('div', 'fs-dots');
    dots.setAttribute('aria-hidden', 'true');
    questions().forEach(function () {
      var dot = make('span', 'fs-dot');
      dots.appendChild(dot);
      ui.dots.push(dot);
    });
    card.appendChild(dots);
    ui.dotsRow = dots;
    var back = makeButton('fs-button fs-quiet', word('back'));
    back.id = 'fs-back';
    back.addEventListener('click', function () {
      if (!tooSoon()) {
        closePanel();
      }
    });
    card.appendChild(back);
    scroll.appendChild(card);
    layer.appendChild(scroll);
    // A press beside the card closes it, as beside the game's own menu.
    scroll.addEventListener('click', function (event) {
      if (event.target === scroll && !tooSoon()) {
        closePanel();
      }
    });
    layer.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        closePanel();
      }
    });
    shield(layer);
    ui.panel = layer;
    ui.back = back;
    return layer;
  }

  function showStep(index) {
    step = index;
    changed();
    for (var i = 0; i < ui.steps.length; i++) {
      ui.steps[i].hidden = i !== index;
    }
    var thanking = index >= questions().length;
    for (var j = 0; j < ui.dots.length; j++) {
      ui.dots[j].className = 'fs-dot' + (j === index ? ' fs-on' : (j < index ? ' fs-done' : ''));
    }
    ui.dotsRow.hidden = thanking;
    // The last card is an ending: it says the player may leave, and going on
    // playing is the quiet choice there, not the main one.
    ui.back.className = 'fs-button fs-quiet';
    ui.back.textContent = word(thanking ? 'keep' : 'back');
    if (thanking) {
      ui.panel.removeAttribute('aria-labelledby');
      ui.panel.setAttribute('aria-label', word('thanks'));
      focusQuietly(ui.back);
    } else {
      ui.panel.removeAttribute('aria-label');
      ui.panel.setAttribute('aria-labelledby', 'fs-ask-' + (index + 1));
      focusQuietly(ui.steps[index].querySelector('button'));
    }
  }

  function answer(index, place) {
    if (!shown.panel || index !== step || tooSoon()) {
      return;
    }
    var question = questions()[index] || {};
    var choices = question.choices || [];
    note('answer', { q: index + 1, a: place + 1, words: String(choices[place] || '') });
    showStep(index + 1);
  }

  function openPanel(by) {
    if (!built || shown.welcome) {
      pendingPanel = by;
      return;
    }
    if (shown.panel) {
      return;
    }
    shown.panel = true;
    note('panel', { by: by });
    showLayer(ui.panel);
    ui.tab.hidden = true;
    showStep(0);
  }

  function closePanel() {
    if (!shown.panel) {
      return;
    }
    shown.panel = false;
    changed();
    hideLayer(ui.panel);
    ui.tab.hidden = false;
    focusGame();
  }

  function enterGame() {
    if (!shown.welcome) {
      return;
    }
    shown.welcome = false;
    waitingToPlay = false;
    changed();
    hideLayer(ui.welcome);
    ui.tab.hidden = false;
    focusGame();
    if (pendingPanel) {
      var by = pendingPanel;
      pendingPanel = '';
      openPanel(by);
    }
  }

  function pressPlay() {
    if (!shown.welcome || waitingToPlay) {
      return;
    }
    if (!played) {
      played = true;
      note('play', { loaded: ready });
    }
    if (ready || failed) {
      enterGame();
      return;
    }
    waitingToPlay = true;
    ui.play.textContent = word('loading');
    ui.play.setAttribute('aria-busy', 'true');
    ui.play.className = 'fs-button fs-main fs-waiting';
    ui.bar.hidden = false;
  }

  function gameReady() {
    if (ready) {
      return;
    }
    ready = true;
    if (!built) {
      return;
    }
    if (waitingToPlay) {
      enterGame();
    } else if (shown.welcome && document.activeElement === canvas()) {
      // The engine takes the focus as it starts; the welcome keeps it.
      focusQuietly(ui.play);
    }
  }

  // The engine's own page shows its progress, and an error if it cannot run,
  // in an element of its own (#status), which it removes once the game runs.
  function watchEngine() {
    var status = document.getElementById('status');
    if (status) {
      statusSeen = true;
    } else if (statusSeen && !ready) {
      gameReady();
    }
    var notice = document.getElementById('status-notice');
    if (!failed && notice && notice.style.display === 'block') {
      failed = true;
      note('fail', { text: String(notice.textContent || '').replace(/\s+/g, ' ').slice(0, 300) });
      if (waitingToPlay) {
        enterGame();
      }
    }
    var progress = document.getElementById('status-progress');
    if (waitingToPlay && ui.bar) {
      var value = progress ? parseFloat(progress.getAttribute('value')) : NaN;
      var most = progress ? parseFloat(progress.getAttribute('max')) : NaN;
      if (value > 0 && most > 0) {
        ui.bar.className = 'fs-bar';
        ui.barFill.style.width = Math.min(100, Math.round(100 * value / most)) + '%';
      } else {
        ui.bar.className = 'fs-bar fs-unknown';
        ui.barFill.style.width = '';
      }
    }
    if ((ready || failed) && !shown.welcome && watcher) {
      clearInterval(watcher);
      watcher = null;
    }
  }

  function build() {
    if (built || !document.body) {
      return;
    }
    document.body.appendChild(buildWelcome());
    document.body.appendChild(buildTab());
    document.body.appendChild(buildPanel());
    built = true;
    focusQuietly(ui.play);
    watchEngine();
    watcher = setInterval(watchEngine, 200);
    if (ready) {
      ready = false;
      gameReady();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  // For the page's own check (tools/check-web-page.ps1). Copies only: nothing
  // here changes what the page does.
  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  window.FolksteadPage = {
    who: function () {
      return copy(who);
    },
    waiting: function () {
      return copy(readBox());
    },
    lines: function () {
      return copy(made);
    },
    state: function () {
      return {
        address: address(), sending: sending, lastReply: lastReply, confirmed: confirmed,
        stored: boxStored, ready: ready, played: played, failed: failed,
        welcome: shown.welcome, panel: shown.panel, step: step
      };
    },
    send: send,
    beacon: beacon
  };
}());
