import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

const stateKey = Symbol.for("story-publish-readiness-test");
const state = { stories: [] as { id: string; title: string; source_id: string; title_confirmed: boolean }[], classifications: [] as { story_id: string }[], published: [] as string[][], readError: false };
(globalThis as typeof globalThis & { [stateKey]: unknown })[stateKey] = {
  supabase: {
    from(table: string) {
      return { select() { return { async in(_column: string, ids: string[]) {
        return state.readError ? { data: null, error: { message: "read failed" } } : { data: table === "stories" ? state.stories.filter((row) => ids.includes(row.id)) : state.classifications.filter((row) => ids.includes(row.story_id)), error: null };
      } }; } };
    },
    async rpc(_name: string, args: { story_ids: string[] }) {
      state.published.push(args.story_ids);
      return { data: args.story_ids.map((id) => ({ id, status: "published" })), error: null };
    },
  },
};
type Context = { parentURL?: string };
type Resolved = { url: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: { resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolved): Resolved }): unknown };
const dataModule = (code: string) => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/lib/author-access") return dataModule('export async function getAuthorContext(){return globalThis[Symbol.for("story-publish-readiness-test")];}');
  if (specifier === "@/lib/api-error") return dataModule('export function apiError(_operation,_error,message){return Response.json({error:message},{status:500});}');
  if (specifier === "next/server") return next("next/server.js", context);
  return next(specifier, context);
} });
const { POST } = await import("../src/app/api/story-workflow/route.ts");
const publish = (ids: string[]) => POST(new Request("http://localhost/api/story-workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", storyIds: ids }) }));

test("batch publishing identifies an unreviewed sibling and publishes nothing", async () => {
  state.stories = [
    { id: "day7", title: "福岡 Day7", source_id: "facebook-live:page:7", title_confirmed: true },
    { id: "day6", title: "福岡 Day6", source_id: "facebook-live:page:6", title_confirmed: false },
  ];
  state.classifications = [{ story_id: "day7" }]; state.published = []; state.readError = false;
  const response = await publish(["day7", "day6"]);
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.match(body.details, /福岡 Day6/);
  assert.doesNotMatch(body.details, /福岡 Day7/);
  assert.match(body.details, /儲存/);
  assert.deepEqual(state.published, []);
});

test("confirmed titles still require a saved classification; ready batches proceed", async () => {
  state.stories.forEach((story) => { story.title_confirmed = true; }); state.published = [];
  assert.equal((await publish(["day7", "day6"])).status, 422);
  assert.deepEqual(state.published, []);
  state.classifications.push({ story_id: "day6" });
  assert.equal((await publish(["day7", "day6"])).status, 200);
  assert.deepEqual(state.published, [["day7", "day6"]]);
});

test("classification read failure blocks publishing instead of treating articles as ready", async () => {
  state.readError = true; state.published = [];
  assert.equal((await publish(["day7"])).status, 500);
  assert.deepEqual(state.published, []);
  state.readError = false;
});
