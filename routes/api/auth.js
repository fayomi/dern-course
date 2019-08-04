const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const auth = require("../../middleware/auth");
const config = require("config");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const USERS_TABLE = process.env.USERS_TABLE;
const USERS_INDEX = process.env.USERS_INDEX;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// @route GET api/auth
// @desc Test route
// @access Public
router.get("/", auth, async (req, res) => {
  const params = {
    TableName: USERS_TABLE,
    KeyConditionExpression: "#userId = :userId",
    ExpressionAttributeNames: {
      "#userId": "userId"
    },
    ExpressionAttributeValues: {
      ":userId": req.user.id
    }
  };

  try {
    dynamoDb.query(params, function(err, data) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "Could not get users" });
      } else {
        res.status(200).send(data.Items[0]);
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("server Error");
  }
});

// @route POST api/auth
// @desc Authenticate user and get token
// @access Public
router.post(
  "/",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const params = {
      TableName: USERS_TABLE,
      IndexName: USERS_INDEX,
      KeyConditionExpression: "#email = :email",
      ExpressionAttributeNames: {
        "#email": "email"
      },
      ExpressionAttributeValues: {
        ":email": email
      }
    };

    try {
      // See if user exists
      dynamoDb.query(params, async function(err, data) {
        if (err) {
          console.log(err);
          res.status(400).json({ error: "Could not get users" });
        } else {
          if (!data) {
            return res
              .status(400)
              .json({ errors: [{ msg: "Invalid Credentials" }] });
          }
          user = data.Items[0];
          //   res.status(200).send(user);

          console.log(`found user: ${user.salted_password}`);

          const isMatch = await bcrypt.compare(password, user.salted_password);
          console.log("about to match");

          if (!isMatch) {
            return res
              .status(400)
              .json({ errors: [{ msg: "Invalid Credentials" }] });
          }
          console.log("User Matched");

          const payload = {
            user: {
              id: user.userId
            }
          };

          jwt.sign(
            payload,
            config.get("jwtSecret"),
            { expiresIn: 360000 },
            (err, token) => {
              if (err) throw err;
              res.json({ token });
            }
          );
        }
      });
    } catch (err) {
      console.log(err.message);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
