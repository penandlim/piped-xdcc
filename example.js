var irc = require('./lib/xdcc').irc;
var fs = require('fs');
var ProgressBar = require('progress');

if (process.argv.length != 4) {
  console.log('USAGE: node example.js BOTNAME PACKNUM')
  return;
}

var user = 'desu' + Math.random().toString(36).substr(7, 3);
var hostUser = process.argv[2], pack = +process.argv[3], progress;

console.log('Connecting...');
var client = new irc.Client('irc.rizon.net', user, {
  channels: [ '#doki' ],
  userName: user,
  realName: user
});

client.on('join', function(channel, nick, message) {
  if (nick !== user) return;
  console.log('Joined', channel);
  client.getXdcc(hostUser, 'xdcc send #' + pack, function(err, data, details) {
    if (err)
      return console.log('ERROR:\n' + err);
    data.pipe(fs.createWriteStream('./' + details.file));
  });
});

client.on('xdcc-connect', function(meta) {
  console.log('Connected: ' + meta.ip + ':' + meta.port);
  progress = new ProgressBar('Downloading... [:bar] :percent, :etas remaining', {
    incomplete: ' ',
    total: meta.length,
    width: 20
  });
});

var last = 0;
client.on('xdcc-data', function(received) {
  progress.tick(received - last);
  last = received;
});

client.on('xdcc-end', function(received) {
  console.log('Download completed');
});

client.on('notice', function(from, to, message) {
  if (to == user && from == hostUser) {
    console.log("[notice]", message);
  }
});

client.on('error', function(message) {
  console.error(message);
});
