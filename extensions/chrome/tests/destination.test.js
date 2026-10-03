import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrigin, validateFolder, hostPattern, folderUrl, fileUrl } from "../lib/destination.js";

test("Configured server is a single HTTP origin, retaining its port", () => {
  assert.equal(normalizeOrigin(" http://192.168.1.5:3001/ "), "http://192.168.1.5:3001");
  assert.equal(hostPattern("http://localhost:3001"), "http://localhost/*");
  for (const url of ["file:///tmp", "https://u:p@host", "https://host/path", "https://host?x=1", "https://host#x", "http://*.example.org", "http://host\\other"]) assert.throws(() => normalizeOrigin(url));
});
test("Destination stays relative while preserving real folder names", () => {
  assert.equal(validateFolder("日本語/папка 1"), "日本語/папка 1");
  assert.equal(validateFolder(""), "");
  for (const path of ["../outside", "/absolute", "C:\\outside", "a/../b", "a/./b", "a//b", "a\\b", "a\u0000b"]) assert.throws(() => validateFolder(path), path);
  assert.equal(validateFolder("%2e%2e"), "%2e%2e");
});
test("Result links encode each segment and preserve drive and folder scope", () => {
  assert.equal(folderUrl("http://localhost:3001", "my drive", "a b/c&d"), "http://localhost:3001/drive/my%20drive/a%20b/c%26d");
  assert.equal(fileUrl("http://localhost:3001", "my drive", "", "f1"), "http://localhost:3001/drive/my%20drive?file=f1");
});
