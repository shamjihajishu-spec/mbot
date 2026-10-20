import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// 1. Webhook Verification (GET) - Meta Messenger Setup
app.get('/api/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// 2. Handle Incoming Messages (POST)
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    try {
      for (const entry of body.entry) {
        const webhook_event = entry.messaging ? entry.messaging[0] : null;
        
        if (webhook_event && webhook_event.message && webhook_event.message.text) {
          const sender_psid = webhook_event.sender.id;
          const messageText = webhook_event.message.text;

          console.log(`Received message from ${sender_psid}: ${messageText}`);

          // Call Gemini API using the correct and latest gemini-3.8-flash model
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
          
          console.log("Calling Gemini API...");
          
          let geminiResponse;
          try {
            geminiResponse = await axios.post(geminiUrl, {
              contents: [{ parts: [{ text: messageText }] }]
            }, { timeout: 30000 });
          } catch (geminiErr) {
            console.error("GEMINI API FAILED:", geminiErr.response ? JSON.stringify(geminiErr.response.data) : geminiErr.message);
            return res.status(200).send('EVENT_RECEIVED');
          }

          // Extract response text safely
          const botReply = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Hello! I received your message.";
          console.log(`Gemini response generated successfully: ${botReply}`);

          // Send back to Messenger user via Meta Graph API
          await axios.post(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
            {
              recipient: { id: sender_psid },
              message: { text: botReply }
            }
          );
          
          console.log("Reply sent to Messenger successfully!");
        }
      }
      
      return res.status(200).send('EVENT_RECEIVED');

    } catch (error) {
      console.error('Error in processing:', error.response ? JSON.stringify(error.response.data) : error.message);
      return res.status(200).send('EVENT_RECEIVED');
    }
  } else {
    return res.sendStatus(404);
  }
});

export default app;
