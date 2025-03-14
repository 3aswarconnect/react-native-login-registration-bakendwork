import dotenv from "dotenv";
import express from 'express'
import cors from "cors";

import  { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";


dotenv.config()
const app = express();
app.use(cors());
app.use(express.json());

const client = new DynamoDBClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const TABLE_NAME = 'youtube-demos';
console.log(process.env.AWS_ACCESS_KEY_ID);
// **Register User**
app.post("/register", async (req, res) => {

    const { email, password } = req.body;
    console.log(req.body);
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    // const putItemCommand = new PutItemCommand({
    //     TableName: TABLE_NAME,
    //     Item: {
    //         email: { S: email },
    //         password: { S: password }
    //     }
    // });

    // try {
    //     await client.send(putItemCommand);
    //     res.json({ message: "User registered successfully" });
    // } catch (error) {
    //     res.status(500).json({ message: error.message });
    // }




    const putItemCommand = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
          email: {
              "S": email
          },
          password: {
              "S": password
          }
      }
  });
  try {
        await client.send(putItemCommand);
        res.json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
 
  
});

// **Sign In User**
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const getItemCommand = new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { email: { S: email } }
    });

    try {
        const response = await client.send(getItemCommand);
        if (response.Item && response.Item.password.S === password) {
            res.json({ message: "Login successful" });
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// **Start Server**
app.listen(4000, () => console.log("Server running on port 4000"));
