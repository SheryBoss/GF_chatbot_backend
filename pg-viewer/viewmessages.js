// viewMessages.js
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'dpg-d2epgbk9c44c73987ql0-a',      // your DB host
  port: 5432,              // your DB port
  user: 'chat_akiv_user',   // your DB username
  password: 'l1eMLEGO7uNRasmHcuEGdLWcUi9nEbnh', // your DB password
  database: 'chat_akiv', // your DB name
});

async function fetchMessages() {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM messages'); // change 'messages' to your table name
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fetchMessages();
