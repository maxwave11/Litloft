import { describe, expect, it } from "vitest";
import { channelTools } from "../tools/channels.js";
import { fakeClient } from "./testClient.js";

function findTool(name: string) {
  const tool = channelTools.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

const headers = { "X-Lit-Drive": "videos" };

describe("list_channels", () => {
  it("asks media_import for the drive's subscriptions and keeps the fields an agent needs", async () => {
    const client = fakeClient(async () => [
      {
        id: 9,
        provider: "youtube",
        source_kind: "channel",
        source_ref: "UC0GKVFIPVKieafrJp5q-kfw",
        drive: "videos",
        folder_path: "",
        title: null,
        display_title: "Туран Тендер",
        is_enabled: true,
        last_synced_at: "2026-10-16T08:00:00+00:00",
        avatar_url: "/x.png",
        cooldown_minutes: 30,
      },
    ]);
    const result = await findTool("list_channels").handler({ drive: "videos" }, client);
    expect(client.calls).toEqual([
      {
        method: "GET",
        path: "/api/addons/media_import/subscriptions",
        options: { query: { drive: "videos" }, headers },
      },
    ]);
    expect(JSON.parse(result.content[0].text)).toEqual([
      {
        id: 9,
        name: "Туран Тендер",
        provider: "youtube",
        source_kind: "channel",
        source_ref: "UC0GKVFIPVKieafrJp5q-kfw",
        folder_path: "",
        is_enabled: true,
        last_synced_at: "2026-10-16T08:00:00+00:00",
      },
    ]);
  });
});

describe("list_channel_videos", () => {
  const rows = [
    { item_id: "a", status: "imported", file_id: "F1", title: "old", channel: "C", published_at: "20260101" },
    { item_id: "b", status: "failed", file_id: null, title: null, channel: null, published_at: null },
    { item_id: "c", status: "imported", file_id: "F3", title: "new", channel: "C", published_at: "20260926" },
    { item_id: "d", status: "imported", file_id: "F4", title: "undated", channel: "C", published_at: null },
  ];

  it("lists imported videos newest first and counts the ones without a file", async () => {
    const client = fakeClient(async () => rows);
    const result = await findTool("list_channel_videos").handler(
      { drive: "videos", channel_id: 9 },
      client
    );
    expect(client.calls).toEqual([
      {
        method: "GET",
        path: "/api/addons/media_import/subscriptions/9/videos",
        options: { headers },
      },
    ]);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(3);
    expect(parsed.not_imported).toBe(1);
    expect(parsed.videos.map((v: { file_id: string }) => v.file_id)).toEqual(["F3", "F1", "F4"]);
  });

  it("pages with limit and offset", async () => {
    const client = fakeClient(async () => rows);
    const result = await findTool("list_channel_videos").handler(
      { drive: "videos", channel_id: 9, limit: 1, offset: 1 },
      client
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.returned).toBe(1);
    expect(parsed.videos[0].file_id).toBe("F1");
  });
});

describe("get_video_metadata", () => {
  it("calls the link metadata endpoint scoped to the drive", async () => {
    const client = fakeClient(async () => ({ channel: "Туран Тендер" }));
    const result = await findTool("get_video_metadata").handler(
      { drive: "videos", file_id: "nBpSlMPpP7b1" },
      client
    );
    expect(client.calls).toEqual([
      {
        method: "GET",
        path: "/api/addons/media_import/link/nBpSlMPpP7b1/metadata",
        options: { headers },
      },
    ]);
    expect(result.content[0].text).toContain("Туран Тендер");
  });
});

describe("get_video_comments", () => {
  const comments = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, text: `t${i}`, replies: [] }));

  it("calls the link comments endpoint and caps top-level comments at limit", async () => {
    const client = fakeClient(async () => ({
      supported: true,
      state: "ready",
      total: 3,
      comments,
    }));
    const result = await findTool("get_video_comments").handler(
      { drive: "videos", file_id: "F1", limit: 2 },
      client
    );
    expect(client.calls).toEqual([
      {
        method: "GET",
        path: "/api/addons/media_import/link/F1/comments",
        options: { headers },
      },
    ]);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(3);
    expect(parsed.returned_comments).toBe(2);
    expect(parsed.comments.map((c: { id: string }) => c.id)).toEqual(["c0", "c1"]);
  });

  it("passes the not-fetched state through so the agent can tell empty from missing", async () => {
    const client = fakeClient(async () => ({
      supported: true,
      state: "none",
      total: null,
      comments: [],
    }));
    const result = await findTool("get_video_comments").handler(
      { drive: "videos", file_id: "F1" },
      client
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.state).toBe("none");
    expect(parsed.returned_comments).toBe(0);
  });
});
