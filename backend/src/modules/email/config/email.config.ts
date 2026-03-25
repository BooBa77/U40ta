import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  imap: {
    user: process.env.EMAIL_IMAP_USER || '',
    password: process.env.EMAIL_IMAP_PASSWORD || '',
    host: process.env.EMAIL_IMAP_HOST || '',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: process.env.EMAIL_IMAP_TLS === 'true',
  },
  smtp: {
    user: process.env.EMAIL_SMTP_USER || '',
    password: process.env.EMAIL_SMTP_PASSWORD || '',
    host: process.env.EMAIL_SMTP_HOST || '',
    port: parseInt(process.env.EMAIL_SMTP_PORT || '465', 10),
    secure: process.env.EMAIL_SMTP_SECURE === 'true',
    from: process.env.EMAIL_SMTP_FROM || '"U40TA System" <u40ta@mail.ru>',
  },
  attachments: {
    path: process.env.EMAIL_ATTACHMENTS_PATH || '../email-attachments',
  },
}));