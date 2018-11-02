const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const results_per_page = 3;
const url = "https://kngo493-004.appspot.com/"
const projectId = 'kngo493-004';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";
const CARGO = "Cargo";

const router = express.Router();

app.use(bodyParser.json());

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
function post_ship(name, type, length){
  var id = uuid4();
  var key = datastore.key([SHIP, id]);
  const ship = {
    "id": id,
    "name": name,
    "type": type,
    "length": length,
    "cargo": [],
    "self": url + "ships/" + id
  };
	return datastore.save({"key":key, "data":ship}).then(() => {return key});
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

function update_ship(ship_id, name, type, length, cargo){
  const key = datastore.key([SHIP, ship_id]);
  const ship = {"id": ship_id, "name": name, "type": type, "length": length, "cargo": cargo, "self": url + "ships/" + ship_id};
  return datastore.upsert({"key":key, "data":ship});
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

  while (ship.cargo.length > 0) {
    cargo = get_cargo(ship.cargo[0].id);
    update_cargo(cargo.id, cargo.weight, null, cargo.content, cargo.delivery_date);
  }

  console.log(ship_id + " deleted");
  return datastore.delete(key);
}

async function get_ship_cargo(ship_id){
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
  return ship.cargo;
}
/* ------------- End Ship Model Functions ------------- */

/* ------------- Begin Cargo Model Functions ------------- */
function post_cargo(weight, content, delivery_date){
  var id = uuid4();
  var key = datastore.key([CARGO, id]);
	const cargo = {
    "id": id,
    "weight": weight,
    "carrier": null,
    "content": content,
    "delivery_date": delivery_date,
    "self": url + "cargos/" + id
  };
	return datastore.save({"key":key, "data":cargo}).then(() => {return key});
}

function get_cargos(){
	const q = datastore.createQuery(CARGO);
	return datastore.runQuery(q).then( (entities) => {return entities[0].map(fromDatastore)});
}

async function get_cargo(cargo_id){
	const key = datastore.key([CARGO, cargo_id]);
  let cargo = null;
  await datastore.get(key).then( results => {
    cargo = results[0];
  });
  if (cargo == null) {
    var e = new Error;
    e.name = "InvalidCargoIdError";
    throw e;
  }
  return cargo;
}

function update_cargo(cargo_id, weight, carrier, content, delivery_date){
  const key = datastore.key([CARGO, cargo_id]);
  const cargo = {"id": cargo_id, "weight": weight, "carrier": carrier, "content": content, "delivery_date": delivery_date, "self": url + "ships/" + cargo_id};
  console.log("updating cargo: " + cargo_id);
  return datastore.upsert({key:key, data:cargo});
}

async function delete_cargo(cargo_id){
  const key = datastore.key([CARGO, cargo_id]);

  ship_info = get_cargo(cargo_id).carrier;
  if (ship_info) {
    var ship = get_ship(ship_info.id);
    var cargo_list = ship.cargo;
    var updated_cargo = [];

    [].forEach.call(cargo_list, function(cargo_item) {
      if (cargo_id != cargo_item.id)
        updated_cargo.push(cargo);
    });
    update_ship(ship_id, ship.name, ship.type, ship.length, updated_cargo);
  }

  return datastore.delete(key);
}

async function put_cargo_on_ship(cargo_id, ship_id){
  const cargo_key = datastore.key([CARGO, cargo_id]);

  let cargo = null;
  await datastore.get(cargo_key).then( results => {
    cargo = results[0];
  });
  if (cargo == null) {
    var e = new Error;
    e.name = "InvalidCargoIdError";
    throw e;
  }
  if (cargo.carrier != null) {
    var e = new Error;
    e.name = "CargoLoadedError";
    throw e;
  }
  const ship_key = datastore.key([SHIP, ship_id]);
  let ship = null;
  await datastore.get(ship_key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }
  const cargo_info = {
    "id": cargo_id,
    "self": cargo.self
  };
  const carrier_info = {
    "id": ship_id,
    "name": ship.name,
    "self": ship.self
  };
  var loaded_cargo = ship.cargo.concat(cargo_info);

  update_ship(ship_id, ship.name, ship.type, ship.length, loaded_cargo);
  update_cargo(cargo_id, cargo.weight, carrier_info, cargo.content, cargo.delivery_date);
}

async function unput_cargo_on_ship(cargo_id, ship_id){
  const cargo_key = datastore.key([CARGO, cargo_id]);

  let cargo = null;
  await datastore.get(cargo_key).then( results => {
    cargo = results[0];
  });
  if (cargo == null) {
    var e = new Error;
    e.name = "InvalidCargoIdError";
    throw e;
  }
  const ship_key = datastore.key([SHIP, ship_id]);
  let ship = null;
  await datastore.get(ship_key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }
  if (cargo.carrier == null || cargo.carrier.name != ship.name) {
    var e = new Error;
    e.name = "CargoNotOnShipError";
    throw e;
  }
  var cargo_list = ship.cargo;
  var updated_cargo = [];

  [].forEach.call(cargo_list, function(cargo_item) {
    if (cargo_id != cargo_item.id)
      updated_cargo.push(cargo);
  });

  update_ship(ship_id, ship.name, ship.type, ship.length, updated_cargo);
  update_cargo(cargo_id, cargo.weight, null, cargo.content, cargo.delivery_date);
}
/* ------------- End Cargo Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */
router.get('/ships', function(req, res) {
  console.log("Viewing all ships");
  const query = datastore.createQuery(SHIP).limit(results_per_page);

  if (req.query.nextPageCursor) {
    query.start(req.query.nextPageCursor);
  }
  datastore.runQuery(query, function(err, entities, info) {
    if (err) {
      res.status(500).send({ error:"unknown get cargo error"});
    }
    const frontEndResponse = {
      ships: entities
    };
    if (info.moreResults !== datastore.NO_MORE_RESULTS) {
      frontEndResponse.nextPageCursor = info.endCursor;
    }
    res.status(200).json(frontEndResponse);
  });
});

router.get('/ships/:ship_id', function(req, res){
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
  });
});

