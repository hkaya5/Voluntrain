var config = require('./config.ts');
var bcrypt = require('bcrypt');
var MongoClient = require('mongodb').MongoClient;
const queries = require('./queries.ts');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();

const uri = config.dbUri;
const portNum = config.portNum;
var saltRounds = 10;
var db;

app.use(express.static("dist/Voluntrain"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

app.use(session({
    secret: 'VoluntrainCookie',
    saveUninitialized: false,
    resave: false
}))

// Initialize connection once
MongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
  if (err) throw err;
  db = client.db("Voluntrain");
  // Start the application after the database is ready
  app.listen(portNum);
  console.log("Voluntrain server stated on localhost:"+portNum);
});

app.post('/api/createAccount/', function (req, res) {
  var email = req.body.email;
  // First check if user email is not in db
  queries.checkUserExists(email, (userExists) => {
    // if user does not exist, create the account
    if (!userExists) {
      var newUserInfo = { 
        name: req.body.name, 
        email: req.body.email, 
        zipcode: req.body.zipcode, 
        password: req.body.password,
      }
      queries.createNewUser(newUserInfo, () => {
        console.log("Successfully added user to database.");
        res.json({
          success: true,
          message: "Successfully created account."
        });
      })
    }
    // Otherwise if user already exists, don't create account
    else {
      console.log("Unable to create account. User email already found in database.");
      res.json({
        success: false,
        message: "Unable to create account. User email already found in database."
      });
    }
  })
})

app.post('/api/createOrg', (req, res) => {
    var orgInfo = {
      name: req.body.name, 
      location: req.body.location, 
      zipcode: req.body.zipcode, 
      bio: req.body.bio,
      admin: req.session.email
    }
    var orgName = req.body.name;
    queries.checkOrgExists(orgName, (orgExists) => {
      // If organization does not exist, then create the org
      if (!orgExists) {
        // Insert the organization info into db
        queries.createNewOrg(orgInfo, () => {
          console.log("Successfully added organization to database.");
          res.json({
            success: true,
            message: "Successfully created organization."
          });
        })
      }
      // Otherwise if org already exists, return error message
      else {
        console.log("Organization already found in database.");
        res.json({
          success: false,
          message: "Unable to create organization. Organization name already exists."
        });
      }
    })
})

app.post('/api/login', (req, res) => {
  var email = req.body.email;
  var typedPassword = req.body.password;
  // First check if user email exists
  queries.checkUserExists(email, function(userExists) {
    if (userExists) {
      queries.getUserPassword(email, function(actualPassword) {
          // check if password correct
          queries.checkPasswordsMatch(typedPassword, actualPassword, function(match) {
            if (match) {
                console.log("Successfully logged in " +email);
                req.session.email = email;
                req.session.save();
                res.json({
                  success: true,
                  message: "Successfully logged user in."
                })
            }
            else {
                console.log("Unable to login: incorrect password.");
                res.json({
                  success: false,
                  message: "Unable to login: incorrect password."
                })
            }
          })
      })
    }
    // Otherwise if user does not exist 
    else {
      console.log("Unable to login: user email not found in database.");
      res.json({
          success: false,
          message: "Unable to login: user email not found in database."
      })
    }
  });
})

app.get('/api/userdata', (req, res) => {
  var email = req.session.email;
  queries.checkUserExists(email, function(userExists) {
    // First check if users exists
    if (userExists) {
        // then get the user's information
        queries.getUserInfo(email, function(result) {
            res.json({
              isLoggedIn: true,
              name: result.name,
              email: result.email,
              zipcode: result.zipcode
            })
        })
    }
    // Otherwise if no user exists, returns json message that no user is logged in
    else {
      res.json({
        isLoggedIn: false
      })
    }
  });
})

app.post('/api/logout', (req, res) => { 
    console.log("Successfully logged out user.");
    // End the user session
    req.session.destroy();
    res.json({success: true});
})
