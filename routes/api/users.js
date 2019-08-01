const express = require("express");
const serverless = require("serverless-http");
const AWS = require("aws-sdk");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const uuid = require("uuid");
const date = new Date();

const USERS_TABLE = process.env.USERS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// @route POST api/users
// @desc Register user
// @access Public
router.post(
  "/",
  [
    check("name", "Name is required")
      .not()
      .isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const userId = uuid.v4();

    try {
      // See if user exists

      //Get users gravatar
      const avatar = gravatar.url(email, {
        s: "200",
        r: "pg",
        d: "mm"
      });

      // Encrypt password
      const salt = await bcrypt.genSalt(10);
      salted_password = await bcrypt.hash(password, salt);
      //await user.save() name, email, salted password, avater

      const params = {
        TableName: USERS_TABLE,
        Item: {
          userId,
          name,
          email,
          salted_password,
          avatar,
          date
        }
      };
      console.log("insterting data...");
      await dynamoDb.put(params, error => {
        if (error) {
          console.log(error);
          res.status(400).json({ error: "Could not create user" });
        }
        // res.json({ userId, name });
        // res.redirect("/prod");
        res.status(200).send("job done");
      });

      //Return jsonwebtoken
      //   res.send("User Registered");
    } catch (err) {
      console.log(err.message);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
