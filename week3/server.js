const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectId = 'kngo493-003';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";
const SLIP = "Slip";

const router = express.Router();

app.use(bodyParser.json());

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

/* ------------- Begin Ship Model Functions ------------- */
function post_ship(name, type, length){
  var key = datastore.key(SHIP);
	const new_ship = {"name": name, "type": type, "length": length};
	return datastore.save({"key":key, "data":new_ship}).then(() => {return key});
}

function get_ships(){
	const q = datastore.createQuery(SHIP);
	return datastore.runQuery(q).then( (entities) => {return entities[0].map(fromDatastore)});
}

async function get_ship(ship_id){
	const key = datastore.key([SHIP, parseInt(ship_id,10)]);
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

function put_ship(ship_id, name, type, length){
  const key = datastore.key([SHIP, parseInt(ship_id,10)]);
  const ship = {"name": name, "type": type, "length": length};
  return datastore.save({"key":key, "data":ship});
}

async function delete_ship(ship_id){
  const key = datastore.key([SHIP, parseInt(ship_id,10)]);
  let ship = null;
  await datastore.get(key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }

  find_and_empty_slip(ship.name);

  console.log(ship_id + " deleted");
  return datastore.delete(key);
}

async function find_and_empty_slip(ship_name) {
  let slip_id = null;
  await get_slips().then( slips => {
    [].forEach.call(slips, function(slip) {
      if (slip.current_boat)
        if (slip.current_boat.name == ship_name)
          empty_slip(slip.id);
    })
  });
}
/* ------------- End Ship Model Functions ------------- */

/* ------------- Begin Slip Model Functions ------------- */
function post_slip(number){
  var key = datastore.key(SLIP);
	const new_slip = {"number": number, "current_boat": null, "arrival_date": null};
	return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

function get_slips(){
	const q = datastore.createQuery(SLIP);
	return datastore.runQuery(q).then( (entities) => {return entities[0].map(fromDatastore)});
}

async function get_slip(slip_id){
	const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  let slip = null;
  await datastore.get(key).then( results => {
    slip = results[0];
  });
  if (slip == null) {
    var e = new Error;
    e.name = "InvalidSlipIdError";
    throw e;
  }
  return slip;
}

async function get_slip_ship(slip_id){
	const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  let slip = null;
  await datastore.get(key).then( results => {
    slip = results[0];
  });
  if (slip == null) {
    var e = new Error;
    e.name = "InvalidSlipIdError";
    throw e;
  }
  if (slip.current_boat == null) {
    var e = new Error;
    e.name = "NoShipAtSlipError";
    throw e;
  }
  return slip.current_boat;
}

function put_slip(slip_id, number, current_boat, arrival_date){
  const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  const slip = {"number": number, "current_boat": current_boat, "arrival_date": arrival_date};
  console.log("updating slip: " + slip.number + " to cb: " + slip.current_boat);
  return datastore.upsert({key:key, data:slip});
}

function delete_slip(slip_id){
  const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  return datastore.delete(key);
}

async function empty_slip(slip_id){
  const key = datastore.key([SLIP, parseInt(slip_id,10)]);
  let slip = null;
  await datastore.get(key).then( results => {
    slip = results[0];
    console.log("slip number: " + slip.number);
  });
  put_slip(slip_id, slip.number, null, null);
}

async function put_ship_in_slip(slip_id, ship_id){
  const slip_key = datastore.key([SLIP, parseInt(slip_id,10)]);

  let slip = null;
  await datastore.get(slip_key).then( results => {
    slip = results[0];
  });
  if (slip == null) {
    var e = new Error;
    e.name = "InvalidSlipIdError";
    throw e;
  }

  if (slip.current_boat != null) {
    var e = new Error;
    e.name = "SlipInUseError";
    throw e;
  }
  const ship_key = datastore.key([SHIP, parseInt(ship_id,10)]);
  let ship = null;
  await datastore.get(ship_key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }
  const data = {"number":slip.number, "current_boat": ship, "arrival_date": getDate()};
  console.log(data);
  return datastore.upsert({key:slip_key, data:data});
}

async function unput_ship_in_slip(slip_id, ship_id){
  const slip_key = datastore.key([SLIP, parseInt(slip_id,10)]);

  let slip = null;
  await datastore.get(slip_key).then( results => {
    slip = results[0];
  });
  if (slip == null) {
    var e = new Error;
    e.name = "InvalidSlipIdError";
    throw e;
  }

  const ship_key = datastore.key([SHIP, parseInt(ship_id,10)]);
  let ship = null;
  await datastore.get(ship_key).then(results => {
    ship = results[0];
  });
  if (ship == null) {
    var e = new Error;
    e.name = "InvalidShipIdError";
    throw e;
  }

  if (slip.current_boat == null || slip.current_boat.name != ship.name) {
    var e = new Error;
    e.name = "ShipNotInSlipError";
    throw e;
  }

  return empty_slip(slip_id);
}

function getDate() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  if(dd < 10)
    dd = '0' + dd

  if (mm < 10)
    mm = '0' + mm

  return mm + '/' + dd + '/' + yyyy;
}
/* ------------- End Slip Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */
router.get('/ships', function(req, res){
  console.log("Viewing all ships");
  const ships = get_ships()
	.then( (ships) => {
    console.log(ships);
    res.status(200).json(ships);
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

router.post('/ships', function(req, res){
  console.log(req.body);
  post_ship(req.body.name, req.body.type, req.body.length)
  .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});

router.put('/ships/:ship_id', function(req, res){
  console.log("Modifying ship " + req.params.ship_id);
  put_ship(req.params.ship_id, req.body.name, req.body.type, req.body.length)
  .then(res.status(200).end());
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

/* ------------- Begin Slip Controller Functions ------------- */
router.get('/slips', function(req, res){
  console.log("Viewing all slips");
  const slips = get_slips()
	.then( (slips) => {
    res.status(200).json(slips);
  });
});

router.get('/slips/:slip_id', function(req, res){
  console.log("Viewing slip " + req.params.slip_id);
  return get_slip(req.params.slip_id)
  .then(slip => {
    res.status(200).json(slip);
  }).catch(function(error) {
    if (error.name == 'InvalidSlipIdError') {
      res.status(404).send({ error:"no slip found with this id"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get slip error"});
    }
  });
});

router.get('/slips/:slip_id/ships', function(req, res){
  console.log("Viewing ship at slip " + req.params.slip_id);
  return get_slip_ship(req.params.slip_id)
  .then(slip => {
    res.status(200).json(slip);
  }).catch(function(error) {
    if (error.name == 'InvalidSlipIdError') {
      res.status(404).send({ error:"no slip found with this id"});
    } else if (error.name == 'NoShipAtSlipError') {
      res.status(404).send({ error:"no ship at this slip"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown get slip ship error"});
    }
  });
});

router.post('/slips', function(req, res){
  console.log(req.body);
  post_slip(req.body.number)
  .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});

router.put('/slips/:slip_id', function(req, res){
  console.log("Modifying slip " + req.params.slip_id);
  put_slip(req.params.slip_id, req.body.number, req.body.current_boat, req.body.arrival_date)
  .then(res.status(200).end());
});

router.post('/slips/:slip_id/ships/:ship_id', function(req, res){
  console.log("Docking " + req.params.ship_id + " at " + req.params.slip_id);
  return put_ship_in_slip(req.params.slip_id, req.params.ship_id)
  .then(result => {
    res.status(200).send('ship docked in slip');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else if (error.name == 'InvalidSlipIdError') {
      res.status(404).send({ error:"no slip found with this id"});
    } else if (error.name == 'SlipInUseError') {
      res.status(403).send({ error:"slip is already in use by a ship"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown put ship in slip error"});
    }
  });
});

router.delete('/slips/:slip_id/ships/:ship_id', function(req, res){
  console.log("Undocking " + req.params.ship_id + " at " + req.params.slip_id);
  return unput_ship_in_slip(req.params.slip_id, req.params.ship_id)
  .then(result => {
    res.status(200).send('ship at sea');
  }).catch(function(error) {
    if (error.name == 'InvalidShipIdError') {
      res.status(404).send({ error:"no ship found with this id"});
    } else if (error.name == 'InvalidSlipIdError') {
      res.status(404).send({ error:"no slip found with this id"});
    } else if (error.name == 'ShipNotInSlipError') {
      res.status(403).send({ error:"ship is not at this slip"});
    } else {
      console.log(error);
      res.status(500).send({ error:"unknown remove ship from slip error"});
    }
  });
});

router.delete('/slips/:slip_id', function(req, res){
  console.log("Deleting slip " + req.params.slip_id);
  delete_slip(req.params.slip_id).then(res.status(200).end())
});
/* ------------- End Slip Controller Functions ------------- */

app.use('/', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
