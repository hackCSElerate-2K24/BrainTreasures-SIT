const twilio = require('twilio');

const accountSid = 'AC3709d38bdc5c277b744d1ebcdce863d8';  // Your Twilio Account SID
const authToken = '36e878f6db74f2bc2bd2b8cfc7374a37';  // Your Twilio Auth Token

const client = new twilio(accountSid, authToken);

// Example phone number and message
const phoneNumber = '+916362568033';  // Replace with the phone number you want to send SMS to
const message = 'Hii!! Your Products are out of stock.Please Restock soon!!';

client.messages
    .create({
        body: message,
        from: '+17605072693',  // Your Twilio phone number (must be in E.164 format)
        to: phoneNumber       // The recipient's phone number
    })
    .then((message) => console.log('Message sent successfully:', message.sid))
    .catch((err) => console.error('Error sending SMS:', err));
