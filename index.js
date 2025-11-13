const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// MongoDB setup
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ ERROR: MONGODB_URI is missing in .env file!');
  process.exit(1); // stop the server if no URI
}

console.log('🔄 Connecting to MongoDB...');
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get('/', (req, res) => {
  res.send('✅ Food Review Server is running');
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');

    const db = client.db('localfoodlovers');
    const reviewCollection = db.collection('reviews');
    const favoritesCollection = db.collection('favorites');

    // Simple check route
    app.get('/ping', (req, res) => {
      res.send('Pong from server!');
    });

    // Get all reviews
    app.get('/reviews', async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(reviews);
      } catch (err) {
        console.error('❌ Error fetching reviews:', err);
        res.status(500).send({ message: 'Failed to load reviews' });
      }
    });

    // Get featured reviews
    app.get('/reviews/featured', async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ rating: -1, createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(reviews);
      } catch (err) {
        console.error('❌ Error fetching featured reviews:', err);
        res.status(500).send({ message: 'Failed to load featured reviews' });
      }
    });

    // Search reviews
    app.get('/reviews/search', async (req, res) => {
      try {
        const foodName = req.query.foodName;
        console.log(`🔍 Search request received for: "${foodName}"`);

        if (!foodName || !foodName.trim()) {
          console.log('⚠️ Empty search term, returning all reviews');
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

        console.log(`✅ Found ${reviews.length} results for "${foodName}"`);
        res.send(reviews);
      } catch (err) {
        console.error('❌ Error in /reviews/search:', err);
        res.status(500).send({ message: 'Search failed', error: err.message });
      }
    });

    // Single review by ID
    app.get('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const review = await reviewCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(review);
      } catch (err) {
        console.error('❌ Error fetching review by ID:', err);
        res.status(500).send({ message: 'Error fetching review' });
      }
    });

    // User reviews
    app.get('/reviews/user/:email', async (req, res) => {
      try {
        const email = req.params.email;
        console.log(`📧 Fetching reviews for user: ${email}`);
        const reviews = await reviewCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(reviews);
      } catch (err) {
        console.error('❌ Error fetching user reviews:', err);
        res.status(500).send({ message: 'Error fetching user reviews' });
      }
    });

    // Add review
    app.post('/reviews', async (req, res) => {
      try {
        const review = req.body;
        review.createdAt = new Date();
        const result = await reviewCollection.insertOne(review);
        console.log('🆕 New review added:', result.insertedId);
        res.send(result);
      } catch (err) {
        console.error('❌ Error adding review:', err);
        res.status(500).send({ message: 'Failed to add review' });
      }
    });

    // Update review
    app.patch('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const body = req.body;
        const result = await reviewCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: body }
        );
        console.log(`✏️ Updated review: ${id}`);
        res.send(result);
      } catch (err) {
        console.error('❌ Error updating review:', err);
        res.status(500).send({ message: 'Failed to update review' });
      }
    });

    // Delete review
    app.delete('/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await reviewCollection.deleteOne({
          _id: new ObjectId(id),
        });
        console.log(`🗑️ Deleted review: ${id}`);
        res.send(result);
      } catch (err) {
        console.error('❌ Error deleting review:', err);
        res.status(500).send({ message: 'Failed to delete review' });
      }
    });

    // Favorites — add, get, remove
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
          console.warn('⚠️ Duplicate favorite detected');
          return res.status(409).send({ message: 'Already in favorites' });
        }

        const result = await favoritesCollection.insertOne(favorite);
        console.log('⭐ Added to favorites:', result.insertedId);
        res.send(result);
      } catch (err) {
        console.error('❌ Error adding favorite:', err);
        res.status(500).send({ message: 'Failed to add favorite' });
      }
    });

    app.get('/favorites/:email', async (req, res) => {
      try {
        const email = req.params.email;
        console.log(`📦 Fetching favorites for: ${email}`);
        const favorites = await favoritesCollection
          .find({ userEmail: email })
          .toArray();

        const reviewIds = favorites.map(fav => new ObjectId(fav.reviewId));
        const reviews = await reviewCollection
          .find({ _id: { $in: reviewIds } })
          .toArray();

        const merged = favorites.map(fav => ({
          ...fav,
          review: reviews.find(r => r._id.toString() === fav.reviewId),
        }));

        res.send(merged);
      } catch (err) {
        console.error('❌ Error fetching favorites:', err);
        res.status(500).send({ message: 'Failed to fetch favorites' });
      }
    });

    app.delete('/favorites/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await favoritesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        console.log(`🗑️ Removed from favorites: ${id}`);
        res.send(result);
      } catch (err) {
        console.error('❌ Error removing favorite:', err);
        res.status(500).send({ message: 'Failed to remove favorite' });
      }
    });

    // Graceful shutdown (for vercel/local)
    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing MongoDB connection...');
      await client.close();
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
  }
}

run().catch(err => console.error('❌ Error in run():', err));

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
