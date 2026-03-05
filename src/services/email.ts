import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { EmailKeysSchema } from "../types.js";
import type { z } from "zod";

type EmailKeys = z.infer<typeof EmailKeysSchema>;

export class EmailService {
  constructor(private keys: EmailKeys) {}

  private createImapClient(): ImapFlow {
    return new ImapFlow({
      host: this.keys.imap.host,
      port: this.keys.imap.port,
      secure: this.keys.imap.tls,
      auth: {
        user: this.keys.imap.username,
        pass: this.keys.imap.password,
      },
      logger: false,
    });
  }

  async listMessages(args: {
    folder?: string;
    limit?: number;
    search?: string;
  }): Promise<string> {
    const client = this.createImapClient();
    await client.connect();
    try {
      const folder = args.folder ?? "INBOX";
      const lock = await client.getMailboxLock(folder);
      try {
        const searchCriteria: Parameters<typeof client.search>[0] = args.search
          ? { or: [{ subject: args.search }, { from: args.search }] }
          : { all: true };

        const result = await client.search(searchCriteria, { uid: true });
        // imapflow.search returns number[] | false — false means no messages
        const uids: number[] = Array.isArray(result) ? result : [];
        const limit = args.limit ?? 20;
        const recentUids = uids.slice(-limit);

        if (recentUids.length === 0) return JSON.stringify([], null, 2);

        const messages: object[] = [];
        for await (const msg of client.fetch(recentUids.join(","), {
          envelope: true,
          flags: true,
          size: true,
        })) {
          const env = msg.envelope;
          const flags = msg.flags;
          if (!env || !flags) continue;
          messages.push({
            uid: msg.uid,
            subject: env.subject,
            from: env.from?.[0]
              ? `${env.from[0].name ?? ""} <${env.from[0].address}>`.trim()
              : null,
            date: env.date,
            size: msg.size,
            seen: flags.has("\\Seen"),
          });
        }
        return JSON.stringify(messages.reverse(), null, 2);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getMessage(args: { uid: number; folder?: string }): Promise<string> {
    const client = this.createImapClient();
    await client.connect();
    try {
      const folder = args.folder ?? "INBOX";
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(
          String(args.uid),
          { envelope: true, bodyStructure: true, bodyParts: ["text"] },
          { uid: true },
        );
        if (!msg) throw new Error(`Message UID ${args.uid} not found`);

        // Separate fetch for raw source
        const textMsg = await client.fetchOne(
          String(args.uid),
          { source: true },
          { uid: true },
        );

        const env = msg.envelope;
        if (!env) throw new Error(`Message UID ${args.uid} has no envelope`);

        const source =
          textMsg && "source" in textMsg && Buffer.isBuffer(textMsg.source)
            ? textMsg.source.toString("utf-8").slice(0, 51200)
            : null;

        return JSON.stringify(
          {
            uid: msg.uid,
            subject: env.subject,
            from: env.from?.map((a) => `${a.name ?? ""} <${a.address}>`.trim()),
            to: env.to?.map((a) => `${a.name ?? ""} <${a.address}>`.trim()),
            cc: env.cc?.map((a) => `${a.name ?? ""} <${a.address}>`.trim()),
            date: env.date,
            source,
          },
          null,
          2,
        );
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

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
      host: this.keys.smtp.host,
      port: this.keys.smtp.port,
      secure: this.keys.smtp.secure,
      auth: {
        user: this.keys.smtp.username,
        pass: this.keys.smtp.password,
      },
    });

    const info = await transporter.sendMail({
      from: this.keys.smtp.username,
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
