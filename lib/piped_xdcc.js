var net = require("net"),
  util = require("util"),
  PassThrough = require("stream").PassThrough;

exports.pipeXdccRequest = pipeXdccRequest;

function pipeXdccRequest(client, packInfo, callback) {
  var botNickname = packInfo.botNickname;
  var packNumber = packInfo.packNumber;

  client.on("no-such-nick", handleBotMissing);
  client.on("ctcp-privmsg", handleMessage);

  client.say(botNickname, "XDCC SEND #" + packNumber);

  function handleBotMissing() {
    cleanError("There is no [" + botNickname + "] in the channel");
  }

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
    var xdccConnection = new PipedXdccConnection(config);
    xdccConnection.once("destroyed", function (finished) {
      if (!finished && client) {
        client.say(botNickname, "XDCC CANCEL");
      }
    });
    callback(null, xdccConnection);
  }
}

util.inherits(PipedXdccConnection, PassThrough);
function PipedXdccConnection(config) {
  var self = this;
  PipedXdccConnection.super_.call(self);

  var connection,
    sendBuffer = new Buffer(4),
    totalReceived = 0,
    ack = totalReceived,
    finished = false;

  connection = net.connect(config.port, config.ip, function () {
    self.emit("connect", config);
  });

  connection
    .on("data", function (data) {
      totalReceived += data.length;

      ack += data.length;
      while (ack > 0xFFFFFFFF) {
        ack -= 0xFFFFFFFF;
      }

      sendBuffer.writeUInt32BE(ack, 0);
      connection.write(sendBuffer);
      self.emit('progress', totalReceived);
    })
    .once('end', function () {
      finished = true;
      self.emit("complete", config);
      kill();
    })
    .on('error', function (error) {
      self.emit("dlerror", error, config);
      kill();
    })
    .pipe(self);

  self.cancel = function () {
    kill();
  };

  function kill() {
    connection.destroy();
    self.emit('destroyed', finished);
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
