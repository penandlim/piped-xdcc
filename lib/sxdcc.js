var net = require('net'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    PassThrough = require('stream').PassThrough;

function sxdcc(a0, a1, a2, a3, a4) {

  // Handle args
  switch (arguments.length) {
    case 4:
      client = arguments[0];
      bot = arguments[1];
      pack = arguments[2];
      callback = arguments[3];
      break;
    case 5:
      client = arguments[0];
      bot = arguments[1];
      pack = arguments[2];
      start = arguments[3];
      callback = arguments[4];
      break;
    default:
      callback("Incorrect # args: " + arguments.length);
  }

  var myMeta,
      start = start ? start : 0;

  // Start listening for the bot
  client.on('ctcp-privmsg', handleMsg);

  // Request
  client.say(bot, "XDCC SEND #" + pack);

  function handleMsg(sender, target, msg) {

    // Got a message from someone else?
    if (target !== client.nick || sender !== bot)
      return;

    var meta = parseParams(msg);
    if (!meta)
      cleanError("Message from bot could not be parsed");

    switch (meta.command) {

      // Bot wants to send files over
      case "SEND":

        // If necessary, tell the bot where to start
        if (start) {
          myMeta = meta;
          myMeta.start = start;
          client.ctcp(bot, "privmsg",
            util.format('DCC RESUME', meta.filename, meta.port, start));
        } else {
          createXdccConnection(meta);
        }
        break;

      // Did the bot say it was okay?
      case "ACCEPT":

        // Reuse old values
        meta.ip = myMeta.ip;
        meta.filesize = myMeta.filesize;

        // Check that it's valid
        if (myMeta === meta) {
          createXdccConnection(meta);
        } else {
          cleanError("Bot tried to give us a different package");
        }
        break;

      default:
        cleanError("Received invalid command from bot");
        break;
    }
  }

  function cleanError(msg) {
    client.removeListener('ctcp-privmsg', handleMsg);
    callback(msg);
  }

  function createXdccConnection(meta) {
    // We got the connection, don't need to listen anymore
    client.removeListener('ctcp-privmsg', handleMsg);
    var xdccConnnection = new XdccConnection(meta);
    xdccConnnection.once('destroyed', function(finished) {
      if (!finished && client)
        client.say(bot, "XDCC CANCEL");
    });
    callback(null, xdccConnnection);
  }
}

// A wrapper for the connection
util.inherits(XdccConnection, PassThrough);
function XdccConnection(meta, start) {

  var self = this;
  XdccConnection.super_.call(self);

  var conn,
      sendBuffer = new Buffer(4),
      received = start ? start : 0,
      ack = received,
      finished = false;

  conn = net.connect(meta.port, meta.ip, function() {
    self.emit('connect', meta);
  });

  conn
  .on('data', function(data) {
    received += data.length;

    // Large file support
    ack += data.length;
    while (ack > 0xFFFFFFFF) {
      ack -= 0xFFFFFFFF;
    }

    sendBuffer.writeUInt32BE(ack, 0);
    conn.write(sendBuffer);
    self.emit('progress', received);
  })
  .once('end', function() {
    finished = true;
    kill();
  })
  .once('error', kill)
  .pipe(self);

  self.on('kill', kill);

  function kill() {
    conn.destroy;
    self.emit('destroyed', finished);
    self.removeAllListeners();
  }
}

// Parse an unsigned int IP into a string
function uint32ToIP(n) {
  var octets = [];

  octets.unshift(n & 255);
  octets.unshift((n >> 8) & 255);
  octets.unshift((n >> 16) & 255);
  octets.unshift((n >> 24) & 255);

  return octets.join('.');
}

// Regex parse the message we get back from bot
function parseParams(msg) {
  var parts = msg.match(/DCC (\w+) "?'?(.+?)'?"? (\d+) (\d+) ?(\d+)?/);

  meta = {
    command: parts[1],
    filename: parts[2]
  };

  switch (meta.command) {
    case "SEND":
      meta.ip = uint32ToIP(+parts[3]),
      meta.port = +parts[4],
      meta.filesize = +parts[5]
      break;
    case "ACCEPT":
      meta.port = +parts[3],
      meta.start = +parts[4]
      break;
  }

  return meta;
}

module.exports = sxdcc;
