import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [books, setBooks] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [newBook, setNewBook] = useState({ title: '', author: '', year: '' });
  const [currentStrategy, setCurrentStrategy] = useState('cache-aside');
  const [loading, setLoading] = useState(false);
  const [bookId, setBookId] = useState('');

  // Available caching strategies
  const strategies = [
    { value: 'cache-aside', label: 'Cache-Aside' },
    { value: 'read-through', label: 'Read-Through' },
    { value: 'write-through', label: 'Write-Through' },
    { value: 'write-around', label: 'Write-Around' },
    { value: 'write-back', label: 'Write-Back (Write-Behind)' }
  ];

  // Fetch all books
  const fetchBooks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/books`);
      setBooks(response.data);
    } catch (error) {
      console.error('Error fetching books:', error);
      alert('Failed to fetch books');
    } finally {
      setLoading(false);
    }
  };

  // Initialize the database
  const initDatabase = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/init`);
      alert('Database initialized with sample data');
      fetchBooks();
      fetchMetrics();
    } catch (error) {
      console.error('Error initializing database:', error);
      alert('Failed to initialize database');
    } finally {
      setLoading(false);
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_URL}/metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  // Reset metrics
  const resetMetrics = async () => {
    try {
      await axios.post(`${API_URL}/metrics/reset`);
      fetchMetrics();
    } catch (error) {
      console.error('Error resetting metrics:', error);
    }
  };

  // Create a new book using the selected strategy
  const createBook = async (e) => {
    e.preventDefault();
    
    if (!newBook.title || !newBook.author || !newBook.year) {
      alert('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      await axios.post(`${API_URL}/books/${currentStrategy}`, {
        title: newBook.title,
        author: newBook.author,
        year: parseInt(newBook.year)
      });
      
      setNewBook({ title: '', author: '', year: '' });
      fetchBooks();
      fetchMetrics();
    } catch (error) {
      console.error('Error creating book:', error);
      alert('Failed to create book');
    } finally {
      setLoading(false);
    }
  };

  // Get a book by ID using the selected strategy
  const getBookById = async () => {
    if (!bookId) {
      alert('Please enter a book ID');
      return;
    }
    
    try {
      setLoading(true);
      await axios.get(`${API_URL}/books/${currentStrategy}/${bookId}`);
      fetchMetrics();
      alert(`Book retrieved using ${currentStrategy} strategy`);
    } catch (error) {
      console.error('Error fetching book:', error);
      alert('Failed to fetch book or book not found');
    } finally {
      setLoading(false);
    }
  };

  // Simulate multiple read operations
  const simulateReads = async () => {
    try {
      setLoading(true);
      
      // Get 5 random book IDs or use 1-5 if books array is empty
      const ids = books.length > 0 
        ? books.map(book => book.id).sort(() => 0.5 - Math.random()).slice(0, 5)
        : [1, 2, 3, 4, 5];
      
      for (let i = 0; i < 10; i++) {
        for (const id of ids) {
          try {
            await axios.get(`${API_URL}/books/${currentStrategy}/${id}`);
          } catch (error) {
            console.error(`Error fetching book ${id}:`, error);
          }
        }
      }
      
      fetchMetrics();
      alert(`Completed 50 read operations using ${currentStrategy} strategy`);
    } catch (error) {
      console.error('Error in read simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchBooks();
    fetchMetrics();
  }, []);

  return (
    <div className="app-container">
      <h1>Caching Strategies Lab</h1>
      
      <div className="controls">
        <button onClick={initDatabase} disabled={loading}>
          Initialize Database
        </button>
        <button onClick={resetMetrics} disabled={loading}>
          Reset Metrics
        </button>
      </div>
      
      <div className="strategy-selector">
        <h2>Select Caching Strategy</h2>
        <select 
          value={currentStrategy} 
          onChange={(e) => setCurrentStrategy(e.target.value)}
          disabled={loading}
        >
          {strategies.map(strategy => (
            <option key={strategy.value} value={strategy.value}>
              {strategy.label}
            </option>
          ))}
        </select>
        
        <div className="strategy-description">
          <h3>Current Strategy: {strategies.find(s => s.value === currentStrategy)?.label}</h3>
          {currentStrategy === 'cache-aside' && (
            <p>
              Cache-Aside loads data into the cache only when needed. When reading, 
              the application first checks the cache, and if the data isn't there, it reads from 
              the database and then puts it in the cache. When writing, data is written directly 
              to the database, not to the cache.
            </p>
          )}
          {currentStrategy === 'read-through' && (
            <p>
              Read-Through is similar to Cache-Aside, but the caching system (not the application) 
              is responsible for loading data from the database when it's not in the cache. 
              This simplifies application code since it only needs to interact with the cache.
            </p>
          )}
          {currentStrategy === 'write-through' && (
            <p>
              Write-Through ensures data is written to both the cache and the database synchronously. 
              This maintains consistency between the cache and database but may increase write latency.
            </p>
          )}
          {currentStrategy === 'write-around' && (
            <p>
              Write-Around bypasses the cache and writes directly to the database. This avoids 
              cache pollution for write-heavy workloads but means that recently written data 
              will cause a cache miss on read.
            </p>
          )}
          {currentStrategy === 'write-back' && (
            <p>
              Write-Back (Write-Behind) writes data to the cache first and then asynchronously 
              updates the database later. This improves write performance but risks data loss 
              if the cache fails before the data is persisted.
            </p>
          )}
        </div>
      </div>
      
      <div className="operations">
        <div className="read-operations">
          <h2>Read Operations</h2>
          <div className="operation-form">
            <input 
              type="text" 
              placeholder="Enter Book ID" 
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              disabled={loading}
            />
            <button onClick={getBookById} disabled={loading}>
              Get Book
            </button>
          </div>
          <button onClick={simulateReads} disabled={loading}>
            Simulate 50 Reads
          </button>
        </div>
        
        <div className="write-operations">
          <h2>Write Operations</h2>
          <form onSubmit={createBook}>
            <input 
              type="text" 
              placeholder="Title" 
              value={newBook.title}
              onChange={(e) => setNewBook({...newBook, title: e.target.value})}
              disabled={loading}
            />
            <input 
              type="text" 
              placeholder="Author" 
              value={newBook.author}
              onChange={(e) => setNewBook({...newBook, author: e.target.value})}
              disabled={loading}
            />
            <input 
              type="number" 
              placeholder="Year" 
              value={newBook.year}
              onChange={(e) => setNewBook({...newBook, year: e.target.value})}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              Add Book
            </button>
          </form>
        </div>
      </div>
      
      <div className="metrics-display">
        <h2>Cache Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-box">
            <h3>Cache Hit Rate</h3>
            <p className="metric-value">{metrics.hitRate || '0%'}</p>
          </div>
          <div className="metric-box">
            <h3>Cache Hits</h3>
            <p className="metric-value">{metrics.cacheHits || 0}</p>
          </div>
          <div className="metric-box">
            <h3>Cache Misses</h3>
            <p className="metric-value">{metrics.cacheMisses || 0}</p>
          </div>
          <div className="metric-box">
            <h3>DB Reads</h3>
            <p className="metric-value">{metrics.dbReads || 0}</p>
          </div>
          <div className="metric-box">
            <h3>DB Writes</h3>
            <p className="metric-value">{metrics.dbWrites || 0}</p>
          </div>
          <div className="metric-box">
            <h3>Cache Writes</h3>
            <p className="metric-value">{metrics.cacheWrites || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="books-list">
        <h2>Books in Database</h2>
        <button onClick={fetchBooks} disabled={loading}>
          Refresh List
        </button>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Author</th>
              <th>Year</th>
            </tr>
          </thead>
          <tbody>
            {books.map(book => (
              <tr key={book.id}>
                <td>{book.id}</td>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {books.length === 0 && <p>No books found. Initialize the database or add books.</p>}
      </div>
    </div>
  );
}

export default App;