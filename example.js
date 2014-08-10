var irc = require('irc'),
    sxdcc = require('./lib/sxdcc'),
    fs = require('fs'),
    ProgressBar = require('progress');

if (process.argv.length < 4) {
  console.log('USAGE: node example.js BOTNAME PACKNUM [start]')
  return;
}

var user = 'desu' + Math.random().toString(36).substr(7, 3);
var bot = process.argv[2],
    pack = +process.argv[3],
    start = process.argv[4] ? +process.argv[4] : 0,
    progress;

console.log('Connecting...');

client = new irc.Client('irc.rizon.net', user, {
  channels: [ '#doki' ],
  userName: user,
  realName: user
}).on('join', function(channel, nick, message) {

  if (nick !== user) return;
  console.log('Joined', channel);

  var progress,
      last = 0;

  sxdcc(client, bot, pack, start, function(err, conn) {
    if (err) {
      console.log(err);
      return;
    }
    conn.on('connect', function(meta) {
      console.log('Connected: ' + meta.ip + ':' + meta.port);
      progress = new ProgressBar('Downloading... [:bar] :percent, :etas remaining', {
        incomplete: ' ',
        total: meta.filesize,
        width: 20
      });
      this.pipe(fs.createWriteStream(meta.filename));
    })

    .on('progress', function(recieved) {
      progress.tick(recieved - last);
      last = recieved;
    })

    .on('error', function(err) {
      console.log('XDCC ERROR: ' + JSON.stringify(err));
    });
  });
})

.on('error', function (err) {
    console.log("IRC ERROR: " + JSON.stringify(err));
})

.on('notice', function(from, to, message) {
  if (to == user && from == bot) {
    console.log("[notice]", message);
  }
});
