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

// Root route
app.get('/', (req, res) => {
  res.send('Food Review Server is running');
});

async function run() {
  try {
    await client.connect();
    const db = client.db('localfoodlovers');
    const reviewCollection = db.collection('reviews');
    const favoritesCollection = db.collection('favorites');

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

    // Search reviews by food name
    app.get('/reviews/search', async (req, res) => {
      try {
        const foodName = req.query.foodName;

        if (!foodName || !foodName.trim()) {
          const allReviews = await reviewCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
          return res.send(allReviews);
        }

        const safeRegex = foodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const reviews = await reviewCollection
          .find({ foodName: { $regex: safeRegex, $options: 'i' } })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reviews);
      } catch (err) {
        console.error('Error in /reviews/search:', err);
        res.status(500).send({ message: 'Search failed', error: err.message });
      }
    });

    // Get single review by ID
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

    // Update a review
    app.patch('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const body = req.body;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            foodName: body.foodName,
            foodImage: body.foodImage,
            restaurantName: body.restaurantName,
            location: body.location,
            rating: body.rating,
            reviewText: body.reviewText,
            reviewerName: body.reviewerName,
            userEmail: body.userEmail,
          },
        };
        const result = await reviewCollection.updateOne(query, update);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Failed to update review' });
      }
    });

    // Delete a review
    app.delete('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await reviewCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Failed to delete review' });
      }
    });

    // Add to favorites
    app.post('/favorites', async (req, res) => {
      try {
        const favorite = req.body;

        if (!favorite.userEmail || !favorite.reviewId) {
          return res.status(400).send({ message: 'Missing required fields' });
        }

        const existing = await favoritesCollection.findOne({
          userEmail: favorite.userEmail,
          reviewId: favorite.reviewId,
        });

        if (existing) {
          return res.status(409).send({ message: 'Already in favorites' });
        }

        const result = await favoritesCollection.insertOne(favorite);
        res.send(result);
      } catch (err) {
        console.error('Error adding favorite:', err);
        res.status(500).send({ message: 'Failed to add favorite' });
      }
    });

    // Get all favorites for a user (with review details)
    app.get('/favorites/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const favorites = await favoritesCollection
          .find({ userEmail: email })
          .toArray();

        const reviewIds = favorites.map(fav => new ObjectId(fav.reviewId));
        const reviews = await reviewCollection
          .find({ _id: { $in: reviewIds } })
          .toArray();

        const mergedFavorites = favorites.map(fav => ({
          ...fav,
          review: reviews.find(r => r._id.toString() === fav.reviewId),
        }));

        res.send(mergedFavorites);
      } catch (err) {
        console.error('Error fetching favorites:', err);
        res.status(500).send({ message: 'Failed to fetch favorites' });
      }
    });

    // Remove from favorites
    app.delete('/favorites/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await favoritesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        console.error('Error removing favorite:', err);
        res.status(500).send({ message: 'Failed to remove favorite' });
      }
    });

    // await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
