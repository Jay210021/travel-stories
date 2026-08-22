import assert from "node:assert/strict";
import test from "node:test";
import { checkUploadContentLength, MAX_UPLOAD_REQUEST_BYTES, totalFileBytes } from "../src/lib/upload-limits.ts";

test("requires a valid bounded upload content length", () => {
  assert.equal(checkUploadContentLength(null), "missing");
  assert.equal(checkUploadContentLength("0"), "invalid");
  assert.equal(checkUploadContentLength("not-a-number"), "invalid");
  assert.equal(checkUploadContentLength("1.5"), "invalid");
  assert.equal(checkUploadContentLength(String(MAX_UPLOAD_REQUEST_BYTES)), "ok");
  assert.equal(checkUploadContentLength(String(MAX_UPLOAD_REQUEST_BYTES + 1)), "too-large");
});

test("sums every file in an upload batch", () => {
  assert.equal(totalFileBytes([{ size: 10 }, { size: 20 }, { size: 30 }]), 60);
});
