const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const url = "https://kngo493-005.appspot.com/"
const projectId = 'kngo493-005';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";

const router = express.Router();

app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'pug');

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ------------- Begin Ship Model Functions ------------- */
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

function post_ship(name, type, length){
  var id = uuid4();
  var key = datastore.key([SHIP, id]);
  const ship = {
    "id": id,
    "name": name,
    "type": type,
    "length": length,
    "self": url + "ships/" + id
  };
	return datastore.save({"key":key, "data":ship}).then(() => {return key});
}

function update_ship(ship_id, name, type, length){
  const key = datastore.key([SHIP, ship_id]);
  const ship = {"id": ship_id, "name": name, "type": type, "length": length, "self": url + "ships/" + ship_id};
  datastore.upsert({"key":key, "data":ship});
  return ship.self;
}

async function delete_ship(ship_id){
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
      res.status(500).send({ error:"unknown get cargo error"});
    }
    if (req.accepts('json')) {
      res.set("Content", "application/json");
      res.status(200).json(entities);
    } else {
      res.status(406).send({ error:"invalid content request"})
    }
  });
});

router.get('/ships/:ship_id', function(req, res) {
  console.log("Viewing ship " + req.params.ship_id);
  if (req.accepts('html')) {
    return get_ship(req.params.ship_id)
    .then(ship => {
      console.log(ship);
      res.set("Content", "text/html");
      res.status(200).render('ship', {ship: ship});
    }).catch(function(error) {
      if (error.name == 'InvalidShipIdError') {
        res.status(404).send({ error:"no ship found with this id"});
      } else {
        console.log(error);
        res.status(500).send({ error:"unknown get ship error"});
      }
    })
  } else if (req.accepts('json')) {
    return get_ship(req.params.ship_id)
    .then(ship => {
      console.log(ship);
      res.set("Content", "application/json");
      res.status(200).json(ship);
    }).catch(function(error) {
      if (error.name == 'InvalidShipIdError') {
        res.status(404).send({ error:"no ship found with this id"});
      } else {
        console.log(error);
        res.status(500).send({ error:"unknown get ship error"});
      }
    })
  } else {
    res.status(406).send({ error:"invalid content request"})
  }
});

router.post('/ships', function(req, res){
  console.log(req.body);
  post_ship(req.body.name, req.body.type, req.body.length)
  .then( key => {res.status(201).send('{ "id": \"' + key.name + '\" }')} );
});

router.put('/ships/:ship_id', function(req, res){
  console.log("Modifying ship " + req.params.ship_id);
  var location = update_ship(req.params.ship_id, req.body.name, req.body.type, req.body.length)
  res.location(location);
  res.status(303).send('modified ship');
});

router.delete('/ships/:ship_id', function(req, res){
  console.log("Deleting ship " + req.params.ship_id);
  return delete_ship(req.params.ship_id)
  .then(result => {
    res.status(204).send('deleted ship');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown delete ship error"});
    }
  });
});

router.put('/ships', function(req, res){
  console.log("Modifying ship root");
  res.status(405).send('modifying ships root not allowed');
});

router.delete('/ships', function(req, res){
  console.log("Deleting ship root");
  res.status(405).send('deleting ships root not allowed');
});
/* ------------- End Ship Controller Functions ------------- */

app.use('/', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
