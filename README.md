piped-xdcc
==========

client refers to irc.Client() created with node-irc
socket is socket.io instance generated by "connection" event. Not really needed so you an take them out if you don't need sockets.

add this line to your package.json:
{
...
    "piped-xdcc": "penandlim/piped-xdcc"
}

Dependencies I used:

"dependencies": {
    "ejs": "2.5.6",
    "express": "4.15.2",
    "irc": "martynsmith/node-irc",
    "mime-types": "^2.1.17",
    "piped-xdcc": "penandlim/piped-xdcc",
    "socket.io": "^2.0.3"
  },
