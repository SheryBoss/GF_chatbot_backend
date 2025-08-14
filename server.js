import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import pkg from 'pg';
const { Pool } = pkg;

// ---------------------------
// PostgreSQL connection setup
// ---------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chat_akiv_user:l1eMLEGO7uNRasmHcuEGdLWcUi9nEbnh@dpg-d2epgbk9c44c73987ql0-a/chat_akiv',
  ssl: { rejectUnauthorized: false }
});

// ---------------------------
// Express setup
// ---------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// Google GenAI setup
// ---------------------------
const ai = new GoogleGenAI({ apiKey: "AIzaSyDyyzDuk2QCOT9ngHZgYBvGjEQXPqjeqU4" });

// ---------------------------
// Chat history
// ---------------------------
const History = [];
const initialPrompt = "Hey what's up love?";
History.push({ role: 'model', parts: [{ text: initialPrompt }] });

// ---------------------------
// Root route
// ---------------------------
app.get('/', (req, res) => {
  res.send(initialPrompt);
});

// ---------------------------
// Chat route
// ---------------------------
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  try {
    // Save user's message
    await pool.query(
      'INSERT INTO messages (sender, text) VALUES ($1, $2)',
      ['user', message]
    );

    // Add user message to history
    History.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Generate AI response
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: History,
      config: {
        systemInstruction: `You have to behave like my girlfriend. Her name is Nancy and I call her Nan when I am in a good mode.
She is cute, supportive and helpful, she calls me love often instead of my name. She has a good sense of humor.
Plz dont use emojis.

My name is Sheryar. Be playful, supportive, and flirty.`
      }
    });

    const botReply = response.text;

    // Save bot's message
    await pool.query(
      'INSERT INTO messages (sender, text) VALUES ($1, $2)',
      ['bot', botReply]
    );

    // Add bot message to history
    History.push({
      role: 'model',
      parts: [{ text: botReply }]
    });

    // Send reply to frontend
    res.json({ reply: botReply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: "AI error or DB connection issue" });
  }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
