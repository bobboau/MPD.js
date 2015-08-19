MPD.js: the Javascript MPD client library
=========================================

Intro
-----

MPD.js is a javascript library for interfacing with an [MPD](http://www.musicpd.org/) server. It is not a full client, it is simply a back end providing a simple, easy to use interface upon which a full client can be built. If you are looking for a full web based MPD GUI client, I'll be working on one of those shortly using MPD. Until then, maybe what you are looking for is something more like [ympd](https://github.com/notandy/ympd)?

MPD.js is dependent on [Websockify](https://github.com/kanaka/websockify) and Websockify's [websock](https://github.com/kanaka/websockify/wiki/websock.js) library to provide interoperability (because as of now MPD lacks native websocket support). MPD.js provides an abstraction around the traditional low level socket management for handling the mpd protocol and for keeping a consistent state in sync that can be easily queried at any time, as well as providing events you can subscribe to so you know when it's time to update your UI. MPD.js also exposes a simple interface for issuing commands for controlling an MPD server such as play/pause/playlist management/etc.

Installation and Setup
---------------------

On the client side there is nothing you need to do other than include the requisite Websockify javascript files (base64.js, util.js, websock.js) and mpd.js it's self. I have included a copy of websocketify's javascript files in the demo directory, though I am unlikely to keep this up to date and you should not rely on it beyond, maybe initial testing. Once you have included these files the MPD namespace should be available to you in your application and you should be able to instantiate clients. They won't work yet of course, because you have yet to do your sever-side setup.

On your server, you need to have a running instance of MPD. Getting MPD running and configured properly is way, WAY beyond the scope of this document (look here)[http://www.musicpd.org/doc/user/] for that. Now assuming you have a working instance of MPD up and you've managed to connect another client and it works just fine and everything you need to get an instance of [Websockify](https://github.com/kanaka/websockify) running to act as the websocket <=> traditional socket proxy. Once you have Websockify downloaded and you have navigated to it's directory and assuming you use the standard port for MPD, you can start up an instance of it that should allow you to get started with MPD.js with the following command:

    ./run 8800 localhost:6600

That should allow you to make an MPD client instance on port 8800 that works.

You might also find this command helpful for a simple webserver for development purposes

    python -m SimpleHTTPServer

Usage
-----

Using MPD.js should be the easy part of your soon to be MPD enabled application. The lifecycle begins by making a MPD client instance.

    var mpd_client = MPD(8800);

This will provide you with the needed interface to control your MPD server. It will not have any data until it has connected, you need to wait until that has happened and MPD.js will tell you when that time has come by subscribing to one of it's many events. For instance, lets say you have a function defined somewhere for dealing with status changes (new song, volume changed, options changed, etc). You want to do something like the following:

    client.on('StateChanged',function(state){
        stateChanged(state);
    });

MPD.js will provide you with an object representing the server's state. You might find it easier to use the MPD.js client object directly, as it has a number of methods for simplifying the task of getting data (for instance mpd_client.getCurrentSong() is equivilent to state.current_queue[stat.current_song.queue_idx]) and some like getCurrentSongTime are the only practical way to get some information.
