node-xdcc
=========

Monkey-patches `node-irc` to do xdcc file transfers.

This fork utilizes stream callbacks rather than writing to a file.

Usage
-----

First:

    npm install xdcc

See [example.js](https://github.com/metakirby5/node-xdcc-stream/blob/master/example.js) for a comprehensive example.
You'll need to `npm install progress` for it to work correctly.
