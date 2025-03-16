import dotenv from "dotenv";
import express from 'express'
import cors from "cors";
import multer from 'multer';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import  { DynamoDBClient, PutItemCommand, GetItemCommand,ScanCommand,QueryCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";
import path from "path";
import { v4 as uuidv4 } from "uuid";
dotenv.config()
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

//s3
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const client = new DynamoDBClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});


app.post("/register", async (req, res) => {
    const TABLE_NAME = 'youtube-demos';
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, Email, and Password are required" });
    }

    // Check if user already exists
    const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'email-index', // Ensure a GSI exists for email lookup
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: { ":email": { S: email } }
    });

    try {
        const existingUser = await client.send(queryCommand);
        if (existingUser.Items.length > 0) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        // Check if username already exists
        const usernameQuery = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'username-index', // Ensure a GSI exists for username lookup
            KeyConditionExpression: "username = :username",
            ExpressionAttributeValues: { ":username": { S: username } }
        });

        const existingUsername = await client.send(usernameQuery);
        if (existingUsername.Items.length > 0) {
            return res.status(400).json({ message: "Username is already taken" });
        }

        // Proceed with registration
        const userId = uuidv4();
        const putItemCommand = new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                userId: { S: userId },
                username: { S: username },
                email: { S: email },
                password: { S: password }
            }
        });

        await client.send(putItemCommand);
        res.json({ message: "User registered successfully", userId });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

  


 

// **Sign In User**
app.post("/signin", async (req, res) => {
    const TABLE_NAME = 'youtube-demos';
    const { identifier, password } = req.body; // identifier can be email or username
    console.log(req.body);

    if (!identifier || !password) {
        return res.status(400).json({ message: "Username/Email and Password are required" });
    }

    const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "email = :identifier OR username = :identifier",
        ExpressionAttributeValues: {
            ":identifier": { S: identifier }
        }
    });

    try {
        const response = await client.send(scanCommand);
        
        if (!response.Items || response.Items.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = response.Items[0];
        
        if (user.password?.S === password) {
            res.json({ message: "Login successful", userId: user.userId?.S });
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



//upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload API


app.post('/upload', upload.single('file'), async (req, res) => {
    console.log(req.file, req.body);
    const { category, description, isPublic, userId } = req.body;

    if (!userId) return res.status(400).json({ message: 'User ID is required' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const fileId = uuidv4(); // Generate unique file ID
        const fileType = req.file.mimetype.startsWith('image') ? 'image' : 'video'; // Determine file type
        const fileName = `${fileId}-${req.file.originalname}`;
        const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        // Upload to S3
        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }));

        // Store in DynamoDB
        await client.send(new PutItemCommand({
            TableName: 'storage',
            Item: {
                fileId: { S: fileId },  // Unique File ID (Primary Key)
                userId: { S: userId },
                category: { S: category },
                description: { S: description },
                isPublic: { BOOL: isPublic === 'true' },
                fileName: { S: req.file.originalname },
                fileUrl: { S: fileUrl },
                fileType: { S: fileType }  // Added attribute for file type
            },
        }));

        res.json({ message: 'Upload successful', fileId, fileUrl, fileType });
    } catch (error) {
        res.status(500).json({ message: 'Upload failed: ' + error.message });
    }
});



// **Start Server**
app.listen(4000, () => console.log("Server running on port 4000"));
