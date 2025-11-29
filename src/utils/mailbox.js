// src/utils/mailbox.js
export function sendDevEmail({ to, subject, body }) {
  try {
    const mailbox = JSON.parse(localStorage.getItem('mailbox') || '[]');
    const mail = {
      id: `m_${  Date.now().toString(36)  }${Math.random().toString(36).slice(2,6)}`,
      to,
      subject,
      body,
      createdAt: Date.now()
    };
    mailbox.unshift(mail);
    localStorage.setItem('mailbox', JSON.stringify(mailbox));
    // helpful console log for quick debugging
    return mail;
  } catch (err) {
    console.error('Failed to save dev email', err);
    return null;
  }
}

export function getMailbox() {
  return JSON.parse(localStorage.getItem('mailbox') || '[]');
}

export function clearMailbox() {
  localStorage.removeItem('mailbox');
}
