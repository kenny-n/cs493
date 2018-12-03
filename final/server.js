const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const request = require('request');

const url = "https://kngo493-final.appspot.com/";
const projectId = 'kngo493-final';
const datastore = new Datastore({projectId:projectId});

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const ALBUM = "Album";
const SONG = "Song";

const router = express.Router();
const login = express.Router();

app.use(bodyParser.json());

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://kngo493.auth0.com/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  issuer: `https://kngo493.auth0.com/`,
  algorithms: ['RS256']
});

/* ------------- Begin Album Model Functions ------------- */
function get_albums(owner){
    const q = datastore.createQuery(ALBUM);
    return datastore.runQuery(q).then( (entities) => {
        return entities[0].map(fromDatastore).filter( item => item.owner === owner );
    });
}

async function get_album(album_id){
    const key = datastore.key([ALBUM, album_id]);
    let album = null;
    await datastore.get(key).then( results => {
        album = results[0];
    });
    if (album === null) {
        let e = new Error;
        e.name = "InvalidAlbumIdError";
        throw e;
    }
    return album;
}

function post_album(title, artist, year, genre){
    let id = title + '_' + artist;
    let key = datastore.key([ALBUM, id]);
    const album = {
        "id": title + '_' + artist,
        "title": title,
        "artist": artist,
        "year": year,
        "genre": genre,
        "songs": null,
        "self": url + "albums/" + id
    };
    return datastore.save({"key":key, "data":album}).then(() => {return key});
}

async function delete_album(album_id, username){
    if (username === null) {
        let e = new Error;
        e.name = "NoAuthError";
        throw e;
    }
    const key = datastore.key([ALBUM, album_id]);
    let album = null;
    await datastore.get(key).then(results => {
        album = results[0];
    });
    if (album === null) {
        let e = new Error;
        e.name = "InvalidAlbumIdError";
        throw e;
    }
    if (username !== album.owner) {
        let e = new Error;
        e.name = "IncorrectAlbumCreatorError";
        throw e;
    }

    console.log(album_id + " deleted");
    return datastore.delete(key);
}
/* ------------- End Album Model Functions ------------- */

/* ------------- Begin Song Model Functions ------------- */
function get_songs(owner){
    const q = datastore.createQuery(SONG);
    return datastore.runQuery(q).then( (entities) => {
        return entities[0].map(fromDatastore).filter( item => item.owner === owner );
    });
}

async function get_song(song_id){
    const key = datastore.key([SONG, song_id]);
    let song = null;
    await datastore.get(key).then( results => {
        song = results[0];
    });
    if (song === null) {
        let e = new Error;
        e.name = "InvalidSongIdError";
        throw e;
    }
    return song;
}

function post_song(title, artist, album, owner){
    let id = title + '_' + artist;
    let key = datastore.key([SONG, id]);
    const song = {
        "id": id,
        "title": title,
        "artist": artist,
        "album": album,
        "length": length,
        "self": url + "songs/" + id
    };
    return datastore.save({"key":key, "data":song}).then(() => {return key});
}

async function delete_song(song_id, username){
    if (username === null) {
        let e = new Error;
        e.name = "NoAuthError";
        throw e;
    }
    const key = datastore.key([SONG, song_id]);
    let song = null;
    await datastore.get(key).then(results => {
        song = results[0];
    });
    if (song === null) {
        let e = new Error;
        e.name = "InvalidSongIdError";
        throw e;
    }
    if (username !== song.owner) {
        let e = new Error;
        e.name = "IncorrectSongCreatorError";
        throw e;
    }

    song.log(song_id + " deleted");
    return datastore.delete(key);
}
/* ------------- End Song Model Functions ------------- */

/* ------------- Begin Album Controller Functions ------------- */
router.get('/albums', function(req, res) {
  console.log("Viewing all albums");
  const query = datastore.createQuery(ALBUM);

  datastore.runQuery(query, function(err, entities) {
    if (err) {
      res.status(500).send({ error:"unknown get album error"});
    }
    res.status(200).json(entities);
  });
});

router.get('/albums/:album_id', function(req, res) {
  console.log("Viewing album " + req.params.album_id);
  return get_album(req.params.album_id)
  .then(album => {
    console.log(album);
    res.status(200).json(album);
  }).catch(function(error) {
    if (error.name === 'InvalidAlbumIdError') {
      res.status(404).send({ error:"no album found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get album error"});
    }
  })
});

router.get('/users/:user_id/albums', checkJwt, function(req, res){
  if(req.params.user_id !== req.user.name){
    res.status(403).send('only owner can view their albums');
  }
  const albums = get_albums(req.params.user_id)
  .then( (album) => {
    console.log(album);
    res.status(200).json(album);
  }).catch(function(error) {
    console.log(error);
    res.status(500).send({ error:"post album error"});
  });
});

