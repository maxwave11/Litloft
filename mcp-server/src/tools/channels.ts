import { z } from "zod";
import { runTool } from "./runTool.js";
import { readOnlyAnnotations, textResult, type LitloftTool } from "./types.js";

const MEDIA_IMPORT = "/api/addons/media_import";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface Subscription {
  id: number;
  provider: string;
  source_kind: string;
  source_ref: string;
  folder_path: string;
  title: string | null;
  display_title: string | null;
  is_enabled: boolean;
  last_synced_at: string | null;
}

interface SubscriptionVideo {
  item_id: string;
  status: string;
  file_id: string | null;
  title: string | null;
  channel: string | null;
  published_at: string | null;
}

interface LoftComment {
  replies?: unknown[];
}

interface LoftComments {
  supported: boolean;
  state: string;
  total: number | null;
  comments: LoftComment[];
  [key: string]: unknown;
}

const driveHeader = (drive: string) => ({ "X-Lit-Drive": encodeURIComponent(drive) });

const listChannels: LitloftTool = {
  name: "list_channels",
  description:
    "List the channels a drive follows (media_import subscriptions). Each entry's `id` is what list_channel_videos takes as `channel_id`, and its `name` is what semantic_search takes as `channel` to search inside that channel. Only subscribed channels are listed, so a channel whose videos were imported one by one has no entry here; its name still shows in each video's metadata.",
  inputSchema: { drive: z.string().describe("Drive name") },
  annotations: readOnlyAnnotations,
  handler: (args, client) =>
    runTool(async () => {
      const drive = args.drive as string;
      const subs = await client.request<Subscription[]>("GET", `${MEDIA_IMPORT}/subscriptions`, {
        query: { drive },
        headers: driveHeader(drive),
      });
      return textResult(
        subs.map((s) => ({
          id: s.id,
          name: s.display_title ?? s.title,
          provider: s.provider,
          source_kind: s.source_kind,
          source_ref: s.source_ref,
          folder_path: s.folder_path,
          is_enabled: s.is_enabled,
          last_synced_at: s.last_synced_at,
        }))
      );
    }),
};

const listChannelVideos: LitloftTool = {
  name: "list_channel_videos",
  description:
    "List the imported videos of one channel, newest published first. Returns each video's `file_id`, which get_transcript, get_video_metadata and get_video_comments take. Videos the channel sync has seen but not imported yet (no file) are left out and counted in `not_imported`.",
  inputSchema: {
    drive: z.string().describe("Drive name"),
    channel_id: z.number().int().describe("`id` from list_channels"),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Default ${DEFAULT_LIMIT}`),
    offset: z.number().int().min(0).optional().describe("Skip this many videos; default 0"),
  },
  annotations: readOnlyAnnotations,
  handler: (args, client) =>
    runTool(async () => {
      const drive = args.drive as string;
      const limit = (args.limit as number | undefined) ?? DEFAULT_LIMIT;
      const offset = (args.offset as number | undefined) ?? 0;

      const rows = await client.request<SubscriptionVideo[]>(
        "GET",
        `${MEDIA_IMPORT}/subscriptions/${encodeURIComponent(String(args.channel_id))}/videos`,
        { headers: driveHeader(drive) }
      );

      const imported = rows
        .filter((r) => r.file_id)
        .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
      const page = imported.slice(offset, offset + limit);

      return textResult({
        total: imported.length,
        not_imported: rows.length - imported.length,
        offset,
        returned: page.length,
        videos: page.map((v) => ({
          file_id: v.file_id,
          title: v.title,
          channel: v.channel,
          published_at: v.published_at,
        })),
      });
    }),
};

const getVideoMetadata: LitloftTool = {
  name: "get_video_metadata",
  description:
    "Get the source metadata of an imported video (.loft file): provider, original URL, channel name, publish date (YYYYMMDD), language, and whether captions exist. Fails with 404 for files that are not imported links.",
  inputSchema: {
    drive: z.string().describe("Drive name"),
    file_id: z.string().describe("12-character file id"),
  },
  annotations: readOnlyAnnotations,
  handler: (args, client) =>
    runTool(async () =>
      textResult(
        await client.request(
          "GET",
          `${MEDIA_IMPORT}/link/${encodeURIComponent(args.file_id as string)}/metadata`,
          { headers: driveHeader(args.drive as string) }
        )
      )
    ),
};

const getVideoComments: LitloftTool = {
  name: "get_video_comments",
  description:
    "Get the YouTube comments saved for an imported video, with replies nested under each comment. Not the same as list_comments, which returns comments written inside Litloft. `state` is `ready` once comments were fetched; `none`, `queued` or `error` mean there is nothing to read yet (comments are fetched from the Litloft UI, not by this tool), and `supported: false` means the provider has no comments.",
  inputSchema: {
    drive: z.string().describe("Drive name"),
    file_id: z.string().describe("12-character file id"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .optional()
      .describe(`Top-level comments to return, replies included; default ${DEFAULT_LIMIT}`),
  },
  annotations: readOnlyAnnotations,
  handler: (args, client) =>
    runTool(async () => {
      const limit = (args.limit as number | undefined) ?? DEFAULT_LIMIT;
      const data = await client.request<LoftComments>(
        "GET",
        `${MEDIA_IMPORT}/link/${encodeURIComponent(args.file_id as string)}/comments`,
        { headers: driveHeader(args.drive as string) }
      );
      return textResult({
        ...data,
        returned_comments: Math.min(data.comments.length, limit),
        comments: data.comments.slice(0, limit),
      });
    }),
};

export const channelTools: LitloftTool[] = [
  listChannels,
  listChannelVideos,
  getVideoMetadata,
  getVideoComments,
];
