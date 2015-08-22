var UI = (function(){

    /**
     * mapping between html classnames and MPD client methods to call to update them
     */

    var CLASS_MAP = {
        port:function(element){
            return getClient(element).getPort();
        },
        protocol:function(element){
            return getClient(element).getProtocolVersion();
        },
        connected:function(element){
            return getClient(element).isConnected();
        },
        playstate:function(element){
            return getClient(element).getPlaystate();
        },
        volume:function(element){
            return getClient(element).getVolume();
        },
        repeat:function(element){
            return getClient(element).isRepeat();
        },
        single:function(element){
            return getClient(element).isSingle();
        },
        consume:function(element){
            return getClient(element).isConsume();
        },
        random:function(element){
            return getClient(element).isRandom();
        },
        cur_song_album:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getAlbum();
        },
        cur_song_artist:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getArtist();
        },
        cur_song_id:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getId();
        },
        cur_song_last_modified:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getLastModified();
        },
        cur_song_pos:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getQueuePosition();
        },
        cur_song_duration:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getDuration();
        },
        cur_song_elapsed_time:function(element){
            return Math.round(getClient(element).getCurrentSongTime()*10)/10;
        },
        cur_song_file:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getPath();
        },
        cur_song_title:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getDisplayName();
        },
        cur_song_track:function(element){
            var song = getClient(element).getCurrentSong(); return (!song)?'':song.getTrack();
        },
        next_song_album:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getAlbum();
        },
        next_song_artist:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getArtist();
        },
        next_song_id:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getId();
        },
        next_song_last_modified:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getLastModified();
        },
        next_song_pos:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getQueuePosition();
        },
        next_song_duration:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getDuration();
        },
        next_song_file:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getPath();
        },
        next_song_title:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getDisplayName();
        },
        next_song_track:function(element){
            var song = getClient(element).getNextSong(); return (!song)?'':song.getTrack();
        },
        queue:function(element){
            return getClient(element).getQueue().getSongs().map(function(song){
                return {
                    key:song.getId(),
                    value:song.getDisplayName()
                };
            });
        },
        playlists:function(element){
            return [{key:'',value:'Load Playlist'}].concat(
                getClient(element).getPlaylists().map(function(playlist, idx){
                    return {
                        key:playlist.getName(),
                        value:playlist.getName()
                    };
                })
            );
        },
        playlist:function(element){
            var playlist_id = getDeferedInt(element,'mpd_playlist_id');
            var playlist = getClient(element).getPlaylistByName(playlist_id);
            if(playlist){
                return playlist.getSongs().map(function(song){
                    return song.getDisplayName();
                });
            }
            else{
                return [];
            }
        }
    };

    /****************\
    |* private data *|
    \****************/
    var UI = {
        /**
         * collection of clients
         */
        mpd_clients : []
    };


    /********\
    |* INIT *|
    \********/
    $(function(){
        for(var i = 0; i<1; i++){
            var client = MPD(8800);
            client.id = i;
            UI.mpd_clients.push(client);

            client.on('StateChanged',function(){
                updateElements($('.MPD'));
            });

            client.on('QueueChanged',function(){
                updateElements($('.MPD select.MPD_cur_song_id'));
            });

            client.on('PlaylistsChanged',function(){
                updateElements($('.MPD [data-MPD_data_map="playlists"]'));
            });

            client.on('DataLoaded',function(){
                var element = $('.MPD_file_list_placeholder');
                var client = getClient(element);
                element.replaceWith(makeFileListElement(MPD.Directory(client, {directory:'/', last_modified:new Date()})));
            });
        }

        setInterval(function(){
            updateElements($('.MPD_cur_song_elapsed_time'));
        },150);
    });


    /*******************\
    |* private methods *|
    \*******************/


    /**
     * gets the int hiding somewhere in the perents of the passed element
     */
    function getDeferedInt(element, data_key){
        var data_parent = $(element).parents('[data-'+data_key+']');
        if(!data_parent){
            return null;
        }
        var data = data_parent.data(data_key)+'';
        if(!data.match(/^\d+$/)){
            data = data_parent.find(data).val();
        }
        if(!data.match(/^\d+$/)){
            return data;
        }
        return parseInt(data, 10);
    }


    /**
     * gets the client associated with this element
     */
    function getClient(element){
        var client_id = getDeferedInt(element, 'mpd_client_id');
        return UI.mpd_clients[client_id];
    }


    /**
     * updates the elements in the passed jquery selection
     */
    function updateElements(selection){
        var selector = "[class^='MPD_'],[data-MPD_data_map]";
        $(selection).find(selector).andSelf().filter(selector).each(function(idx, element){
            element = $(element);
            //get the class_name related mappers
            var matches = (!element.attr('class'))?[]:element.attr('class').match(/MPD_[\w_]+/g).map(function(str){return str.substring(4)});
            //get the manual mappings
            var mappers = element.data('mpd_data_map');
            if(mappers){
                matches = mappers.split(',').concat(matches);
            }
            matches.forEach(function(mapper){
                //normalize these
                mapper = mapper.split(':');
                var dest = (mapper.length>1)?mapper[1]:null;
                mapper = mapper[0];

                var updateFunction = CLASS_MAP[mapper];
                if(updateFunction){
                    var val = updateFunction(element);

                    if(dest){
                        element.prop(dest,val);
                    }
                    else{
                        if(element.is('input,select') && typeof val != 'object'){
                            if(element.is(':checkbox')){
                                element.prop('checked', val);
                            }
                            else{
                                element.val(val);
                            }
                        }
                        else{
                            if(typeof val === 'object'){
                                var new_val = '';
                                $.each(val,function(index,item){
                                    if(element.is('select')){
                                        if(typeof item == 'object'){
                                            new_val += '<option value='+item.key+'>'+item.value+'</option>';
                                        }
                                        else{
                                            new_val += '<option value='+index+'>'+item+'</option>';
                                        }
                                    }
                                    else{
                                        new_val += item;
                                    }
                                });
                                val = new_val;
                            }
                            element.html(val);
                        }
                    }
                }
            });
        });
    }

    /******************\
    |* public methods *|
    \******************/

    /**
     * start playing
     * element -- the element that triggered the event (tells us which client to use)
     */
    function play(element){
        getClient(element).play();
    }

    /**
     * start playing the song that has the id identified by the value of the input element
     * element -- the element that triggered the event (tells us which client to use)
     */
    function playSong(element){
        getClient(element).playById($(element).val());
    }


    /**
     * pause playback
     * element -- the element that triggered the event (tells us which client to use)
     */
    function pause(element){
        getClient(element).pause();
    }


    /**
     * stop playing
     * element -- the element that triggered the event (tells us which client to use)
     */
    function stop(element){
        getClient(element).stop();
    }


    /**
     * revert to the previous song
     * element -- the element that triggered the event (tells us which client to use)
     */
    function previous(element){
        getClient(element).previous();
    }


    /**
     * skip to the next song
     * element -- the element that triggered the event (tells us which client to use)
     */
    function next(element){
        getClient(element).next();
    }


    /**
     * element -- the element that triggered the event (tells us which client to use)
     */
    function setVolume(element){
        getClient(element).setVolume($(element).val());
    }


    /**
     * element -- the element that triggered the event (tells us which client to use)
     */
    function seek(element){
        getClient(element).seek($(element).val());
    }


    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function loadPlaylist(element){
        var playlist = getDeferedInt(element, 'mpd_playlist_id')
        if(playlist !== ''){
            getClient(element).loadPlaylistIntoQueue(playlist);
        }
    }


    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function selectPlaylist(element){
        updateElements($('.MPD_playlist'));
    }

    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function addSearchCriteria(element){
         var table = $(element).parents('form').find('table');
         var options = getClient(element).getTagTypes();
         var options_code = '';
         options.forEach(function(option){
             options_code += '<option value="'+option+'">'+option+'</option>';
         });
         table.append('<tr>'
            +'<th><select class="search_tag" onchange="UI.updateSearchEditor(this)">'+options_code+'</select></th>'
            +'<td><input class="search_value" type="text" /></td>'
            +'<td><input type="button" value="X" onclick="UI.removeSearchCriteria(this)"/></td>'
        +'</tr>');
     }

     /**
      * update the search criteria value editor associated with the given tag type selector
      */
    function updateSearchEditor(element){
        var target = $(element).parents('tr').find('.search_value');
        var options = getClient(element).getTagOptions($(element).val());
        if(options === null){
            target.replaceWith('<input class="search_value" type="text" ></input>');
        }
        else{
            var options_code = '';
            options.forEach(function(option){
                options_code += '<option value="'+option+'">'+option+'</option>';
            });
            target.replaceWith('<select class="search_value">'+options_code+'</select>');
        }
    }

    /**
     * remove the row of the passed element
     */
    function removeSearchCriteria(element){
       $(element).parents('form tr').remove();
    }

    /**
     * perform a search with the criteria in the form
     */
    function doSearch(element){
       var params = {}
       //iterate over the rows of the form to get the search parameters
       $(element).parents('form').find('tr').each(function(goddamnitjqueryIalmostneverneedtheindexandalmostalwaysforgettoputagarbagevariablehere, row){
           var tag = $(row).find('.search_tag').val();
           var val = $(row).find('.search_value').val();
           params[tag] = val;
       });
       getClient(element).search(params, function(results){
           var options_code = '';
           results.forEach(function(option){
               options_code += '<option value="'+option.getPath()+'">'+option.getDisplayName()+'</option>';
           });
           $(element).parents('form').find('.MPD_search_results').html(options_code);
       });
    }


    /**
     *
     */
    function addSelectedSearchResultsToQueue(element){
        var result_element = $(element).parents('form').find('.MPD_search_results');
        var selected_results = result_element.val();
        var mpd_client = getClient(element);
        selected_results.forEach(function(song_file){
            mpd_client.addSongToQueueByFile(song_file);
        });
    }


    /**
     *
     */
    function addAllSearchResultsToQueue(element){
        var result_element = $(element).parents('form').find('.MPD_search_results');
        var results = [];
        var mpd_client = getClient(element);
        result_element.find('option').each(function(garbage,option){
            mpd_client.addSongToQueueByFile($(option).attr('value'));
        });
    }


    /**
     *
     */
    function replaceQueueWithSelectedSearchResults(element){
        var result_element = $(element).parents('form').find('.MPD_search_results');
        var selected_results = result_element.val();
        var mpd_client = getClient(element);
        mpd_client.clearQueue();
        selected_results.forEach(function(song_file){
            mpd_client.addSongToQueueByFile(song_file);
        });
        mpd_client.play();
    }


    /**
     *
     */
    function replaceQueueWithAllSearchResults(element){
        var result_element = $(element).parents('form').find('.MPD_search_results');
        var results = [];
        var mpd_client = getClient(element);
        mpd_client.clearQueue();
        result_element.find('option').each(function(garbage,option){
            mpd_client.addSongToQueueByFile($(option).attr('value'));
        });
        mpd_client.play();
    }


    /**
     * removes the currently playing song from the queue
     */
    function removeCurrentSong(element){
        var mpd_client = getClient(element);
        mpd_client.removeSongsFromQueueById(mpd_client.getCurrentSongID());
    }


    /**
     * emptys all songs from the play queue
     */
    function clearQueue(element){
        getClient(element).clearQueue();
    }


    /**
     * toggle showing children, if no chilrent populate from the client
     */
    function fileListClick(element){
        var parent = $(element).parents('.MPD_file_list').first();
        if(parent.length === 0){
            return;
        }
        var children = parent.find('.MPD_file_children').first();
        if(children.length > 0 && children.children().length == 0){
            //element hasn't been populated yet
            populateFileList(parent);
        }
        else{
            children.toggle();
        }
    }

    /**
     * given a filelist element get it's full path
     */
    function getFileListPath(element){
        return $(element).data('mpd_file_path').replace(/\/?(.*)/, '/$1').slice(1,-1);
    }

    /**
     * template inflation function
     */
    function makeFileListElement(content){
        if(typeof content.getMetadata().directory !== 'undefined'){
            var contents = $($('#template_MPD_file_list').html());
            contents.filter('.MPD_file_list').data('mpd_file_path', content.getPath().replace(/(.*[^\/])\/?/, '$1/'));
            contents.find('.MPD_file_path_name').html(content.getPath());
        }
        else{
            var contents = $($('#template_MPD_file').html());
            contents.filter('.MPD_file').data('mpd_file_path', content.getPath().replace(/(.*[^\/])\/?/, '$1/'));
            contents.find('.MPD_file_title').html(content.getDisplayName());
            contents.find('.MPD_file_album').html(content.getAlbum());
            contents.find('.MPD_file_artist').html(content.getArtist());
            contents.find('.MPD_file_file').html(content.getPath());
        }

        return contents;
    }


    /**
     * fill the given file list element with it's appropriate filey goodness
     */
    function populateFileList(element){
        var path = getFileListPath(element);
        getClient(element).getDirectoryContents(path, function(directory_contents){
            directory_contents.forEach(function(content){
                $(element).find('.MPD_file_children').first().append(makeFileListElement(content));
            });
        })
    }


    /**
     * add a song by it's filename
     */
    function addSong(element){
        getClient(element).addSongToQueueByFile(getFileListPath(element));
    }


    return {
        play:play,
        pause:pause,
        stop:stop,
        previous:previous,
        next:next,
        setVolume:setVolume,
        seek:seek,
        playSong:playSong,
        loadPlaylist:loadPlaylist,
        selectPlaylist:selectPlaylist,
        addSearchCriteria:addSearchCriteria,
        updateSearchEditor:updateSearchEditor,
        removeSearchCriteria:removeSearchCriteria,
        doSearch:doSearch,
        addSelectedSearchResultsToQueue:addSelectedSearchResultsToQueue,
        addAllSearchResultsToQueue:addAllSearchResultsToQueue,
        replaceQueueWithSelectedSearchResults:replaceQueueWithSelectedSearchResults,
        replaceQueueWithAllSearchResults:replaceQueueWithAllSearchResults,
        removeCurrentSong:removeCurrentSong,
        clearQueue:clearQueue,
        fileListClick:fileListClick,
        addSong:addSong
    };
})();
