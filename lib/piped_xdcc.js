var net = require("net"),
  util = require("util"),
  PassThrough = require("stream").PassThrough;

function pipeXdcc(client, packInfo, callback) {
  var botNickname = packInfo.botNickname;
  var packNumber = packInfo.packNumber;

  client.on("ctcp-privmsg", handleMessage);

  client.say(packInfo, "XDCC SEND #" + packNumber);

  function handleMessage(sender, target, message) {
    if (target !== client.nick || sender !== botNickname) {
      return;
    }

    var messageInfo = parseMessage(message);
    if (!messageInfo) {
      cleanError("Message from bot could not be parsed");
      return;
    }

    switch (messageInfo.command) {
      case "SEND":
        createXdccConnection(messageInfo);
        break;

      default:
        cleanError("Received unhandled command from bot");
        break;
    }
  }

  function cleanError(message) {
    client.removeListener("ctcp-privmsg", handleMessage);
    callback(message);
  }

  function createXdccConnection(config) {
    client.removeListener("ctcp-privmsg", handleMessage);
    var xdccConnection = new XdccConnection(config);
    xdccConnection.once("destroyed", function (finished) {
      if (!finished && client) {
        client.say(botNickname, "XDCC CANCEL");
      }
    });
    callback(null, xdccConnection);
  }
}

util.inherits(XdccConnection, PassThrough);
function XdccConnection(config) {
  var self = this;
  XdccConnection.super_.call(self);

  var connection,
    sendBuffer = new Buffer(4),
    received = 0,
    ack = received,
    finished = false;

  connection = net.connect(config.port, config.ip, function () {
    self.emit("connect", config);
  });

  connection
    .on("data", function (data) {
      received += data.length;

      // TODO *** Not sure if this is required when piping
      ack += data.length;
      while (ack > 0xFFFFFFFF) {
        ack -= 0xFFFFFFFF;
      }

      sendBuffer.writeUInt32BE(ack, 0);
      self.connection.write(sendBuffer);
      self.emit('progress', received);
    })
    .once('end', function () {
      if (received == config.filesize) {
        finished = true;
        self.emit("complete", config);
      } else if (received != config.filesize && !finished) {
        self.emit("dlerror", config, "Server unexpected closed connection");
      } else if (received != config.filesize && finished) {
        self.emit("dlerror", config, "Server closed connection, download canceled");
      }

      kill();
    })
    .on('error', function (error) {
      self.emit("dlerror", error, config);
      kill();
    })
    .pipe(self);

  self.on("cancel", cancel);

  function cancel() {
    finished = true;
    kill();
  }

  function kill() {
    self.connection.destroy();
    self.emit('destroyed', finished);
    self.removeAllListeners();
  }
}

function uint32ToIP(n) {
  var octets = [];

  octets.unshift(n & 255);
  octets.unshift((n >> 8) & 255);
  octets.unshift((n >> 16) & 255);
  octets.unshift((n >> 24) & 255);

  return octets.join('.');
}

function parseMessage(msg) {
  var parts = msg.match(/DCC (\w+) "?'?(.+?)'?"? (\d+) (\d+) ?(\d+)?/);

  var messageInfo = {
    command: parts[1],
    filename: parts[2]
  };

  if (messageInfo.command === "SEND") {
    messageInfo.ip = uint32ToIP(+parts[3]);
    messageInfo.port = +parts[4];
    messageInfo.filesize = +parts[5];
  }

  return messageInfo;
}

module.exports = pipeXdcc;
