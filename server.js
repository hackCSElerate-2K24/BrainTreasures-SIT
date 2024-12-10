const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const twilio = require('twilio');
const cors = require('cors');
const app = express();
app.use(cors());
require('dotenv').config();
// Middleware to parse incoming requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MySQL connection setup
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: '',
//     password: '',
//     database: 'inventory_db'
// });
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});
// Test MySQL Connection with Detailed Error Logging
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('Connected to MySQL Database');
});

// Twilio credentials (replace these with your actual SID and Auth Token)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

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

// API route to fetch products data (example endpoint)
app.get('/products', (req, res) => {
    // Query to fetch all products
    const query = 'SELECT * FROM products LIMIT 10';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching products data:', err.message);
            return res.status(500).send({ error: 'Failed to fetch products data.' });
        }
        res.json(results);
    });
});

// Add new product route
app.post('/add-product', (req, res) => {
    const { barcode_number, product_name, quantity, supplier_id, price_per_unit, manufacture_date, expiration_date } = req.body;

    if (!barcode_number || !product_name || !quantity || !price_per_unit || !manufacture_date) {
        return res.status(400).json({ error: 'All required fields are not provided' });
    }

    // SQL query to insert product into the products table
    const query = 'INSERT INTO products (barcode_number, product_name, quantity, supplier_id, price_per_unit, manufacture_date, expiration_date) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [barcode_number, product_name, quantity, supplier_id, price_per_unit, manufacture_date, expiration_date], (err, result) => {
        if (err) {
            console.error('Error adding product:', err.message);
            return res.status(500).json({ error: 'Failed to add product. Please try again.' });
        }
        res.status(200).json({ message: 'Product added successfully!' });
    });
});

// Update product quantity route using barcode
app.put('/update-product/:barcode', (req, res) => {
    const barcode_number = req.params.barcode;
    const { quantity } = req.body;

    const query = 'SELECT * FROM products WHERE barcode_number = ?';
    db.query(query, [barcode_number], (err, result) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ message: 'Error querying database' });
        }
        
        if (result.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = result[0];
        const newQuantity = product.quantity + quantity;
        const updateQuery = 'UPDATE products SET quantity = ? WHERE barcode_number = ?';
        
        db.query(updateQuery, [newQuantity, barcode_number], (err) => {
            if (err) {
                console.error('Error updating product:', err);
                return res.status(500).json({ message: 'Failed to update product' });
            }

            // Send alert if stock is low
            if (newQuantity < 5 && product.supplier_id) {
                sendLowStockAlert(product.supplier_id, product.product_name, newQuantity);
            }
            sendLowStockAlert(product.supplier_id, product.product_name, newQuantity);
            res.status(200).json({ message: 'Product quantity updated successfully' });
        });
    });
});
// Endpoint to get all inventory items
app.get('/items', (req, res) => {
    const selectQuery = 'SELECT * FROM inventory';
    db.query(selectQuery, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(results);
    });
});



function sendLowStockAlert(supplierId, itemName, currentQuantity) {
    const message = `Low Stock Alert: The item "${itemName}" is running low. Current stock: ${currentQuantity}. Please restock soon.`;

    // Query to get the supplier's contact number
    const query = 'SELECT contact FROM suppliers WHERE id = ?';
    db.query(query, [supplierId], (err, result) => {
        if (err) {
            console.error('Error fetching supplier contact:', err);
            return;
        }

        const phoneNumber = result[0]?.contact;
        if (!phoneNumber) {
            console.error('Supplier contact not found');
            return;
        }

        console.log(`Attempting to send SMS to: ${phoneNumber}`);

        // Send the SMS
        if (!phoneNumber.startsWith('+')) {
            console.error(`Invalid phone number format: ${phoneNumber}`);
            return;
        }

        client.messages
            .create({
                body: message,
                from: '+17605084393', // Your Twilio phone number
                to: phoneNumber
            })
            .then((message) => console.log('SMS sent:', message.sid))
            .catch((error) => console.error('Error sending SMS:', error));
    });
}

// Add new supplier route
app.post('/add-supplier', (req, res) => {
    const { supplierName, supplierContact, supplierAddress } = req.body;

    if (!supplierName || !supplierContact || !supplierAddress) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // SQL query to insert supplier into the suppliers table
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
