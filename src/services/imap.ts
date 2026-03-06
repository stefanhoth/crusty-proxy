import { ImapFlow } from "imapflow";
import type { ImapKeys } from "../types.js";

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
        const msg = await client.fetchOne(
          String(args.uid),
          { envelope: true, bodyStructure: true, bodyParts: ["text"] },
          { uid: true },
        );
        if (!msg) throw new Error(`Message UID ${args.uid} not found`);

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
}
