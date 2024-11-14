const express = require('express'); 
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');
app.use(cors());

// Middleware to parse incoming requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'Sachin',
    password: 'kbsachin',
    database: 'inventory_db'
});

// Test MySQL Connection with Detailed Error Logging
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('Connected to MySQL Database');
});

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Registration Route
app.post('/register', async (req, res) => {
    const { name, mobile, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO users (name, mobile, username, password) VALUES (?, ?, ?, ?)';
    db.query(query, [name, mobile, username, hashedPassword], (err, result) => {
        if (err) {
            console.error('Error during registration:', err.message);
            return res.status(500).send({ error: 'Registration failed. Try again.' });
        }
        res.send({ message: 'User registered successfully!' });
    });
});

// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Error during login:', err.message);
            return res.status(500).send({ error: 'Login failed. Try again.' });
        }

        if (results.length === 0) {
            return res.status(400).send({ error: 'User not found.' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            res.redirect('/dashboard');
        } else {
            res.status(401).send({ error: 'Invalid credentials.' });
        }
    });
});

// Serve the dashboard.html file for the '/dashboard' route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API route to fetch inventory data (example endpoint)
app.get('/inventory-data', (req, res) => {
    // Example query to fetch inventory data
    const query = 'SELECT * FROM inventory LIMIT 10';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching inventory data:', err.message);
            return res.status(500).send({ error: 'Failed to fetch inventory data.' });
        }
        res.json(results);
    });
});

// Add supplier route
app.post('/add-supplier', (req, res) => {
    const { supplierName, supplierContact, supplierAddress } = req.body;

    // Check if any field is missing
    if (!supplierName || !supplierContact || !supplierAddress) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // SQL query to insert data into the suppliers table
    const query = 'INSERT INTO suppliers (name, contact, address) VALUES (?, ?, ?)';
    db.query(query, [supplierName, supplierContact, supplierAddress], (err, result) => {
        if (err) {
            console.error('Error adding supplier:', err.message);
            return res.status(500).json({ error: 'Failed to add supplier. Please try again.' });
        }
        res.status(200).json({ message: 'Supplier added successfully!' });
    });
});

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
