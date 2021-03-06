var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                console.log('getFromApi, ending');
               emitter.emit('end', response.body);
            });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    console.log('Search for',req.params.name);

    // search?q=<name>&limit=1&type=artist
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        console.log('Search request end...');
        console.log('Requesting related ...');

        var artist = item.artists.items[0],
          artistID, relatedReq;

        if(!artist) {
          console.log('Artist not found!');
          res.sendStatus(404);
          return
        }

        artistID = artist['id'];
        relatedReq = getFromApi('artists/'+artistID+'/related-artists', {});

        // GET https://api.spotify.com/v1/artists/{id}/related-artists
        relatedReq.on('end', function(relatedItem) {
            console.log('Related request end');
            var numArtists = relatedItem.artists.length,
              progress = 0;

            function checkComplete() {
              if(progress === numArtists) {
                console.log('requests complete!');
                artist.related = relatedItem.artists;
                res.json(artist);
                return;
              }
            }

            //GET https://api.spotify.com/v1/artists/{id}/top-tracks?country=US
            function makeTopTrackRequest(artistObj) {
              var topTrackReq = getFromApi('artists/'+artistObj.id+'/top-tracks', {
                country: 'US'
              });

              topTrackReq.on('end', function(toptracksItem) {
                console.log('Top track request end');
                artistObj.tracks = toptracksItem.tracks;
                progress++;
                checkComplete();
              });

              topTrackReq.on('error', function() {
                 console.log('TOPTRACK REQ ERROR - 404');
                 res.sendStatus(404);
              });
            }

            relatedItem.artists.forEach(function (artist) {
                makeTopTrackRequest(artist);
            });

        });

        relatedReq.on('error', function() {
           console.log('RELATED ERROR - 404');
           res.sendStatus(404);
        });

    });

    searchReq.on('error', function() {
       console.log('SEARCH ERROR 404');
       res.sendStatus(404);
    });
});

app.listen(8080);