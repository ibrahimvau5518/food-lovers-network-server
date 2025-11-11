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

    // Get all reviews
    app.get('/reviews', async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ message: 'Failed to load reviews' });
      }
    });

    // Get featured reviews (top 6 by rating)
    app.get('/reviews/featured', async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ rating: -1, createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ message: 'Failed to load featured reviews' });
      }
    });

    // Get single review by id
    app.get('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const review = await reviewCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(review);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching review' });
      }
    });

    // Get reviews by user email
    app.get('/reviews/user/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const reviews = await reviewCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching user reviews' });
      }
    });

    // Search reviews by food name
    app.get('/reviews/search', async (req, res) => {
      try {
        const foodName = req.query.foodName;
        const reviews = await reviewCollection
          .find({ foodName: { $regex: foodName, $options: 'i' } })
          .toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ message: 'Search failed' });
      }
    });

    // Add new review
    app.post('/reviews', async (req, res) => {
      try {
        const review = req.body;
        review.createdAt = new Date();
        const result = await reviewCollection.insertOne(review);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Failed to add review' });
      }
    });

    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully!');
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
