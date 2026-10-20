import express from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

// Initialize Gemini (using the new SDK)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Webhook Verification (GET)
app.get('/api/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Handle Incoming Messages (POST)
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Return a '200 OK' to all requests within 3 seconds
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      const webhook_event = entry.messaging ? entry.messaging[0] : null;
      
      if (webhook_event && webhook_event.message && webhook_event.message.text) {
        const sender_psid = webhook_event.sender.id;
        const messageText = webhook_event.message.text;

        console.log(`Received message from ${sender_psid}: ${messageText}`);

        try {
          // Call Gemini API
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: messageText,
          });

          const botReply = response.text || "I received your message!";
          console.log(`Gemini response: ${botReply}`);

          // Send back to Messenger
          await sendMessengerMessage(sender_psid, botReply);

        } catch (error) {
          console.error('Error generating AI response or sending message:', error.message);
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// Function to send message to Messenger API
async function sendMessengerMessage(sender_psid, responseText) {
  const request_body = {
    recipient: { id: sender_psid },
    message: { text: responseText }
  };

  try {
    const fbResponse = await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      request_body
    );
    console.log("Message sent to Messenger successfully!", fbResponse.data);
  } catch (error) {
    console.error('Messenger API Error Details:', error.response ? error.response.data : error.message);
  }
}

export default app;
