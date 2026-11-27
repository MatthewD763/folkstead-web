// The page's settings. Nothing here is read by a player.
window.FOLKSTEAD_CONFIG = {
  // The sheet's receiving address: the Apps Script web app's address, ending
  // in /exec (see sheet/Code.gs). Empty for now. While it is empty, a page
  // served from 127.0.0.1 or localhost sends its lines to `local` on the same
  // server, for testing, and a page served from anywhere else keeps them
  // waiting on the device and sends nothing.
  record: '',

  // Where lines go on this computer while `record` is empty.
  local: '/record',

  // Lines still waiting are tried again this often, in seconds.
  retrySeconds: 60,

  // At most this many lines wait on the device; past it the oldest are dropped.
  outboxMax: 300,

  // A send that has had no answer after this many seconds is given up, and
  // its lines wait for the next one.
  sendTimeoutSeconds: 20,

  // Whether the questions open by themselves when the game's last board has
  // been finished and its closing card answered (a line of type "more").
  askAtTheEnd: true
};
