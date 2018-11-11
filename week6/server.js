const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const request = require('request');
const config_data = require('./config.json');

const CID = config_data['CID'];
const SEC = config_data['SEC'];
const CALLBACK = config_data['CALLBACK'];

const url = "https://kngo493-006.appspot.com/";
const projectId = 'kngo493-006';
const datastore = new Datastore({projectId:projectId});

const router = express.Router();

app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'pug');

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function build_url() {
  var google_url = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=';

  google_url += CID;
  google_url += '&redirect_uri=';
  google_url += CALLBACK;
  google_url += '&scope=email&state=';
  google_url += uuid4();

  return google_url
}

function exchange(code, callback) {
  console.log("exchanging code for access token");
  var options = { 
    method: 'POST',
    url: 'https://www.googleapis.com/oauth2/v4/token',
    headers: {
      'cache-control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded'   
    },
    form: {
      code: code,
      client_id: CID,
      client_secret: SEC,
      redirect_uri: CALLBACK,
      grant_type: 'authorization_code' 
    }
  };
  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    
    callback(JSON.parse(body).access_token);
  });
}

function get_google_data(access_token, callback) {
  console.log("getting data from google+ api");
  var get_options = { 
    method: 'GET',
    url: 'https://www.googleapis.com/plus/v1/people/me',
    headers: { Authorization: 'Bearer ' + access_token } 
  };
  request(get_options, function (error, response, body) {
    if (error) throw new Error(error);
    callback(body);
  });
}

router.get('/auth', function(req, res) {
  console.log("rendering auth redirected page");

  var code = req.query.code;
  var state = req.query.state;

  exchange(code, function(access_token){
    get_google_data(access_token, function(data){
      data = JSON.parse(data);

      var display_name = data.displayName;
      var first_name = data.name.givenName;
      var last_name = data.name.familyName;
      var url = data.url;

      console.log("displaying user info");

      return res.status(200).render('redirect', { display_name: display_name, first_name: first_name, last_name: last_name, url: url, state: state });
    });
  });
});

router.get('/', function(req, res) {
  console.log("rendering login page");
  return res.status(200).render('login', {url: build_url()});
}); 

app.use('/', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
