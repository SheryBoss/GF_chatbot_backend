import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai'; // keep your current SDK import
import pkg from 'pg';
const { Pool } = pkg;

// ---------- PostgreSQL ----------
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://chat_akiv_user:l1eMLEGO7uNRasmHcuEGdLWcUi9nEbnh@dpg-d2epgbk9c44c73987ql0-a/chat_akiv',
  ssl: { rejectUnauthorized: false }
});

// Create table if missing (once on boot)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('messages table ready');
  } catch (e) {
    console.error('Failed to ensure table:', e);
  }
})();

// ---------- App / AI ----------
const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const History = [];
const initialPrompt = "Hey what's up love?";
History.push({ role: 'model', parts: [{ text: initialPrompt }] });

// Hard no-emojis policy checkers
const NON_ASCII = /[^\x00-\x7F]/; // anything outside basic ASCII
const EMOTICONS = /(?:^|\s)(?:[:;=8][\-^]?[()DPOop/\\|])|<3(?:\s|$)/; // classic emoticons + <3
const violatesNoEmoji = (t = "") => NON_ASCII.test(t) || EMOTICONS.test(t);

app.get('/', (req, res) => {
  res.send(initialPrompt);
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  try {
    // Save user message
    await pool.query('INSERT INTO messages (sender, text) VALUES ($1, $2)', ['user', message]);

    // Build history
    History.push({ role: 'user', parts: [{ text: message }] });

    // STRICT system instruction: plain ASCII only, no emojis or emoticons
    const systemInstruction = `
ROLE: Nancy (girlfriend). Tone: playful, supportive, helpful, flirty.
ABSOLUTE RULES:
- Do NOT use emojis.
- Do NOT use emoticons (e.g., :), :D, ;-), <3).
- Use only plain ASCII characters (English letters, numbers, basic punctuation).
- Keep replies concise and natural.

Context:
- Boyfriend is Sheryar. He likes gym, coding, and game dev.
- You can call him "love". Keep it sweet, but words-only.
`;

    // First attempt
    const resp1 = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: History,
      config: { systemInstruction }
    });

    let botReply = (resp1?.text || "").trim();

    // If the model violated rules, regenerate with a stricter nudge
    if (violatesNoEmoji(botReply)) {
      const resp2 = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          ...History,
          { role: 'user', parts: [{ text: "Reply again using only plain ASCII text. No emojis, no emoticons." }] }
        ],
        config: { systemInstruction }
      });
      botReply = (resp2?.text || "").trim();

      // If still bad, fall back to a safe plain-text notice
      if (violatesNoEmoji(botReply)) {
        botReply = "Sorry, let me say that in plain words only. Can you repeat that?";
      }
    }

    // Save bot message
    await pool.query('INSERT INTO messages (sender, text) VALUES ($1, $2)', ['bot', botReply]);

    // Add to conversation memory
    History.push({ role: 'model', parts: [{ text: botReply }] });

    // Send back
    res.json({ reply: botReply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: "AI error or DB connection issue" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
