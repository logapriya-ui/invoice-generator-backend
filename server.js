const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
    origin:["https://invoice-generator-frontend.pages.dev"],
    methods : ["GET","POST","PUT","PATCH","DELETE"],
    credentials : true
}));
app.use(express.json()); // Increased limit for logos

// 1. DATABASE CONNECTION


const DB_URL=process.env.MONGO_URI;

mongoose.connect(DB_URL)
  .then(() => console.log("🚀 CLOUD DATABASE CONNECTED"))
  .catch(err => {
    console.error("❌ STUCK? Check your Atlas Password or IP Whitelist");
    console.error(err);
  });
// 2. DATA MODELS
const InvoiceSchema = new mongoose.Schema({
    docNumber: String,
    date: Date,
    clientName: String,
    creatorEmail: String, 
    docNumber: String,
    total: Number,
    currency: String,
    items: Array,
    status: { type: String, default: 'Unpaid' }
}, { timestamps: true });

const ClientSchema = new mongoose.Schema({
    name: String,
    address: String,
    shipTo: String,
    gstin: String
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Client = mongoose.model('Client', ClientSchema);

// server.js
const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, "Name is required"] 
    },
    email: { 
        type: String, 
        required: [true, "Email is required"], 
        unique: true,
        trim: true 
    },
    password: { 
        type: String, 
        required: [true, "Password is required"] 
    }
});

const User = mongoose.model('User', UserSchema);


// In your Signup Route, add this check:
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // 1. Check if values are actually there
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Please fill in all fields." });
    }

    try {
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.status(201).json({ message: "User created!" });
    } catch (err) {
        res.status(400).json({ error: "Email already exists or invalid data." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    console.log("📩 Login request received for:", req.body.email); // ADD THIS LINE
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, password });
        if (!user) return res.status(400).json({ error: "Invalid credentials" });
        res.status(200).json({ user: { name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});
// 3. API ROUTES
// --- Invoices ---
app.get('/api/invoices', async (req, res) => {
    const { email } = req.query; // Capture the email sent by the frontend

    try {
        if (!email) {
            return res.status(400).json({ error: "Email parameter is required" }); //
        }
        
        // This query ensures ONLY invoices belonging to this email are returned
        const history = await Invoice.find({ creatorEmail: email }).sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" }); //
    }
});

// CREATE Invoice
app.post('/api/invoices', async (req, res) => {
    try {
        const newInvoice = new Invoice(req.body);
        await newInvoice.save();
        res.status(201).json(newInvoice);
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

// UPDATE (Edit) Invoice Data
app.put('/api/invoices/:id', async (req, res) => {
    try {
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedInvoice);
    } catch (err) {
        res.status(400).json({ error: "Failed to update invoice" });
    }
});

// PATCH (Status Only) Toggle
app.patch('/api/invoices/:id', async (req, res) => {
    try {
        console.log("Incoming update:",req.body)
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status }, 
            { new: true }
        );
        res.json(updatedInvoice);
        
    } catch (error) {
        res.status(500).json({ message: "Error updating status" });
    }
});

// DELETE Invoice
app.delete('/api/invoices/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});


// FORGOT PASSWORD ROUTE (Simulated)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "No account found with this email." });
        }
        
        // In a real app, you would use 'nodemailer' here to send an actual email.
        res.json({ message: "Reset instruction sent to " + email });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


app.get('/api/clients', async (req, res) => {
    const clients = await Client.find();
    res.json(clients);
});


// START SERVER
const PORT=process.env.PORT || 5000;
app.listen(PORT,() => {
  console.log(`🚀 Server running on port ${PORT}`);
});