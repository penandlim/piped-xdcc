var irc = require('irc')
  , net = require('net');

module.exports.irc = irc;
if (irc.Client.prototype.getXdcc) return;

function uint32ToIP(n) {
  var byte1 = n & 255
    , byte2 = ((n >> 8) & 255)
    , byte3 = ((n >> 16) & 255)
    , byte4 = ((n >> 24) & 255);

  return byte4 + "." + byte3 + "." + byte2 + "." + byte1;
}

// Regex parse the message we get back from bot
function parseSendParams(text) {
  var parts = text.match(/(?:[^\s"]+|"[^"]*")+/g);
  return {
    file: parts[2],
    ip: uint32ToIP(parseInt(parts[3], 10)),
    port: parseInt(parts[4], 10),
    length: parseInt(parts[5], 10)
  };
}

/*
 * hostUser: The bot to request from
 * hostCommand: The message to issue to the bot
 * callback: A callback which takes err, data (stream), details (obj)
 */
irc.Client.prototype.getXdcc = function(hostUser, hostCommand, callback) {
  var self = this,
      handler;

  function detach() {
    self.removeListener('ctcp-privmsg', handler);
  }

  self.on('ctcp-privmsg', handler = function(from, to, text) {
    if (to !== self.nick || from !== hostUser) return;
    detach();

    if (text.substr(0, 9) !== 'DCC SEND ') return;

    var details = parseSendParams(text);

    var received = 0
      , sendBuffer = new Buffer(4);

    var client = net.connect(details.port, details.ip, function() {
      self.emit('xdcc-connect', details);
    });

    client.on('connect', callbackHandler = function() {
      callback(null, client, details);
    });

    client.on('data', function(data) {
      received += data.length;
      sendBuffer.writeUInt32BE(received, 0);
      client.write(sendBuffer);
      self.emit('xdcc-data', received, details);
    });

    client.on('end', function() {
      self.emit('xdcc-end', received, details);
    });

    client.on('error', function(err) {
      self.removeListener('connect', callbackHandler);
      callback(err, null, details);
      self.emit('xdcc-error', err, details);
    });
  });

  self.once('error', detach);
  self.say(hostUser, hostCommand);
};

