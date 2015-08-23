var UI = (function(){

    /**
     * mapping between html classnames and MPD client methods to call to update them
     */


    var UI = {
        client: null
    };

    /********\
    |* INIT *|
    \********/
    $(function(){
        UI.client = MPD(8800);

        UI.client.on('StateChanged',updateState);

        UI.client.on('QueueChanged',updateQueue);

        UI.client.on('PlaylistsChanged',updatePlaylists);

        UI.client.on('DataLoaded',function(){
            //setup file UI
            var element = $('.MPD_file_list_placeholder');
            element.replaceWith(makeFileListElement(MPD.Directory(UI.client, {directory:'/', last_modified:new Date()})));
        });

        setInterval(function(){
            updatePlaytime(UI.client);
        },150);
    });


    /*******************\
    |* private methods *|
    \*******************/

    /**
     * update our UI on a state change
     */
    function updateState(state, client){
        $('.MPD_connected').html(client.isConnected()?'Yes':'No');
        $('.MPD_volume').html(client.getVolume());
        $('.MPD_playstate').html(client.getPlaystate());

        var current_song = client.getCurrentSong();
        if(current_song){
            $('.MPD_cur_song_title').html(current_song.getDisplayName());
            $('.MPD_cur_song_duration').html(current_song.getDuration());
            $('.MPD_cur_song_id').val(current_song.getId());
            //there is a mix of div/span/td type html and input/select typeelements
            $('.MPD_cur_song_elapsed_time').not(':input').html(Math.round(client.getCurrentSongTime()));
            $('.MPD_cur_song_elapsed_time').filter(':input').val(client.getCurrentSongTime());
            $('input[type=range].MPD_cur_song_elapsed_time').prop('max',current_song.getDuration());
        }
    }

    /**
     * update our UI on a Queue change
     */
    function updateQueue(queue){
        var option_code = '';
        queue.getSongs().forEach(function(song){
            option_code += '<option value="'+song.getId()+'">'+song.getDisplayName()+'</option>';
        });
        $('select.MPD_cur_song_id').html(option_code);
    }

    /**
     * update our UI on a playlist change
     */
    function updatePlaylists(playlists, client){
        var option_code = '';
        playlists.forEach(function(playlist){
            option_code += '<option value="'+playlist.playlist+'">'+playlist.playlist+'</option>';
        });
        $('select.MPD_playlist_selector').html(option_code);
        selectPlaylist($('select.MPD_playlist_selector'));
    }

    /**
     * update our UI for ticking of play time
     */
    function updatePlaytime(client){
        var current_song = client.getCurrentSong();
        if(current_song){
            //there is a mix of div/span/td type html and input/select typeelements
            $('.MPD_cur_song_elapsed_time').not(':input').html(Math.round(client.getCurrentSongTime()));
            $('.MPD_cur_song_elapsed_time').filter(':input').val(client.getCurrentSongTime());
        }
    }

    /**
     * look for the 'nearest' element matching the passed selector
     */
    function searchUp(element, selector){
        var elements = $($(element).parents().addBack().get().reverse());
        element = null;
        elements.each(function(i, test_element){
            var maybe = $(test_element).find(selector);
            if(maybe.length > 0){
                element = maybe;
                return false;
            }
        });
        return element;
    }

    /******************\
    |* public methods *|
    \******************/

    /**
     * start playing
     * element -- the element that triggered the event (tells us which client to use)
     */
    function play(element){
        UI.client.play();
    }

    /**
     * start playing the song that has the id identified by the value of the input element
     * element -- the element that triggered the event (tells us which client to use)
     */
    function playSong(element){
        UI.client.playById($(element).val());
    }


    /**
     * pause playback
     * element -- the element that triggered the event (tells us which client to use)
     */
    function pause(element){
        UI.client.pause();
    }


    /**
     * stop playing
     * element -- the element that triggered the event (tells us which client to use)
     */
    function stop(element){
        UI.client.stop();
    }


    /**
     * revert to the previous song
     * element -- the element that triggered the event (tells us which client to use)
     */
    function previous(element){
        UI.client.previous();
    }


    /**
     * skip to the next song
     * element -- the element that triggered the event (tells us which client to use)
     */
    function next(element){
        UI.client.next();
    }


    /**
     * element -- the element that triggered the event (tells us which client to use)
     */
    function setVolume(element){
        UI.client.setVolume($(element).val());
    }


    /**
     * element -- the element that triggered the event (tells us which client to use)
     */
    function seek(element){
        UI.client.seek($(element).val());
    }


    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function loadPlaylist(element){
        element = $(element);
        element = searchUp(element,'.MPD_playlist_selector');
        if(element && element.val() !== ''){
            UI.client.loadPlaylistIntoQueue(element.val());
        }
    }


    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function selectPlaylist(element){
        element = $(element);
        if(element && element.val() !== ''){
            var playlist_id = element.val();
            UI.client.getPlaylist(
                playlist_id,
                function(playlist){
                    if(playlist){
                        var option_code = '';
                        playlist.getSongs().forEach(function(song,i){
                            option_code += '<option value="'+i+'">'+song.getDisplayName()+'</option>';
                        });
                        searchUp(element,'.MPD_playlist').html(option_code);
                    }
                }
            );
            searchUp(element,'.MPD_playlist').html('');
        }
    }

    /**
     * element -- the element that triggered the event (tells us which playlist to use)
     */
    function addSearchCriteria(element){
         var table = $(element).parents('form').find('table');
         var options = UI.client.getTagTypes();
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
        var tag = $(element).val();
        if(['any','title', 'track', 'date', 'file'].indexOf(tag) === -1){
            //if the tag is one that there might be a limited number of results to fetch the valid results from MPD
            UI.client.tagSearch(
                $(element).val(),
                {},
                function(options){
                    var options_code = '';
                    options.forEach(function(option){
                        options_code += '<option value="'+option+'">'+option+'</option>';
                    });
                    target.replaceWith('<select class="search_value">'+options_code+'</select>');
                }
            );
        }
        else{
            //otherwise just use a freeform text box
            target.replaceWith('<input class="search_value" type="text" ></input>');
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
       UI.client.search(params, function(results){
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
        var mpd_client = UI.client;
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
        var mpd_client = UI.client;
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
        var mpd_client = UI.client;
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
        var mpd_client = UI.client;
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
        var mpd_client = UI.client;
        mpd_client.removeSongsFromQueueById(mpd_client.getCurrentSongID());
    }


    /**
     * emptys all songs from the play queue
     */
    function clearQueue(element){
        UI.client.clearQueue();
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
        UI.client.getDirectoryContents(path, function(directory_contents){
            directory_contents.forEach(function(content){
                $(element).find('.MPD_file_children').first().append(makeFileListElement(content));
            });
        })
    }


    /**
     * add a song by it's filename
     */
    function addSong(element){
        UI.client.addSongToQueueByFile(getFileListPath(element));
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
