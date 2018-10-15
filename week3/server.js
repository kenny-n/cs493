const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectId = 'YOUR-PROJECT-ID';
const datastore = new Datastore({projectId:projectId});

const LODGING = "Lodging";

const router = express.Router();

app.use(bodyParser.json());

function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

/* ------------- Begin Lodging Model Functions ------------- */
function post_lodging(name, description, price){
    var key = datastore.key(LODGING);
	const new_lodging = {"name": name, "description": description, "price": price};
	return datastore.save({"key":key, "data":new_lodging}).then(() => {return key});
}

function get_lodgings(){
	const q = datastore.createQuery(LODGING);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore);
		});
}

function put_lodging(id, name, description, price){
    const key = datastore.key([LODGING, parseInt(id,10)]);
    const lodging = {"name": name, "description": description, "price": price};
    return datastore.save({"key":key, "data":lodging});
}

function delete_lodging(id){
    const key = datastore.key([LODGING, parseInt(id,10)]);
    return datastore.delete(key);
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/', function(req, res){
    const lodgings = get_lodgings()
	.then( (lodgings) => {
        console.log(lodgings);
        res.status(200).json(lodgings);
    });
});

router.post('/', function(req, res){
    console.log(req.body);
    post_lodging(req.body.name, req.body.description, req.body.price)
    .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});

router.put('/:id', function(req, res){
    put_lodging(req.params.id, req.body.name, req.body.description, req.body.price)
    .then(res.status(200));
});

router.delete('/:id', function(req, res){
    delete_lodging(req.params.id).then(res.status(200).end())
});

/* ------------- End Controller Functions ------------- */

app.use('/lodgings', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});