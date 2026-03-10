const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt'); // npm install bcrypt
require('dotenv').config();

const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://invoice-generator-frontend.pages.dev"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 CLOUD DATABASE CONNECTED"))
    .catch(err => {
        console.error("❌ Check your Atlas Password or IP Whitelist");
        console.error(err);
    });

// --- SCHEMAS ---
const InvoiceSchema = new mongoose.Schema({
    docNumber: String,
    date: Date,
    clientName: String,
    creatorEmail: String,
    total: Number,
    currency: String,
    items: Array,
    status: { type: String, default: 'Unpaid' }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
    name: { type: String, required: [true, "Name is required"] },
    email: { type: String, required: [true, "Email is required"], unique: true, trim: true },
    // FIXED: passwords are now hashed — never stored as plain text
    password: { type: String, required: [true, "Password is required"] }
});

const ClientSchema = new mongoose.Schema({
    name: String,
    address: String,
    shipTo: String,
    gstin: String
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
const User = mongoose.model('User', UserSchema);
const Client = mongoose.model('Client', ClientSchema);

// --- AUTH ROUTES ---

// SIGNUP — hash password before saving
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Please fill in all fields." });
    }

    try {
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: "An account with this email already exists." });
        }

        // FIXED: Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "Account created successfully!" });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(400).json({ error: "Signup failed. Please try again." });
    }
});

// LOGIN — compare with hashed password
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "No account found with this email." });
        }

        // FIXED: Compare plain password against stored hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect password." });
        }

        res.status(200).json({ user: { name: user.name, email: user.email } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// FORGOT PASSWORD (simulated)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "No account found with this email." });
        }
        // In a real app: send an email with a reset link via nodemailer
        res.json({ message: "Reset instruction sent to " + email });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// --- INVOICE ROUTES ---

// GET invoices by user email
app.get('/api/invoices', async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ error: "Email parameter is required" });
    }
    try {
        const history = await Invoice.find({ creatorEmail: email }).sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// CREATE invoice
app.post('/api/invoices', async (req, res) => {
    try {
        const newInvoice = new Invoice(req.body);
        await newInvoice.save();
        res.status(201).json(newInvoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE (full edit)
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

// PATCH (status toggle)
app.patch('/api/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }

        const updatedInvoice = await Invoice.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true }
        );

        if (!updatedInvoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        res.status(200).json(updatedInvoice);
    } catch (error) {
        console.error("PATCH error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE invoice
app.delete('/api/invoices/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// --- CLIENTS ROUTE ---
app.get('/api/clients', async (req, res) => {
    const clients = await Client.find();
    res.json(clients);
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});