router.post('/albums', checkJwt, function(req, res){
  console.log(req.body);
  if (req.user.name) {
    if(req.get('content-type') !== 'application/json'){
      res.status(415).send('Server only accepts application/json data.')
    }
    post_album(req.body.name, req.body.type, req.body.length, req.user.name)
    .then( key => {
      res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.name);
      res.status(201).send('{ "id": \"' + key.name + '\" }')
    }).catch(function(error) {
      console.log(error);
      res.status(500).send({ error:"post album error"});
    });
  } else {
    res.status(401).send('please use valid credentials')
  }
});

router.delete('/albums/:album_id', checkJwt, function(req, res){
  console.log("Deleting album " + req.params.album_id);
  return delete_album(req.params.album_id, req.user.name)
  .then(result => {
    res.status(204).send('deleted album');
  }).catch(function(error) {
    if (error.name === 'InvalidAlbumIdError') {
      res.status(404).send({ error:"no album found with this id"});
    } else if (error.name === 'NoAuthError') {
      res.status(401).send({ error:"please try again with valid credentials"});
    } else if (error.name === 'IncorrectAlbumCreatorError') {
      res.status(403).send({ error:"only owner can delete this album"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown delete album error"});
    }
  });
});

/* ------------- End Album Controller Functions ------------- */

/* ------------- Begin Song Controller Functions ------------- */
router.get('/songs', function(req, res) {
    console.log("Viewing all songs");
    const query = datastore.createQuery(SONG);

    datastore.runQuery(query, function(err, entities) {
        if (err) {
            res.status(500).send({ error:"unknown get song error"});
        }
        res.status(200).json(entities);
    });
});

router.get('/songs/:song_id', function(req, res) {
    console.log("Viewing song " + req.params.song_id);
    return get_song(req.params.song_id)
        .then(song => {
            console.log(song);
            res.status(200).json(song);
        }).catch(function(error) {
            if (error.name === 'InvalidSongIdError') {
                res.status(404).send({ error:"no song found with this id"});
            } else {
                console.log(error);
                res.status(500).send({ error:"unknown get song error"});
            }
        })
});

router.get('/users/:user_id/songs', checkJwt, function(req, res){
    if(req.params.user_id !== req.user.name){
        res.status(403).send('only owner can view their songs');
    }
    return get_songs(req.params.user_id)
        .then( (song) => {
            console.log(song);
            res.status(200).json(song);
        }).catch(function(error) {
            console.log(error);
            res.status(500).send({ error:"post song error"});
        });
});

router.post('/songs', checkJwt, function(req, res){
    console.log(req.body);
    if (req.user.name) {
        if(req.get('content-type') !== 'application/json'){
            res.status(415).send('Server only accepts application/json data.')
        }
        post_song(req.body.name, req.body.type, req.body.length, req.user.name)
            .then( key => {
                res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.name);
                res.status(201).send('{ "id": \"' + key.name + '\" }')
            }).catch(function(error) {
            console.log(error);
            res.status(500).send({ error:"post song error"});
        });
    } else {
        res.status(401).send('please use valid credentials')
    }
});

router.delete('/songs/:song_id', checkJwt, function(req, res){
    console.log("Deleting song " + req.params.song_id);
    return delete_song(req.params.song_id, req.user.name)
        .then(result => {
            res.status(204).send('deleted song');
        }).catch(function(error) {
            if (error.name === 'InvalidSongIdError') {
                res.status(404).send({ error:"no song found with this id"});
            } else if (error.name === 'NoAuthError') {
                res.status(401).send({ error:"please try again with valid credentials"});
            } else if (error.name === 'IncorrectSongCreatorError') {
                res.status(403).send({ error:"only owner can delete this song"});
            } else {
                console.log(error);
                res.status(500).send({ error:"unknown delete song error"});
            }
        });
});

/* ------------- End Song Controller Functions ------------- */

login.post('/login', function(req, res){
    const username = req.body.username;
    const password = req.body.password;
    let options = { method: 'POST',
        url: 'https://kngo493.auth0.com/oauth/token',
        headers: { 'content-type': 'application/json' },
        body:
            { scope: 'openid',
                grant_type: 'password',
                username: username,
                password: password,
                client_id: 'rLSPmZA1t6tfweL0TbS5ax6KDzfu6oM3',
                client_secret: 'glFuRY6X7tz1IKnDmw9rfgCJ030dwWpqEgBji431DTsj3wWWhYg2qW0mYIHuyiRN' },
        json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
        } else {
            res.send(body);
        }
    });
});

app.use('/', router);
app.use('/', login);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
