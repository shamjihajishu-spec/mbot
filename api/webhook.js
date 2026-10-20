import express from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. Webhook Verification (GET) - Meta Messenger Setup
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
  } else {
    res.sendStatus(400);
  }
});

// 2. Handle Incoming Messages (POST)
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Immediately respond with 200 OK to prevent Meta webhook timeout
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      const webhook_event = entry.messaging ? entry.messaging[0] : null;
      
      if (webhook_event && webhook_event.message && webhook_event.message.text) {
        const sender_psid = webhook_event.sender.id;
        const messageText = webhook_event.message.text;

        console.log(`Received message from ${sender_psid}: ${messageText}`);

        try {
          // Generate AI response using Gemini 2.5 Flash
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: messageText,
          });

          const botReply = response.text || "Hello! I received your message.";
          console.log(`Gemini response generated successfully.`);

          // Send back to Messenger user
          await sendMessengerMessage(sender_psid, botReply);

        } catch (error) {
          console.error('Error generating AI response:', error.message);
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// 3. Helper Function to send message via Meta Graph API
async function sendMessengerMessage(sender_psid, responseText) {
  const request_body = {
    recipient: { id: sender_psid },
    message: { text: responseText }
  };

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      request_body
    );
    console.log("Reply sent to Messenger successfully!");
  } catch (error) {
    console.error('Messenger API Error Details:', error.response ? error.response.data : error.message);
  }
}

export default app;
