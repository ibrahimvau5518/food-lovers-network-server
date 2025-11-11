const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// MongoDB setup
const uri =
  'mongodb+srv://foodDbUser:4EyC0a3vijpltGtg@cluster0.4rgvatj.mongodb.net/?appName=Cluster0';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// root route
app.get('/', (req, res) => {
  res.send('Food Review Server is running');
});

async function run() {
  try {
    await client.connect();
    const db = client.db('localfoodlovers');
    const reviewCollection = db.collection('reviews');

   

    
    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully!');
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
