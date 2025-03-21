import express from 'express';
import { createClient } from 'redis';
import pg from 'pg';
import cors from 'cors';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bookstore',
  password: 'toor',
  port: 5432,
});

// Redis connection
const redisClient = createClient({
  url: 'redis://localhost:6379'
});

// Connect to Redis
(async () => {
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  await redisClient.connect();
  console.log('Connected to Redis');
})();

// Cache keys will expire after 1 hour (3600 seconds)
const CACHE_TTL = 3600;

// Utilities for metrics
let metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  dbReads: 0,
  dbWrites: 0,
  cacheWrites: 0
};

// Reset metrics
app.post('/api/metrics/reset', (req, res) => {
  metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    dbReads: 0,
    dbWrites: 0,
    cacheWrites: 0
  };
  res.json({ message: 'Metrics reset' });
});

// Get metrics
app.get('/api/metrics', (req, res) => {
  const hitRate = metrics.cacheHits + metrics.cacheMisses > 0 
    ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2) 
    : 0;
  
  res.json({
    ...metrics,
    hitRate: `${hitRate}%`
  });
});

// 1. CACHE-ASIDE STRATEGY
app.get('/api/books/cache-aside/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `book:${id}:cache-aside`;
    
    // Try to get data from cache first
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Cache hit
      metrics.cacheHits++;
      return res.json(JSON.parse(cachedData));
    }
    
    // Cache miss - get from database
    metrics.cacheMisses++;
    metrics.dbReads++;
    
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = result.rows[0];
    
    // Store in cache for future requests
    metrics.cacheWrites++;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/books/cache-aside', async (req, res) => {
  try {
    const { title, author, year } = req.body;
    
    // Write directly to database
    metrics.dbWrites++;
    const result = await pool.query(
      'INSERT INTO books (title, author, year) VALUES ($1, $2, $3) RETURNING *',
      [title, author, year]
    );
    
    const book = result.rows[0];
    
    // We don't update cache here - it will be loaded on demand when requested
    // (This is the essence of Cache-Aside)
    
    res.status(201).json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. READ-THROUGH STRATEGY
// In this pattern, the cache is checked first, and if miss, the cache itself
// is responsible for loading the data from the database
app.get('/api/books/read-through/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `book:${id}:read-through`;
    
    // Try to get from cache
    let cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Cache hit
      metrics.cacheHits++;
      return res.json(JSON.parse(cachedData));
    }
    
    // Cache miss
    metrics.cacheMisses++;
    metrics.dbReads++;
    
    // In a real implementation, this would be handled by the cache library itself
    // Here we simulate it by having our code fetch from DB and update cache in one operation
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = result.rows[0];
    
    // Store in cache for future requests
    metrics.cacheWrites++;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. WRITE-THROUGH STRATEGY
app.post('/api/books/write-through', async (req, res) => {
  try {
    const { title, author, year } = req.body;
    
    // Insert into database
    metrics.dbWrites++;
    const result = await pool.query(
      'INSERT INTO books (title, author, year) VALUES ($1, $2, $3) RETURNING *',
      [title, author, year]
    );
    
    const book = result.rows[0];
    
    // ALSO immediately update cache
    metrics.cacheWrites++;
    const cacheKey = `book:${book.id}:write-through`;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.status(201).json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/books/write-through/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `book:${id}:write-through`;
    
    // Try to get from cache
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Cache hit
      metrics.cacheHits++;
      return res.json(JSON.parse(cachedData));
    }
    
    // Cache miss
    metrics.cacheMisses++;
    metrics.dbReads++;
    
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = result.rows[0];
    
    // Update cache
    metrics.cacheWrites++;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. WRITE-AROUND STRATEGY
app.post('/api/books/write-around', async (req, res) => {
  try {
    const { title, author, year } = req.body;
    
    // Insert ONLY into database, skip cache
    metrics.dbWrites++;
    const result = await pool.query(
      'INSERT INTO books (title, author, year) VALUES ($1, $2, $3) RETURNING *',
      [title, author, year]
    );
    
    const book = result.rows[0];
    
    // We deliberately do NOT update the cache
    // The cache will be populated only when a read request comes in
    
    res.status(201).json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/books/write-around/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `book:${id}:write-around`;
    
    // Try to get from cache
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Cache hit
      metrics.cacheHits++;
      return res.json(JSON.parse(cachedData));
    }
    
    // Cache miss
    metrics.cacheMisses++;
    metrics.dbReads++;
    
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = result.rows[0];
    
    // Update cache for next time
    metrics.cacheWrites++;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. WRITE-BACK (WRITE-BEHIND) STRATEGY
// We'll use an in-memory queue to simulate delayed writes
const writeBackQueue = [];

// Process queue periodically
setInterval(async () => {
  if (writeBackQueue.length > 0) {
    console.log(`Processing write-back queue: ${writeBackQueue.length} items`);
    
    // Process in batches for efficiency
    const batch = writeBackQueue.splice(0, 10);
    
    // In a real system, these would likely be batched into a single transaction
    for (const item of batch) {
      try {
        metrics.dbWrites++;
        await pool.query(
          'INSERT INTO books (id, title, author, year) VALUES ($1, $2, $3, $4) ' +
          'ON CONFLICT (id) DO UPDATE SET title = $2, author = $3, year = $4',
          [item.id, item.title, item.author, item.year]
        );
        console.log(`Write-back processed for book: ${item.id}`);
      } catch (err) {
        console.error('Error in write-back queue processing:', err);
        // In a real system, we might add retry logic or error handling here
      }
    }
  }
}, 5000); // Process every 5 seconds

app.post('/api/books/write-back', async (req, res) => {
  try {
    const book = {
      id: Date.now(), // Use timestamp as temporary ID
      title: req.body.title,
      author: req.body.author,
      year: req.body.year
    };
    
    // Write to cache first
    metrics.cacheWrites++;
    const cacheKey = `book:${book.id}:write-back`;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    // Add to queue for async database write
    writeBackQueue.push(book);
    console.log(`Added to write-back queue: ${book.id}`);
    
    res.status(201).json({ 
      ...book,
      message: 'Book added to cache and queued for database write'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/books/write-back/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `book:${id}:write-back`;
    
    // Check cache first
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Cache hit
      metrics.cacheHits++;
      return res.json(JSON.parse(cachedData));
    }
    
    // Cache miss - check database
    metrics.cacheMisses++;
    metrics.dbReads++;
    
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = result.rows[0];
    
    // Update cache
    metrics.cacheWrites++;
    await redisClient.set(cacheKey, JSON.stringify(book), { EX: CACHE_TTL });
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all books (uncached)
app.get('/api/books', async (req, res) => {
  try {
    metrics.dbReads++;
    const result = await pool.query('SELECT * FROM books ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize database table
app.post('/api/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL
      )
    `);
    
    // Add some sample data
    await pool.query(`
      INSERT INTO books (title, author, year)
      VALUES 
        ('The Great Gatsby', 'F. Scott Fitzgerald', 1925),
        ('To Kill a Mockingbird', 'Harper Lee', 1960),
        ('1984', 'George Orwell', 1949),
        ('Pride and Prejudice', 'Jane Austen', 1813)
      ON CONFLICT DO NOTHING
    `);
    
    res.json({ message: 'Database initialized with sample data' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));