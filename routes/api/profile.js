const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");
const uuid = require("uuid");

const PROFILES_TABLE = process.env.PROFILES_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
// const EXPERIENCES_TABLE = process.env.EXPERIENCES_TABLE;
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

// @route GET api/profile
// @desc Get All Profiles
// @access Public
router.get("/", async (req, res) => {
  const params = {
    TableName: USERS_TABLE,
    // This is used to filler the fields returned
    ProjectionExpression: "email, avatar"
  };

  try {
    dynamoDb.scan(params, function(err, data) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "Could not get users" });
      } else {
        res.json(data.Items);
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route GET api/profile/user/:userId
// @desc Get Profiles by userId
// @access Public
router.get("/user/:userId", async (req, res) => {
  const userId = req.params.userId;
  const params = {
    TableName: USERS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    },
    // This is used to filler the fields returned
    ProjectionExpression: "email, avatar"
  };

  try {
    dynamoDb.query(params, function(err, data) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "Profile Not Found" });
      } else {
        user = data.Items[0];
        if (!user) {
          res.status(400).json({ error: "Profile Not Found" });
        }
        res.json(data.Items);
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route DELETE api/profile/
// @desc Delete profile, user and posts
// @access Private

router.delete("/", auth, async (req, res) => {
  const userId = req.user.id;
  console.log(userId);

  const delUserParams = {
    TableName: USERS_TABLE,
    Key: {
      userId: userId
    }
  };

  const delProfileParams = {
    TableName: PROFILES_TABLE,
    Key: {
      userId: userId
    }
  };

  try {
    //@todo - remove users posts
    //remove profile
    dynamoDb.delete(delProfileParams, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log("profile deleted");
      }
    });
    //remove user
    dynamoDb.delete(delUserParams, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log("user deleted");
        res.json({ msg: "User deleted" });
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route PUT api/profile/experience
// @desc Add profile Experience
// @access Private
router.put(
  "/experience",
  [
    auth,
    [
      check("title", "Title is required")
        .not()
        .isEmpty(),
      check("company", "Company is required")
        .not()
        .isEmpty(),
      check("from", "From date is required")
        .not()
        .isEmpty()
    ]
  ],
  async (req, res) => {
    const userId = req.user.id;
    const expId = uuid.v4();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      company,
      location,
      from,
      to,
      current,
      description
    } = req.body;

    // Build Experience Object
    const experience = {};

    if (title) experience.title = title;
    if (company) experience.company = company;
    if (location) experience.location = location;
    if (from) experience.from = from;
    if (to) experience.to = to;
    if (current) experience.current = current;
    if (description) experience.description = description;

    const updateParams = {
      TableName: PROFILES_TABLE,
      Key: {
        userId: userId
      },
      UpdateExpression:
        "SET #experiences = list_append(if_not_exists(#experiences, :empty_list), :experience)",
      ExpressionAttributeNames: {
        "#experiences": "experiences"
      },
      ExpressionAttributeValues: {
        ":experience": [experience],
        ":empty_list": []
      }
    };

    const queryParams = {
      TableName: PROFILES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    };

    try {
      // This updates the experiences section in profile
      dynamoDb.update(updateParams, error => {
        console.log(title);
        if (error) {
          console.log("Testing");
          console.log(error);
          res.status(400).json({ error: "Could not update experiences" });
        }

        try {
          // If the update is successful then this prints out the current profile
          dynamoDb.query(queryParams, function(err, data) {
            if (err) {
              console.log(err);
              res
                .status(400)
                .json({ error: "There is no profile for this user" });
            } else {
              res.status(200).send(data.Items);
            }
          });
        } catch (err) {
          console.error(err.message);
          res.status(500).send("Server Error");
        }
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route POST api/profile/experience
// @desc Add profile Experience
// @access Private
// router.post(
//   "/experience",
//   [
//     auth,
//     [
//       check("title", "Title is required")
//         .not()
//         .isEmpty(),
//       check("company", "Company is required")
//         .not()
//         .isEmpty(),
//       check("from", "From date is required")
//         .not()
//         .isEmpty()
//     ]
//   ],
//   async (req, res) => {
//     const userId = req.user.id;
//     const expId = uuid.v4();
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const {
//       title,
//       company,
//       location,
//       from,
//       to,
//       current,
//       description
//     } = req.body;

//     const putParams = {
//       TableName: EXPERIENCES_TABLE,
//       Item: {
//         expId,
//         userId,
//         title,
//         company,
//         location,
//         from,
//         to,
//         current,
//         description
//       }
//     };

//     try {
//       dynamoDb.put(putParams, error => {
//         console.log(title);
//         if (error) {
//           console.log("Testing");
//           console.log(error);
//           res.status(400).json({ error: "Could not create profile" });
//         }

//         // res.status(200).send("new experience created");
//         res.json(putParams.Item);
//       });
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send("Server Error");
//     }
//   }
// );

module.exports = router;
