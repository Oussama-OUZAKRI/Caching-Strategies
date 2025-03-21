# Caching Strategies Lab

A hands-on lab to explore different caching strategies with React, Node.js, PostgreSQL, and Redis.

## Features

- Implementations of 5 caching patterns:
  - Cache-Aside (Lazy Loading)
  - Read-Through 
  - Write-Through
  - Write-Around
  - Write-Back (Write-Behind)
- Real-time metrics dashboard showing:
  - Cache hit/miss rates
  - Database reads/writes
  - Cache write operations
- Interactive UI for:
  - Database initialization
  - Creating books with different strategies
  - Reading individual books
  - Simulating read-heavy workloads
- Strategy comparison with performance insights

## Prerequisites

- Node.js (v14+)
- npm
- PostgreSQL
- Redis
- React (v17+)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/caching-strategies-lab.git
cd caching-strategies-lab
```

2. Install server dependencies:

```bash
cd server
npm install
```

3. Install client dependencies:

```bash
cd ../client
npm install
```

## Configuration

### Database Setup

1. Create PostgreSQL database:

```bash
createdb bookstore
```

2. Configure PostgreSQL credentials in server.js:

```javascript
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bookstore',
  password: 'yourpassword',  // Update with your PostgreSQL password
  port: 5432,
});
```

3. Start Redis server:

```bash
redis-server
```

## Usage

1. Start the backend server:

```bash
cd server
node server.js
```

2. Start the React frontend:

```bash
cd ../client
npm start
```

3. Access the application at: ```http://localhost:3000```

## Application Workflow  

### Initialize Database  

Click "Initialize Database" to create table and sample data.  

### Select Caching Strategy  

Choose from dropdown menu.  

#### View strategy description.  

### Perform Operations  

#### Write Operations:  

- Add books using different strategies.  

#### Read Operations:  

- Fetch individual books by ID.  
- Simulate read-heavy workloads (50 reads).  

### Monitor Metrics  

- Real-time cache performance metrics.  
- Compare strategy effectiveness.  

## API Endpoints  

| **Endpoint**                             | **Method** | **Description**                              |  
|------------------------------------------|------------|----------------------------------------------|  
| ```/api/books/[strategy]```              | POST       | Create book with specific strategy           |  
| ```/api/books/[strategy]/:id```          | GET        | Get book using strategy                      |  
| ```/api/metrics```                       | GET        | Get performance metrics                      |  
| ```/api/init```                          | POST       | Initialize database                          |  

## Caching Strategies Implemented  

| **Strategy**       | **Description**                             | **Use Case**                       |  
|--------------------|---------------------------------------------|------------------------------------|  
| **Cache-Aside**    | Load on demand, write to DB directly        | General purpose                    |  
| **Read-Through**   | Cache handles DB misses                     | Read-heavy workloads               |  
| **Write-Through**  | Write to cache and DB synchronously         | High consistency needs             |  
| **Write-Around**   | Bypass cache for writes                     | Write-heavy workloads              |  
| **Write-Back**     | Async DB writes via cache                   | High write performance             |  

## Contributing  

Contributions welcome! Please open an issue or PR for any improvements.  
 