router.get('/ships/:ship_id/cargos', function(req, res){
  console.log("Viewing cargo on ship " + req.params.ship_id);
  return get_ship_cargo(req.params.ship_id)
  .then(cargos => {
    res.status(200).json(cargos);
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get ship cargo error"});
    }
  });
});

router.post('/ships', function(req, res){
  console.log(req.body);
  post_ship(req.body.name, req.body.type, req.body.length)
  .then( key => {res.status(200).send('{ "id": \"' + key.name + '\" }')} );
});

router.put('/ships/:ship_id', function(req, res){
  console.log("Modifying ship " + req.params.ship_id);
  update_ship(req.params.ship_id, req.body.name, req.body.type, req.body.length, req.body.cargo)
  .then(res.status(200).send('modified ship'));
});

router.delete('/ships/:ship_id', function(req, res){
  console.log("Deleting ship " + req.params.ship_id);
  return delete_ship(req.params.ship_id)
  .then(result => {
    res.status(200).send('deleted ship');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown delete ship error"});
    }
  });
});
/* ------------- End Ship Controller Functions ------------- */

/* ------------- Begin Cargo Controller Functions ------------- */
// router.get('/cargos', function(req, res){
//   console.log("Viewing all cargos");
//   const cargos = get_cargos()
// 	.then( (cargos) => {
//     res.status(200).json(cargos);
//   });
// });
router.get('/cargos', function(req, res) {
  console.log("Viewing all cargos");
  const query = datastore.createQuery(CARGO)
    .limit(results_per_page);

  if (req.query.nextPageCursor) {
    query.start(req.query.nextPageCursor);
  }

  datastore.runQuery(query, function(err, entities, info) {
    if (err) {
      res.status(500).send({ error:"unknown get cargo error"});
    }

    const frontEndResponse = {
      cargos: entities
    };

    // Check if  more results may exist.
    if (info.moreResults !== datastore.NO_MORE_RESULTS) {
      frontEndResponse.nextPageCursor = info.endCursor;
    }

    res.status(200).json(frontEndResponse);
  });
});

router.get('/cargos/:cargo_id', function(req, res){
  console.log("Viewing cargo " + req.params.cargo_id);
  return get_cargo(req.params.cargo_id)
  .then(cargo => {
    res.status(200).json(cargo);
  }).catch(function(error) {
    if (error.name == 'InvalidCargoIdError') {
      res.status(404).send({ error:"no cargo found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get cargo error"});
    }
  });
});

router.post('/cargos', function(req, res){
  console.log(req.body);
  post_cargo(req.body.weight, req.body.content, req.body.delivery_date)
  .then( key => {res.status(200).send('{ "id": \"' + key.name + '\" }')} );
});

router.put('/cargos/:cargo_id', function(req, res){
  console.log("Modifying cargo " + req.params.cargo_id);
  update_cargo(req.params.cargo_id, req.body.weight, req.body.carrier, req.body.content, req.body.delivery_date)
  .then(res.status(200).send('modified cargo'));
});

router.post('/ships/:ship_id/cargos/:cargo_id', function(req, res){
  console.log("Loading " + req.params.cargo_id + " on " + req.params.ship_id);
  return put_cargo_on_ship(req.params.cargo_id, req.params.ship_id)
  .then(result => {
    res.status(200).send('loaded cargo');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else if (error.name == 'InvalidCargoIdError') {
      res.status(404).send({ error:"no cargo found with this id"});
    } else if (error.name == 'CargoLoadedError') {
      res.status(403).send({ error:"cargo is already loaded on a ship"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown put ship in cargo error"});
    }
  });
});

router.delete('/ships/:ship_id/cargos/:cargo_id', function(req, res){
  console.log("Unloading " + req.params.cargo_id + " from " + req.params.ship_id);
  return unput_cargo_on_ship(req.params.cargo_id, req.params.ship_id)
  .then(result => {
    res.status(200).send('unloaded cargo');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else if (error.name == 'InvalidCargoIdError') {
      res.status(404).send({ error:"no cargo found with this id"});
    } else if (error.name == 'CargoNotOnShipError') {
      res.status(403).send({ error:"cargo is not on this ship"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown remove cargo from ship error"});
    }
  });
});

router.delete('/cargos/:cargo_id', function(req, res){
  console.log("Deleting cargo " + req.params.cargo_id);
  return delete_cargo(req.params.cargo_id)
  .then(result => {
    res.status(200).send('deleted cargo');
  }).catch(function(error) {
    if (error.name == 'InvalidCargoIdError') {
      res.status(404).send({ error:"no cargo found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown delete cargo error"});
    }
  });
});
/* ------------- End Cargo Controller Functions ------------- */

app.use('/', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
