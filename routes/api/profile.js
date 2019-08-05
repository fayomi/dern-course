const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");

const PROFILES_TABLE = process.env.PROFILES_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// @route GET api/profile/me
// @desc Get current users profile
// @access Private
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const params = {
      TableName: PROFILES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    };
    dynamoDb.query(params, function(err, data) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "There is no profile for this user" });
      } else {
        res.status(200).send(data.Items);
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route POST api/profile
// @desc Create or Update user profile
// @access Private
router.post(
  "/",
  [
    auth,
    [
      check("status", "Status is required")
        .not()
        .isEmpty()
    ]
  ],
  async (req, res) => {
    const userId = req.user.id;
    console.log(userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      youtube,
      instagram,
      linkedin,
      status,
      company,
      location,
      skills,
      bio,
      githubusername
    } = req.body;
    console.log(company);

    // Build Profile Object
    const profileFields = {};
    profileFields.userId = userId;

    if (company) profileFields.company = company;
    if (location) profileFields.location = location;
    if (bio) profileFields.bio = bio;
    if (status) profileFields.status = status;
    if (githubusername) profileFields.githubusername = githubusername;
    if (skills) {
      profileFields.skills = skills.split(",").map(skill => skill.trim());
    }

    // Build Social Object
    profileFields.social = {};
    if (youtube) profileFields.social.youtube = youtube;
    if (instagram) profileFields.social.instagram = instagram;
    if (linkedin) profileFields.social.linkedin = linkedin;

    console.log(`fields: ${profileFields.social}`);

    const queryParams = {
      TableName: PROFILES_TABLE,
      Item: {
        youtube,
        instagram,
        linkedin,
        status,
        company,
        location,
        skills,
        bio,
        githubusername
      },
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      },
      ConditionExpression: "attribute_not_exists(userId)"
    };

    const putParams = {
      TableName: PROFILES_TABLE,
      Item: {
        userId,
        youtube,
        instagram,
        linkedin,
        status,
        company,
        location,
        skills,
        bio,
        githubusername
      }
    };

    const updateParams = {
      TableName: PROFILES_TABLE,
      Key: {
        userId: userId
      },
      UpdateExpression:
        "set #company = :company, #status = :status, #location = :location, #skills = :skills, #bio = :bio, #githubusername = :githubusername",
      ExpressionAttributeNames: {
        "#company": "company",
        "#status": "status",
        "#location": "location",
        "#skills": "skills",
        "#bio": "bio",
        "#githubusername": "githubusername"
      },
      ExpressionAttributeValues: {
        ":company": company,
        ":status": status,
        ":location": location,
        ":skills": skills,
        ":bio": bio,
        ":githubusername": githubusername
      }
    };

    try {
      console.log("running query to see if exists");
      dynamoDb.query(queryParams, function(err, data) {
        if (!err) {
          console.log("not errrrr");

          profile = data.Items[0];
          console.log(profile);
          if (profile) {
            //UPDATE IF EXISTS
            console.log("updating db");
            console.log(userId);
            dynamoDb.update(updateParams, function(err, data) {
              if (err) {
                console.log(err);
                res.status(400).json({ error: "Could not update users" });
              }
              res.status(200).send(profile);
            });
          } else {
            // CREATE IF PROFILE NOT FOUND
            console.log("creating db");
            dynamoDb.put(putParams, error => {
              console.log(company);
              if (error) {
                console.log("Testing");
                console.log(error);
                res.status(400).json({ error: "Could not create profile" });
              }

              res.status(200).send("new profile created");
            });
          }

          //   res.status(200).send(profile);
        } else {
          console.log(err);
          res.status(400).json({ error: "Could not get users" });
        }
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

module.exports = router;
