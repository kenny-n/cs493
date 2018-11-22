const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const request = require('request');

const url = "https://kngo493-007.appspot.com/"
const projectId = 'kngo493-007';
const datastore = new Datastore({projectId:projectId});

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const SHIP = "Ship";

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

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ------------- Begin Ship Model Functions ------------- */
function get_ships(owner){
	const q = datastore.createQuery(SHIP);
	return datastore.runQuery(q).then( (entities) => {
    return entities[0].map(fromDatastore).filter( item => item.owner === owner );
  });
}

function get_ships_unsecure(){
	const q = datastore.createQuery(SHIP);
	return datastore.runQuery(q).then( (entities) => {
    return entities[0].map(fromDatastore);
  });
}

async function get_ship(ship_id){
	const key = datastore.key([SHIP, ship_id]);
  let ship = null;
  await datastore.get(key).then( results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }
  return ship;
}

function post_ship(name, type, length, owner){
  var id = uuid4();
  var key = datastore.key([SHIP, id]);
  const ship = {
    "id": id,
    "name": name,
    "type": type,
    "length": length,
    "owner": owner,
    "self": url + "ships/" + id
  };
	return datastore.save({"key":key, "data":ship}).then(() => {return key});
}

async function delete_ship(ship_id, username){
  if (username == null) {
    var e = new Error;
    e.name = "NoAuthError";
    throw e;
  }
  const key = datastore.key([SHIP, ship_id]);
  let ship = null;
  await datastore.get(key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }
  if (username != ship.owner) {
    var e = new Error;
    e.name = "IncorrectOwnerError";
    throw e;
  }

  console.log(ship_id + " deleted");
  return datastore.delete(key);
}
/* ------------- End Ship Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */
router.get('/ships', function(req, res) {
  console.log("Viewing all ships");
  const query = datastore.createQuery(SHIP);

  datastore.runQuery(query, function(err, entities) {
    if (err) {
      res.status(500).send({ error:"unknown get ship error"});
    }
    res.status(200).json(entities);
  });
});

router.get('/ships/:ship_id', function(req, res) {
  console.log("Viewing ship " + req.params.ship_id);
  return get_ship(req.params.ship_id)
  .then(ship => {
    console.log(ship);
    res.status(200).json(ship);
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get ship error"});
    }
  })
});

router.get('/users/:user_id/ships', checkJwt, function(req, res){
  if(req.params.user_id !== req.user.name){
    res.status(403).send('only owner can view their ships');
  }
  const ships = get_ships(req.params.user_id)
  .then( (ship) => {
    console.log(ship);
    res.status(200).json(ship);
  }).catch(function(error) {
    console.log(error);
    res.status(500).send({ error:"post ship error"});
  });
});

router.post('/ships', checkJwt, function(req, res){
  console.log(req.body);
  if (req.user.name) {
    if(req.get('content-type') !== 'application/json'){
      res.status(415).send('Server only accepts application/json data.')
    }
    post_ship(req.body.name, req.body.type, req.body.length, req.user.name)
    .then( key => {
      res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.name);
      res.status(201).send('{ "id": \"' + key.name + '\" }')
    }).catch(function(error) {
      console.log(error);
      res.status(500).send({ error:"post ship error"});
    });
  } else {
    res.status(401).send('please use valid credentials')
  }
});

router.delete('/ships/:ship_id', checkJwt, function(req, res){
  console.log("Deleting ship " + req.params.ship_id);
  return delete_ship(req.params.ship_id, req.user.name)
  .then(result => {
    res.status(204).send('deleted ship');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else if (error.name == 'NoAuthError') {
      res.status(401).send({ error:"please try again with valid credentials"});
    } else if (error.name == 'IncorrectOwnerError') {
      res.status(403).send({ error:"only owner can delete this ship"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown delete ship error"});
    }
  });
});

login.post('/login', function(req, res){
  const username = req.body.username;
  const password = req.body.password;
  var options = { method: 'POST',
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
/* ------------- End Ship Controller Functions ------------- */

app.use('/', router);
app.use('/', login);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
