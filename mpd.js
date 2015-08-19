/**
 *returns an object representing an MPD web client
 */
function MPD(_port){

    /****************\
    |* private data *|
    \****************/

    var MPD = {
      /**
       * THE web socket that is connected to the MPD server
       */
      socket:null,

      /**
       * object {string:[function]} -- listing of funcitons to call when certain events happen
       *
       * valid handlers:
       * Connect
       * Disconnect
       * Queue
       * State
       * SongChange
       * Mpdhost
       * Error
       */
      handlers:{},

      /**
       * basically the same as above, but private and imutable and it's just a single function
       * called before the external handlers so they can screw with the event if they want
       */
      internal_handlers:{
        onConnect:onConnect,
        onDisconnect:onDisconnect,
        onStateChanged:onStateChanged,
        onQueueChanged:onQueueChanged,
        onPlaylistsChanged:onPlaylistsChanged,
        onPlaylistChanged:onPlaylistChanged
      },

      /**
       * number -- int number of milisecond to wait until reconnecting after loosing connection
       * set to something falsyto disable automatic reconnection
       */
      reconnect_time: 3000,

      /**
       *true if we want logging turned on
       */
      do_logging: true,

      /**
       *our understanding of what the server looks like
       */
      state:{
          /**
           * server protocol version
           */
          version: null,


          /**
           * boolean -- if we are currently connected to the server or not
           */
          connected:false,


          /**
           * string -- enum, PLAYING, STOPPED, PAUSED
           * actual attribute: state (int 0,1,2)
           */
          playstate: null,


          /**
           * int -- 0 to 100 the current volume
           */
          volume: null,


          /**
           * boolean -- true if the server is configured to repeat the current song
           */
          repeat: null,


          /**
           * boolean -- true if the server is configured to just play one song then quit
           */
          single: null,


          /**
           * boolean -- true if the server is configured to not repeat songs in a playlist
           */
          consume: null,


          /**
           * boolean -- true if the server is configured to play music in a random order
           */
          random: null,


          /**
           * float -- not sure what this is, but it's reported
           * actual attribute: mixrampdb
           */
          mix_ramp_threshold: null,


          /**
           * info about the currently playing song
           */
          current_song: {
              /**
               * int -- which song in the current playlist is active
               * actual attribute: song
               */
              playlist_idx: null,


              /**
               * float -- time into the currently playing song in seconds
               * actual attribute: elapsed
               */
              elapsed_time: null,


              /**
               * int -- the id of the current song
               * actual attribute: songid
               */
               id: null
          },

          next_song: {
              /**
               * int -- which song in the current playlist is active
               * actual attribute: song
               */
              playlist_idx: null,


              /**
               * int -- the id of the current song
               * actual attribute: songid
               */
               id: null
          },

          /**
           * the list of currently playing songs
           * the current playlist
           *
           * array of these:
           * {
           *  duration: int,
           *  id: int,
           *  pos: int,
           *  title: string
           * }
           */
          current_queue:[],

          /**
           * 'version' of the current queue
           * what ever that means
           */
          queue_version: null,

          /**
           * list of playlists
           *
           */
          playlists:[]

      },

      /**
       *valid tag values
       * null here means it's an open ended tag
       */
      tag_values:{
          any:null,
          artist:[],
          album:[],
          albumartist:[],
          title:null,
          track:null,
          name:[],
          genre:[],
          date:null,
          composer:[],
          performer:[],
          comment:[],
          disc:[]
      },

      /**
       * when was the status last updated
       */
      last_status_update_time: new Date(),

      /**
       * current processing method
       * called when ever we get some sort of responce
       * this gets changed as our expected responces changed
       * accepts an array WHICH IT WILL CHANGE eventually,
       * when the lines have comprised a complete command
       * this method may change it's self, so after calling this method,
       * this reference might point to a different method
       * defaults to do nothing
       *
       * understanding this variable is essential for understanding how this package works
       * this is basically a changable behaviour method
       */
      responceProcessor:function(lines){}
    };

    /*******************\
    |* private methods *|
    \*******************/

    /**
     * logging function
     */
    function log(message){
      if(MPD.do_logging){
        console.log("MPD Client: "+message);
      }
    }

    /**
     * wrapper for sending a message to the server, allows logging
     */
    function sendString(str){
        log('sending: "'+str+'"');
        MPD.socket.send_string(str);
    }


    /**
     * initalization funciton
     * called near the end of this file and when we need to reconnect
     */
    function init(){
      var websocket_url = getAppropriateWsUrl();
      var websocket = new Websock();
      websocket.open(websocket_url);

      //these can throw
      websocket.on(
          'open',
          function(){
              callHandler('Connect', arguments);
          }
      );
      websocket.on('message', onRawData);
      websocket.on(
          'close',
          function(){
              callHandler('Disconnect', arguments);
          }
      );
      MPD.socket = websocket;
    }


    /**
     * issue a command to the server
     * this assumes we are starting in and wish to return to an idle state
     */
    function issueCommand(command){
        if(!issueCommand.command){
            issueCommand.command = command+'\n';

            setTimeout(function(){
                sendString('noidle\n'+issueCommand.command+'idle\n');
                delete issueCommand.command;
            },50);
        }
        else{
            //append additional commands
            issueCommand.command += command+'\n';
        }
    }


    /**
     * private method that gets the right websocket URL
     */
    function getAppropriateWsUrl()
    {
      var protocol = '';
      var url = document.URL;

      /*
      /* We open the websocket encrypted if this page came on an
      /* https:// url itself, otherwise unencrypted
      /*/

      //figure out protocol to use
      if (url.substring(0, 5) == "https") {
          protocol = "wss://";
          url = url.substr(8);
      } else {
          protocol = "ws://";
          if (url.substring(0, 4) == "http")
              url = url.substr(7);
      }

      //change the url so it points to the root
      url = protocol+(url.split('/')[0]);

      if(_port){
        //use the port this client was initialized with
        url = url.replace(/:\d*$/,'')+':'+_port;
      }

      return url;
    }


    /**
     * converts an string to a Date
     */
    function parseDate(source){
        var value = null;
        var matches = null;
        if(matches = source.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/)){
            value = new Date();
            value.setFullYear(parseInt(matches[1],10));
            value.setMonth(parseInt(matches[2],10)-1);
            value.setDate(parseInt(matches[3],10));
            value.setHours(parseInt(matches[4],10));
            value.setMinutes(parseInt(matches[5],10));
            value.setSeconds(parseInt(matches[6],10));
        }
        return value;
    }


    /***************************\
    |* internal event handlers *|
    \***************************/


    /**
     * function called when the websocke connects
     */
    function onConnect(){
      log("connected");
      MPD.state.connected = true;
      MPD.responceProcessor = handleConnectionMessage;
    }


    /**
     * called when we disconnected (unexpectedly)
     */
    function onDisconnect(){
      log("disconnected");

      MPD.state.connected = false;
      MPD.socket = null;
      MPD.state.version = null;

      if(MPD.reconnect_time){
        setTimeout(init, MPD.reconnect_time);
      }

      MPD.responceProcessor = function(){};//do nothing
    }


    /**
     * the queue changed, this is the new queue
     */
    function onQueueChanged(event){
      MPD.state.current_queue = event;
    }


    /**
     * called when we have some data,
     * might be a message,
     * might be a fragment of a message,
     * might be multiple messages
     */
    function onRawData(){
        if(typeof onRawData.buffer === 'undefined'){
            onRawData.buffer = '';
            onRawData.lines = [];
        }
        onRawData.buffer += MPD.socket.rQshiftStr();
        var lines = onRawData.buffer.split('\n');
        onRawData.buffer = lines.pop(); //last line is incomplete
        onRawData.lines = onRawData.lines.concat(lines);

        lines.forEach(function(str){log('recived: "'+str+'"');});

        //keep processing untill we can't process any more
        var old_lines;
        while(onRawData.lines.length && old_lines != onRawData.lines.length){
            old_lines = onRawData.lines.length;
            MPD.responceProcessor(onRawData.lines);
        }
    }


    /**
     * the MPD server's state changed in some way
     */
    function onStateChanged(event){
        log('state');

        MPD.last_status_update_time = new Date();

        //normalize some of the event properties because I don't like them the way they are
        event.current_song = {
            playlist_idx: event.song,
            elapsed_time: event.elapsed,
            id: event.songid
        };
        delete event.song;
        delete event.elapsed;
        delete event.songid;

        event.mix_ramp_threshold = event.mixrampdb;
        event.playstate = event.state;
        event.queue_version = event.playlist;
        delete event.mixrampdb;
        delete event.state;
        delete event.playlist;

        event.next_song = {
            playlist_idx: event.nextsong,
            id: event.nextsongid
        };
        delete event.nextsong;
        delete event.nextsongid;

        for(property in event){
            MPD.state[property] = event[property];
        }
    }


    /**
     * queue has changed, this is the new one
     */
    function onQueue(event){
        MPD.state.current_queue = event;
    }


    /**
     * the list of playlists has changed
     */
    function onPlaylistsChanged(event){
        MPD.state.playlists = event;
    }


    /**
     * the list of playlist has changed
     */
    function onPlaylistChanged(event){
        MPD.state.playlists[event.idx].songs = event.songs;
    }


    /**
     * call all event handlers for the specified event
     */
    function callHandler(event_name, args){
        var handler_name = 'on'+event_name;

        if(MPD.internal_handlers[handler_name]){
            MPD.internal_handlers[handler_name](args);
        }

        if(!MPD.handlers[handler_name]){
            handler_name = 'onUnhandledEvent';
        }

        if(MPD.handlers[handler_name]){
            MPD.handlers[handler_name].forEach(function(func){
                try{
                    func(args, MPD.state);
                }
                catch(err){
                    dealWithError(err);
                }
            });
        }

        if(event_name !== 'Event'){
            callHandler('Event', {type:event_name, data:event.data});
        }
    }


    /**
     * add an event handler
     */
    function on(event_name, handler){

        var acceptable_handlers = ['Error', 'Event', 'UnhandledEvent', 'DatabaseChanging', 'DataLoaded', 'StateChanged', 'QueueChanged', 'PlaylistsChanged', 'PlaylistChanged','Connect', 'Disconnect'];

        if(acceptable_handlers.indexOf(event_name) === -1){
            throw new Error("'"+event_name+"' is not a supported event");
        }


        //bind the passed method to the client interface
        handler = handler.bind(this);

        var handler_name = 'on'+event_name;
        if(MPD.handlers[handler_name]){
            MPD.handlers[handler_name].push(handler);
        }
        else{
            MPD.handlers[handler_name] = [handler];
        }
    }

    /*************************************\
    |* process responces from the server *|
    |*          generates events         *|
    \*************************************/


    /**
     * we got some sort of error message from the server
     */
    function dealWithError(line){
        debugger;
        callHandler('Error', line);
        log('***ERROR*** '+line);
    }


    /**
     * return all of the lines upto one that matches the passed line
     * MUTATES lines
     */
    function getLines(lines, last_line){
        var end_line = -1;
        for(var i = 0; i<lines.length; i++){
            var line = lines[i];
            if(line === last_line){
                end_line = i;
                break;
            }
            if(line.indexOf('ACK') === 0){
                dealWithError(line);
                lines.splice(i,1);
                i--;
            }
        }

        if(end_line === -1){
            return null;
        }
        return lines.splice(0, end_line+1);
    }


    /**
     * generic responce handler
     * deals with a responce that is a list of some sort of datastructure repeated over and over
     */
    function processListResponce(lines){
        var output = [];
        var current_thing = null;
        var starting_key = null; //the key that starts off an object
        //so, we get an undiferentiated stream of key/value pairs
        lines.forEach(function(line){
            if(!current_thing){
                current_thing = {};
            }
            var key = line.replace(/([^:]+): (.*)/,'$1');
            var value = line.replace(/([^:]+): (.*)/,'$2');
            var date = null;
            if(value.length>0){
                if(value.match(/^\d*(\.\d*)?$/)){
                    value = parseFloat(value);
                }
                else if(date = parseDate(value)){
                    value = date;
                }
            }
            key = key.toLowerCase();
            key = key.replace(/[^\w\d]+/g, '_');

            //we are starting a new object
            if(key === starting_key){
                output.push(current_thing);
                current_thing = {};
            }
            current_thing[key] = value;

            //we want to skip the first, starting key so this is down here
            if(starting_key === null){
                starting_key = key;
            }

        });

        //get the last one
        if(current_thing){
            output.push(current_thing);
        }

        return output;
    }


    /**
     * generic handler for loading a list of records in a responce
     */
    function getlistHandler(onDone, event_type, transformFunction){
        return function(lines){
            var message_lines = getLines(lines, 'OK');
            if(message_lines === null){
                return; //we got an incomplete list, bail wait for the rest of it
            }
            message_lines.pop();//get rid of the 'OK' line
            if(message_lines.length > 0){
                var list = processListResponce(message_lines);
                //optional transformation function
                if(transformFunction){
                    list = transformFunction(list);
                }
                //we have an event!
                if(event_type){
                    callHandler(event_type,list);
                }
                onDone(list);
            }
            else{
                if(event_type){
                    callHandler(event_type,[]);
                }
                onDone([]);
            }
        };
    }

    /**
     * given a change key, return the command that will result in getting the changed data
     */
    function figureOutWhatToReload(change, actions){
        switch(change){
            case 'database': //the song database has been modified after update.
                //reload
                //everything
                actions.everything = true;
            break;

            case 'stored_playlist': //a stored playlist has been modified, renamed, created or deleted
                actions.playlist = true;
            break;

            case 'playlist': //the current playlist has been modified
                actions.queue = true;
            break;

            /*these are all status changed*/
            case 'player': //the player has been started, stopped or seeked
            case 'mixer': //the volume has been changed
            case 'output': //an audio output has been enabled or disabled
            case 'options': //options like repeat, random, crossfade, replay gain
                actions.status = true;
            break;

            /*these are things I'm not interested in (yet)*/
            case 'update': //a database update has started or finished. If the database was modified during the update, the database event is also emitted.
                //we don't want to do anything, but the front end might be interested in knowing about it
                callHandler('DatabaseChanging');
            case 'sticker': //the sticker database has been modified.
            case 'subscription': //a client has subscribed or unsubscribed to a channel
            case 'message': //a message was received on a channel this client is subscribed to; this event is only emitted when the queue is empty
            default:
                //default do nothing
        }
    }

    /**
     * wait for something to change
     * this is the state we spend most of out time in
     */
    function idleHandler(lines){
        var message_lines = getLines(lines, 'OK');
        message_lines.pop();//get rid of the 'OK' line
        if(message_lines.length > 0){
            var actions = {};
            message_lines.forEach(function(line){
                var change = line.replace(/([^:]+): (.*)/,'$2');
                figureOutWhatToReload(change, actions);
            });

            if(actions.everything){
                //don't even bother doing anything fancy
                loadEverything();
            }
            else{
                //now we have to make this hellish patchwork of callbacks for loading all the stuff we need
                //in the right order
                //I could probly just rename these and move them somewhere and this would be a lot more readable...

                //this is the basic one, we should always end with this
                function goBackToWaiting(){
                    MPD.responceProcessor = idleHandler;
                    sendString('idle\n');
                }

                //reload the statuses
                function reloadStatus(){
                    MPD.responceProcessor = getStateHandler(function(){
                        goBackToWaiting();
                    });
                    sendString('status\n');
                }

                //reload the queue, the status, then go back to waiting
                function reloadQueue(){
                    MPD.responceProcessor = getQueueHandler(
                        function(){
                            reloadStatus();
                        },
                        'QueueChanged'
                    );
                    sendString('playlistinfo\n');
                }

                //reloading all the stuff we need to reload
                function reloadStuff(){
                    if(actions.queue){
                        reloadQueue();
                    }
                    else if(actions.status){
                        reloadStatus();
                    }
                    else{
                        goBackToWaiting();
                    }
                }

                //maybe do this after reloading playlists
                if(actions.playlist){
                    loadAllPlaylists(reloadStuff);
                }
                else{
                    reloadStuff();
                }
            }
        }
        else{
            if(idleHandler.postIdle){
                MPD.responceProcessor = idleHandler.postIdle;
                delete idleHandler.postIdle;
            }
        }
    }


    /**
     * we are expecting a connection responce
     */
    function handleConnectionMessage(lines){
        if(lines.length < 1){
            return;
        }
        var line = lines.shift(1);
        MPD.state.version = line.replace(/^OK MPD /, '');

        loadEverything();
    }


    /**
     * method name says it all
     */
    function loadEverything(){
        //this loads all of the data from the MPD server we need
        //it gets the queue first, then the state (because the state references the queue), then all of the playlist data
        MPD.responceProcessor = getQueueHandler(function(){
            MPD.responceProcessor = getStateHandler(function(){
                loadAllPlaylists(function(){
                    loadAllTagValues(function(){
                        callHandler('DataLoaded',MPD.state);

                        //ok everything is loaded...
                        //just wait for something to change and deal with it
                        MPD.responceProcessor = idleHandler;
                        sendString('idle\n');
                    });
                });
            });
            sendString('status\n');
        }, 'QueueChanged');

        //request state info, start the initial data load cascade
        sendString('playlistinfo\n');
    }


    /**
     * reload all playlists
     */
    function loadAllPlaylists(onDone){
        MPD.responceProcessor = getPlaylistsHandler(function(){
            //ok, because this wasn't complicated enough allready
            //we have to load the contents of each playlist, but we have to do it sequentially
            //but asynchronusly :)

            //load a list
            var list_idx = 0;
            (function loadList(){
                if(list_idx >= MPD.state.playlists.length){
                    onDone();
                }
                else{
                    MPD.responceProcessor = getPlaylistHandler(loadList, list_idx);
                    sendString('listplaylistinfo '+MPD.state.playlists[list_idx].playlist+'\n');
                    list_idx++;
                }
            })();
        });
        sendString('listplaylists\n');
    }


    /**
     * reload all valid tag values
     */
    function loadAllTagValues(onDone){

        //get a list of tags we want possible values for
        var tags = [];
        for(tag in MPD.tag_values){
            if(MPD.tag_values[tag] !== null){
                tags.push(tag);
            }
        }
        var tag_idx = 0;

        //set the responce processor to add results to tags until we are done, then call on done
        MPD.responceProcessor = getlistHandler(function(list){
            MPD.tag_values[tags[tag_idx]] = list.map(function(obj){return obj[tags[tag_idx]]+'';});
            tag_idx++;
            if(tag_idx >= tags.length){
                onDone();
            }
            else{
                sendString('list '+tags[tag_idx]+'\n');
            }
        });
        sendString('list '+tags[tag_idx]+'\n');
    }


    /**
     * we are expecting a state responce
     * this is what we do when we get it
     */
    function getStateHandler(onDone){
        return function(lines){
            var message_lines = getLines(lines, 'OK');
            message_lines.pop();//get rid of the 'OK' line
            if(message_lines.length > 0){
                var state = {};
                message_lines.forEach(function(line){
                    var key = line.replace(/([^:]+): (.*)/,'$1');
                    var value = line.replace(/([^:]+): (.*)/,'$2');
                    if(value.match(/^\d*(\.\d*)?$/)){
                        value = parseFloat(value);
                    }
                    state[key] = value;
                });
                //we have a state event!
                callHandler('StateChanged',state);
                onDone();
            }
        };
    }


    /**
     * handler for the current queue
     */
    function getQueueHandler(onDone, event_type){
        return getlistHandler(onDone, event_type);
    }


    /**
     * handler for the list of playlists
     */
    function getPlaylistsHandler(onDone){
        return getlistHandler(onDone, 'PlaylistsChanged');
    }


    /**
     * handler for the list of playlists
     */
    function getSearchHandler(onDone){
        return getlistHandler(
            function(){
                onDone.apply(null, arguments);
                MPD.responceProcessor = idleHandler;
            }
        );
    }


    /**
     * handler for loading a single playlist
     */
    function getPlaylistHandler(onDone, playlist_idx){
        return getlistHandler(
            onDone,
            'PlaylistChanged',
            function(list){
                return {
                    idx: playlist_idx,
                    songs: list
                };
            }
        );
    }


    /******************\
    |* public methods *|
    \******************/


    /**
     * get the current play time
     */
    function getCurrentSongTime(){
        var current_song = getCurrentSong();
        if(!current_song){
            return 0;
        }

        var offset = 0;
        if(MPD.state.playstate === 'play'){
            var now = new Date();

            offset = (now.getTime() - MPD.last_status_update_time.getTime())/1000;
        }

        var last_time = MPD.state.current_song.elapsed_time;
        last_time = last_time?last_time:0;

        return Math.min(last_time + offset, current_song.time);
    }


    /**
     * get the song identified by it's position on the current queue, or null
     */
    function getSongOnQueue(idx){
        var song = null;
        if(idx !== null && MPD.state.current_queue[idx]){
            song = MPD.state.current_queue[idx];
        }
        return cloneObject(song);
    }


    /**
     * get the current song, or null
     */
    function getCurrentSong(){
        return getSongOnQueue(MPD.state.current_song.playlist_idx);
    }


    /**
     * get the song next on the queue, or null
     */
    function getNextSong(){
        return getSongOnQueue(MPD.state.next_song.playlist_idx);
    }

    /**
     * make a deep copy of the passed object/array/primitive
     */
    function cloneObject(obj){
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * params is a {tag<string> => value<string>} object, valid tags are enumerated in getTagTypes
     * onDone is a function that should be called on complete, will be passed an array of song objects
     */
    function doSearch(params, onDone){
        var query = 'search';
        for(key in params){
            var value = params[key];
            query += ' '+key+' "'+value+'"';
        }
        idleHandler.postIdle = getSearchHandler(onDone);
        issueCommand(query);
    }

    /**
     * returns a list of valid search tag types
     */
    function getTagTypes(){
        return Object.keys(MPD.tag_values);
    }

    /********\
    |* INIT *|
    \********/
    init();
    //see I told you it was called down here

    /********************\
    |* public interface *|
    \********************/
    return {
        on: on,

        getState:               function(){return cloneObject(MPD.state);},
        disableLogging:         function(){MPD.do_logging = false;},
        enableLogging:          function(){MPD.do_logging = true;},
        getPort:                function(){return _port;},
        getProtocolVersion:     function(){return MPD.state.version;},
        isConnected:            function(){return MPD.state.connected == true;},
        getPlaystate:           function(){return MPD.state.playstate;},
        getVolume:              function(){return MPD.state.volume;},
        isRepeat:               function(){return MPD.state.repeat == true;},
        isSingle:               function(){return MPD.state.single == true;},
        isConsume:              function(){return MPD.state.consume == true;},
        isRandom:               function(){return MPD.state.random == true;},
        getMixRampThreashold:   function(){return MPD.state.mix_ramp_threshold;},

        getCurrentSong:getCurrentSong,
        getCurrentSongTime:getCurrentSongTime,
        getCurrentSongID:function(){return MPD.state.current_song.id;},
        getCurrentSongQueueIndex:function(){return MPD.state.current_song.playlist_idx;},

        getNextSong:getNextSong,
        getNextSongID:function(){return MPD.state.next_song.id;},
        getNextSongQueueIndex:function(){return MPD.state.next_song.playlist_idx;},

        getQueue:function(){return cloneObject(MPD.state.current_queue);},
        getQueueVersion:function(){return MPD.state.queue_version;},

        getPlaylists:function(){return cloneObject(MPD.state.playlists);},
        getPlaylistByName:function(name){var ret = null; MPD.state.playlists.forEach(function(p){if(p.playlist==name)ret = p;}); return ret;},

        setPlayConsume:     function(STATE){issueCommand('consume '+(STATE?1:0));},     // boolean -- Sets consume state to STATE, STATE should be 0 or 1. When consume is activated, each song played is removed from playlist.
        setPlayCrossfade:   function(SECONDS){issueCommand('crossfade '+SECONDS);},     // float -- Sets crossfading time between songs.
        setPlayRandom:      function(STATE){issueCommand('random '+(STATE?1:0));},      // boolean -- Sets random state to STATE, STATE should be 0 or 1.
        setPlayRepeat:      function(STATE){issueCommand('repeat '+(STATE?1:0));},      // boolean -- Sets repeat state to STATE, STATE should be 0 or 1.
        setPlaySingle:      function(STATE){issueCommand('single '+(STATE?1:0));},      // boolean -- Sets single state to STATE, STATE should be 0 or 1. When single is activated, playback is stopped after current song, or song is repeated if the 'repeat' mode is enabled.
        setMixRampDb:       function(deciBels){issueCommand('mixrampdb '+deciBels);},   // float -- Sets the threshold at which songs will be overlapped. Like crossfading but doesn't fade the track volume, just overlaps. The songs need to have MixRamp tags added by an external tool. 0dB is the normalized maximum volume so use negative values, I prefer -17dB. In the absence of mixramp tags crossfading will be used. See http:     // sourceforge.net/projects/mixramp
        setMixRampDelay:    function(SECONDS){issueCommand('mixrampdelay '+SECONDS);},  // float/string -- Additional time subtracted from the overlap calculated by mixrampdb. A value of "nan" disables MixRamp overlapping and falls back to crossfading.
        setVolume:          function(VOL){issueCommand('setvol '+VOL);},                // float -- Sets volume to VOL, the range of volume is 0-100.

        play:       function(SONGPOS){issueCommand(SONGPOS?('play '+SONGPOS):'play');},                     // int optional -- Begins playing the playlist at song number SONGPOS.
        playById:   function(SONGID){issueCommand('playid '+SONGID);},                                      // int optional -- Begins playing the playlist at song SONGID.
        pause:      function(PAUSE){issueCommand('pause '+((PAUSE||typeof PAUSE == 'undefined')?1:0));},    // boolean -- sets pause/resumes playing
        next:       function(){issueCommand('next');},                                                      // Plays next song in the playlist.
        previous:   function(){issueCommand('previous');},                                                  // Plays previous song in the playlist.
        seek:       function(TIME){issueCommand('seekid '+MPD.state.current_song.id+' '+TIME);},                  // float -- Seeks to the position TIME (in seconds; fractions allowed) within the current song. If prefixed by '+' or '-', then the time is relative to the current playing position.
        stop:       function(){issueCommand('stop');},                                                      // Stops playing.

        addSongToQueueByFile:           function(filename){issueCommand('add "'+filename+'"');},                // string -- Adds the file URI to the playlist (directories add recursively). URI can also be a single file.
        clearQueue:                     function(){issueCommand('clear');},                                     // Clears the current playlist.
        removeSongFromQueueByPosition:  function(position){issueCommand('delete '+position);},                  // int -- Deletes a song from the playlist.
        removeSongsFromQueueByRange:    function(start, end){issueCommand('delete '+start+' '+end);},           // int -- Deletes a range of songs from the playlist.
        removeSongsFromQueueById:       function(id){issueCommand('deleteid '+id);},                            // int -- Deletes the song SONGID from the playlist
        moveSongOnQueueByPosition:      function(position, to){issueCommand('move '+position+' '+to);},         // int, int -- Moves the song at FROM or range of songs at START:END to TO in the playlist. [6]
        moveSongsOnQueueByPosition:     function(start, end, to){issueCommand('move '+start+' '+end+' '+to);},  // int, int, int -- Moves the song at FROM or range of songs at START:END to TO in the playlist. [6]
        moveSongOnQueueById:            function(id, to){issueCommand('moveid '+id+' '+to);},                   // int, int -- Moves the song with FROM (songid) to TO (playlist index) in the playlist. If TO is negative, it is relative to the current song in the playlist (if there is one).
        shuffleQueue:                   function(){issueCommand('shuffle');},                                   // Shuffles the current playlist.
        swapSongsOnQueueByPosition:     function(pos1, pos2){issueCommand('swap '+pos1+' '+pos2);},             // int int -- Swaps the positions of SONG1 and SONG2.
        swapSongsOnQueueById:           function(id1, id2){issueCommand('swapid '+id1+' '+id2);},               // int int -- Swaps the positions of SONG1 and SONG2 (both song ids).

        loadPlaylistIntoQueue:          function(playlist_name){issueCommand('load "'+playlist_name+'"');},  // string -- Loads the playlist into the current queue. Playlist plugins are supported.
        saveQueueToPlaylist:            function(playlist_name){issueCommand('save "'+playlist_name+'"');},  // string -- Saves the current playlist to NAME.m3u in the playlist directory.

        addSongToPlaylistByFilename:    function(playlist_name, filename){issueCommand('playlistadd "'+playlist_name+'" "'+filename+'"');},         // string, string -- Adds URI to the playlist NAME.m3u. NAME.m3u will be created if it does not exist.
        clearPlaylist:                  function(playlist_name){issueCommand('playlistclear "'+playlist_name+'"');},                                // string -- Clears the playlist NAME.m3u.
        removeSongFromPlaylist:         function(playlist_name, position){issueCommand('playlistdelete "'+playlist_name+'" '+position);},           // string, int -- Deletes SONGPOS from the playlist NAME.m3u.
        moveSongOnPlaylistById:         function(playlist_name, id, position){issueCommand('playlistmove "'+playlist_name+'" '+id+' '+position);},  // string, int, int -- Moves SONGID in the playlist NAME.m3u to the position SONGPOS.
        renamePlaylist:                 function(playlist_name, new_name){issueCommand('rename "'+playlist_name+'" "'+new_name+'"');},              // string, string -- Renames the playlist NAME.m3u to NEW_NAME.m3u.
        deletePlaylist:                 function(playlist_name){issueCommand('rm "'+playlist_name+'"');},                                           // string -- Removes the playlist NAME.m3u from the playlist directory.

        updateDatabase:                 function(){issueCommand('update');},     //Updates the music database: find new files, remove deleted files, update modified files.

        //TODO:
        //listallinfo(directory, onComplete) //string optional -- Lists all songs and directories in URI. also returns metadata info in the same format as listplaylists.

        getTagTypes:                    getTagTypes,    //return an array of strings which are all of the valid tags
        getTagOptions:                  function(tag){return MPD.tag_values[tag]?MPD.tag_values[tag]:null;}, //return an array of strings which are all of the values the passed tag is allowed to have, or null if the tag is unconstrained
        search:                         doSearch        //params is a {tag<string> => value<string>} object, valid tags are enumerated in getTagTypes, onDone is a function that should be called on complete, will be passed an array of song objects
    };
};
