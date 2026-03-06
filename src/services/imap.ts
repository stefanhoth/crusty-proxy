import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import TurndownService from "turndown";
import type { ImapKeys } from "../types.js";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

export class ImapService {
  constructor(private keys: ImapKeys) {}

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: this.keys.host,
      port: this.keys.port,
      secure: this.keys.tls,
      auth: {
        user: this.keys.username,
        pass: this.keys.password,
      },
      logger: false,
    });
  }

  async listMessages(args: {
    folder?: string;
    limit?: number;
    search?: string;
  }): Promise<string> {
    const client = this.createClient();
    await client.connect();
    try {
      const folder = args.folder ?? "INBOX";
      const lock = await client.getMailboxLock(folder);
      try {
        const searchCriteria: Parameters<typeof client.search>[0] = args.search
          ? { or: [{ subject: args.search }, { from: args.search }] }
          : { all: true };

        const result = await client.search(searchCriteria, { uid: true });
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
    const client = this.createClient();
    await client.connect();
    try {
      const folder = args.folder ?? "INBOX";
      const lock = await client.getMailboxLock(folder);
      try {
        const raw = await client.fetchOne(String(args.uid), { source: true }, { uid: true });
        if (!raw || !("source" in raw) || !Buffer.isBuffer(raw.source)) {
          throw new Error(`Message UID ${args.uid} not found`);
        }

        const parsed = await simpleParser(raw.source);

        // Prefer HTML (convert to Markdown for compact, structured output).
        // Fall back to plain text if no HTML part is present.
        let body: string;
        let bodyType: string;
        if (parsed.html) {
          body = turndown.turndown(parsed.html);
          bodyType = "html→markdown";
        } else if (parsed.text) {
          body = parsed.text;
          bodyType = "plain";
        } else {
          body = "";
          bodyType = "none";
        }

        const formatAddresses = (field: typeof parsed.from | undefined) =>
          field?.value.map((a) => `${a.name ? a.name + " " : ""}<${a.address}>`) ?? [];

        const toField = parsed.to
          ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((g) =>
              g.value.map((a) => `${a.name ? a.name + " " : ""}<${a.address}>`),
            )
          : [];

        return JSON.stringify(
          {
            uid: args.uid,
            subject: parsed.subject,
            from: formatAddresses(parsed.from),
            to: toField,
            cc: formatAddresses(parsed.cc as typeof parsed.from | undefined),
            date: parsed.date,
            body,
            body_type: bodyType,
            attachments: parsed.attachments.map((att, i) => ({
              index: i,
              filename: att.filename ?? `attachment_${i}`,
              content_type: att.contentType,
              size: att.size,
            })),
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

  async getAttachment(args: { uid: number; attachment_index: number; folder?: string }): Promise<string> {
    const client = this.createClient();
    await client.connect();
    try {
      const folder = args.folder ?? "INBOX";
      const lock = await client.getMailboxLock(folder);
      try {
        const raw = await client.fetchOne(String(args.uid), { source: true }, { uid: true });
        if (!raw || !("source" in raw) || !Buffer.isBuffer(raw.source)) {
          throw new Error(`Message UID ${args.uid} not found`);
        }

        const parsed = await simpleParser(raw.source);
        const att = parsed.attachments[args.attachment_index];
        if (!att) {
          throw new Error(
            `Attachment index ${args.attachment_index} not found (message has ${parsed.attachments.length} attachment(s))`,
          );
        }

        const isText = att.contentType.startsWith("text/");
        return JSON.stringify(
          {
            filename: att.filename ?? `attachment_${args.attachment_index}`,
            content_type: att.contentType,
            size: att.size,
            encoding: isText ? "utf-8" : "base64",
            content: isText ? att.content.toString("utf-8") : att.content.toString("base64"),
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
}
