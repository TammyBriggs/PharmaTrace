// Sends transactional email through Brevo's HTTPS API (free tier). SMTP is avoided on purpose: free hosts
// such as Render block outbound SMTP ports, while HTTPS always works.
//
// Set these to turn email on; without them every function returns { sent: false } and the app still works
// (the regulator is shown the temporary password on screen instead):
//   MAIL_API_KEY   Brevo API key
//   MAIL_FROM      a sender address verified in Brevo
//   MAIL_FROM_NAME optional, default "PharmaTrace"
const API = 'https://api.brevo.com/v3/smtp/email';

const configured = () => Boolean(process.env.MAIL_API_KEY && process.env.MAIL_FROM);

/** Never throws: a failed email must not undo an account that was already created. */
async function sendMail({ to, subject, text }) {
  if (!configured()) return { sent: false, reason: 'not_configured' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'api-key': process.env.MAIL_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || 'PharmaTrace', email: process.env.MAIL_FROM },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error('Email provider refused the message:', res.status);
      return { sent: false, reason: `provider_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('Could not send email:', e.name === 'AbortError' ? 'timed out' : e.message);
    return { sent: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

const loginText = ({ name, where, contact, password }) =>
  `Hello ${name},\n\nA PharmaTrace account has been created for you.\n\n` +
  `Sign in: ${where}\nEmail: ${contact}\nTemporary password: ${password}\n\n` +
  'You will be asked to choose a new password the first time you sign in. Do not share this email.\n\nPharmaTrace';

const resetText = ({ name, code }) =>
  `Hello ${name},\n\nYour PharmaTrace password reset code is ${code}.\nIt expires in 15 minutes. ` +
  'If you did not ask for it, you can ignore this email.\n\nPharmaTrace';

module.exports = { sendMail, configured, loginText, resetText };
