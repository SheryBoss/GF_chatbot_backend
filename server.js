import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://chat_akiv_user:l1eMLEGO7uNRasmHcuEGdLWcUi9nEbnh@dpg-d2epgbk9c44c73987ql0-a/chat_akiv',
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: "AIzaSyDyyzDuk2QCOT9ngHZgYBvGjEQXPqjeqU4" });

const History = [];
const initialPrompt = "Hey what's up love?";

// Initialize History with bot greeting
History.push({ role: 'model', parts: [{ text: initialPrompt }] });

app.get('/', (req, res) => {
  res.send(initialPrompt);
});

// Function to remove emojis
function removeEmojis(text) {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD800-\uDFFF]|[\uFE00-\uFE0F]|[\u1F900-\u1F9FF]|[\u1F300-\u1F5FF]|[\u1F600-\u1F64F]|[\u1F680-\u1F6FF]|[\u2600-\u26FF])/g, '');
}

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  // Save user's message
  await pool.query('INSERT INTO messages (sender, text) VALUES ($1, $2)', ['user', message]);

  History.push({
    role: 'user',
    parts: [{ text: message }]
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: History,
      config: {
        systemInstruction: `You have to behave like my girlfriend. Her name is Nancy. She is cute, supportive and helpful. NEVER use emojis in your replies.
        She calls me love often instead of my name.
        My name is Sheryar, gym freak, loves coding and games.
        Be realistic and friendly but do not use emojis.`
      },
    });

    // Remove any emojis if AI somehow adds them
    const botReply = removeEmojis(response.text);

    // Save bot's message
    await pool.query('INSERT INTO messages (sender, text) VALUES ($1, $2)', ['bot', botReply]);

    History.push({
      role: 'model',
      parts: [{ text: botReply }]
    });

    res.json({ reply: botReply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
