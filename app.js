const express = require('express');
const path = require('path');
const mysql = require('mysql2');
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

// Low stock threshold
const LOW_STOCK_THRESHOLD = 10;

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Existing routes: Register, Login, etc., remain the same

// Update product quantity route using barcode
app.put('/update-product/:barcode', (req, res) => {
    const barcode_number = req.params.barcode;
    const { quantity, notify_supplier } = req.body; // Added notify_supplier flag

    // Validate quantity
    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity provided.' });
    }

    // First, check current stock level
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

        // Update quantity in database
        const updateQuery = 'UPDATE products SET quantity = ? WHERE barcode_number = ?';
        db.query(updateQuery, [newQuantity, barcode_number], (err) => {
            if (err) {
                console.error('Error updating product:', err);
                return res.status(500).json({ message: 'Failed to update product' });
            }

            // If stock falls below the threshold, send alert
            if (newQuantity < LOW_STOCK_THRESHOLD && product.supplier_id) {
                sendLowStockAlert(product.supplier_id, product.product_name, newQuantity, notify_supplier);
            }

            res.status(200).json({ message: 'Product quantity updated successfully' });
        });
    });
});

// Function to send SMS alert using Twilio
function sendLowStockAlert(supplierId, itemName, currentQuantity, notify_supplier) {
    const message = `Low Stock Alert: The item "${itemName}" is running low. Current stock: ${currentQuantity}.`;

    // Fetch admin contact
    db.query('SELECT mobile FROM users WHERE role = "admin"', (err, result) => {
        if (err) {
            console.error('Error fetching admin contact:', err);
            return;
        }
        const adminPhoneNumber = result[0]?.mobile;

        if (adminPhoneNumber) {
            // Notify admin
            client.messages
                .create({
                    body: message,
                    from: '+17605072693', // Replace with your Twilio number
                    to: adminPhoneNumber,
                })
                .then((msg) => {
                    console.log('Admin SMS sent:', msg.sid);

                    // If notify_supplier is true, notify the supplier
                    if (notify_supplier) {
                        notifySupplier(supplierId, message);
                    }
                })
                .catch((error) => console.error('Error sending SMS to admin:', error));
        } else {
            console.error('Admin contact not found.');
        }
    });
}

// Function to notify the supplier
function notifySupplier(supplierId, message) {
    const query = 'SELECT contact FROM suppliers WHERE id = ?';
    db.query(query, [supplierId], (err, result) => {
        if (err) {
            console.error('Error fetching supplier contact:', err);
            return;
        }

        const supplierPhoneNumber = result[0]?.contact;

        if (supplierPhoneNumber && supplierPhoneNumber.startsWith('+')) {
            client.messages
                .create({
                    body: message,
                    from: '+17605072693', // Replace with your Twilio number
                    to: supplierPhoneNumber,
                })
                .then((msg) => console.log('Supplier SMS sent:', msg.sid))
                .catch((error) => console.error('Error sending SMS to supplier:', error));
        } else {
            console.error('Supplier contact not found or invalid.');
        }
    });
}

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
