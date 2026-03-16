import nodemailer from "nodemailer";
import type { SmtpKeys } from "../types.js";

export class SmtpService {
  constructor(private keys: SmtpKeys) {}

  async sendMessage(args: {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    reply_to?: string;
  }): Promise<string> {
    const transporter = nodemailer.createTransport({
      host: this.keys.host,
      port: this.keys.port,
      secure: this.keys.secure,
      auth: {
        user: this.keys.username,
        pass: this.keys.password,
      },
    });

    const info = await transporter.sendMail({
      from: this.keys.username,
      to: Array.isArray(args.to) ? args.to.join(", ") : args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      cc: args.cc ? (Array.isArray(args.cc) ? args.cc.join(", ") : args.cc) : undefined,
      bcc: args.bcc ? (Array.isArray(args.bcc) ? args.bcc.join(", ") : args.bcc) : undefined,
      replyTo: args.reply_to,
    });

    return JSON.stringify({ messageId: info.messageId, accepted: info.accepted }, null, 2);
  }
}
