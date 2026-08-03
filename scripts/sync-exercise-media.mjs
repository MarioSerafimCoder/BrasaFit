import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiKey = process.env.ASCEND_API_KEY;
if (!apiKey) throw new Error("Defina ASCEND_API_KEY somente durante a sincronização.");

const host = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";
const baseUrl = `https://${host}/api/v1`;
const queries = {
  walk: "treadmill walking", bike: "stationary bike", march: "standing march", cat_cow: "cat cow stretch",
  pelvic_tilt: "pelvic tilt", heel_slide: "heel slide", bird_dog: "bird dog", dead_bug: "dead bug",
  plank_incline: "incline plank", box_squat: "box squat", goblet_squat: "goblet squat", leg_press: "leg press",
  split_squat_support: "split squat", hip_hinge_wall: "hip hinge", romanian_deadlift_db: "dumbbell romanian deadlift",
  leg_curl: "lying leg curl", glute_bridge: "glute bridge", hip_thrust_machine: "hip thrust machine",
  wall_pushup: "wall push up", chest_press: "chest press machine", db_floor_press: "dumbbell floor press",
  landmine_press: "landmine press", seated_row: "seated cable row", band_row: "resistance band row",
  chest_supported_row: "chest supported dumbbell row", lat_pulldown: "lat pulldown", biceps_curl: "dumbbell biceps curl",
  triceps_cable: "cable triceps pushdown", calf_raise: "standing calf raise", step_touch: "side step",
  incline_walk: "incline treadmill walking", hip_flexor_stretch: "hip flexor stretch", chest_stretch: "chest stretch",
  breathing_reset: "breathing exercise", elliptical: "elliptical machine", rowing_ergometer: "rowing machine",
  treadmill_intervals: "treadmill running", back_squat: "barbell back squat", hack_squat: "hack squat",
  smith_squat: "smith machine squat", barbell_deadlift: "barbell deadlift", cable_pull_through: "cable pull through",
  barbell_hip_thrust: "barbell hip thrust", cable_kickback: "cable glute kickback", barbell_bench_press: "barbell bench press",
  incline_db_press: "incline dumbbell bench press", cable_fly: "cable chest fly", shoulder_press_machine: "shoulder press machine",
  dumbbell_shoulder_press: "dumbbell shoulder press", barbell_row: "barbell bent over row", one_arm_cable_row: "one arm cable row",
  assisted_pullup: "assisted pull up", face_pull: "cable face pull", lateral_raise: "dumbbell lateral raise",
  preacher_curl_machine: "preacher curl machine", cable_curl: "cable biceps curl", leg_extension: "leg extension machine",
  leg_curl_seated: "seated leg curl", adductor_machine: "hip adduction machine", abductor_machine: "hip abduction machine",
  pallof_press: "pallof press", cable_crunch: "cable crunch", thoracic_rotation: "thoracic rotation stretch",
  dynamic_lunge_reach: "forward lunge", hamstring_stretch: "hamstring stretch", lat_stretch: "latissimus stretch",
  breathing_360: "diaphragmatic breathing", step_up: "step up", assisted_lunge: "assisted lunge",
  half_kneeling_landmine: "half kneeling landmine press", suitcase_carry: "suitcase carry", farmer_carry: "farmer carry",
  side_plank_knees: "kneeling side plank", bear_hover_short: "bear plank"
};

const headers = { "content-type": "application/json", "x-rapidapi-host": host, "x-rapidapi-key": apiKey };
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function tokens(value) {
  return value.toLowerCase().replace(/running/g, "run").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token && !["machine", "exercise", "stretch"].includes(token))
    .map((token) => token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token);
}

function selectBestHit(results, query) {
  const wanted = [...new Set(tokens(query))];
  const ranked = results.map((hit) => {
    const available = new Set(tokens(hit.name || ""));
    const matched = wanted.filter((token) => available.has(token)).length;
    return { hit, coverage: matched / Math.max(1, wanted.length), matched };
  }).sort((a, b) => b.coverage - a.coverage || b.matched - a.matched);
  return ranked[0]?.coverage >= 0.75 ? ranked[0].hit : null;
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

const source = await readFile(resolve("app/workout-data.ts"), "utf8");
const names = Object.fromEntries([...source.matchAll(/id: "([^"]+)", name: "([^"]+)"/g)].map((match) => [match[1], match[2]]));
const media = {};

for (const [id, query] of Object.entries(queries)) {
  try {
    const searchPayload = await getJson(`/exercises/search?search=${encodeURIComponent(query)}`);
    const results = Array.isArray(searchPayload?.data) ? searchPayload.data : Array.isArray(searchPayload) ? searchPayload : [];
    const hit = selectBestHit(results, query);
    if (!hit?.exerciseId) continue;
    const detailPayload = await getJson(`/exercises/${encodeURIComponent(hit.exerciseId)}`);
    const detail = detailPayload?.data || detailPayload;
    if (!detail?.videoUrl && !detail?.imageUrl && !hit.imageUrl) continue;
    media[id] = {
      exerciseName: names[id] || id,
      providerName: detail?.name || hit.name || query,
      videoUrl: detail?.videoUrl || null,
      imageUrl: detail?.imageUrl || hit.imageUrl || null,
      gifUrl: null,
    };
  } catch (error) {
    process.stderr.write(`${id}: ${error.message}\n`);
  }
  await wait(80);
}

for (const [id, query] of Object.entries(queries)) {
  if (media[id]) continue;
  try {
    const url = `https://oss.exercisedb.dev/api/v1/exercises/search?search=${encodeURIComponent(query)}`;
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(url);
      if (![429, 503].includes(response.status)) break;
      await wait(4000 * (attempt + 1));
    }
    if (!response.ok) throw new Error(`${response.status} public search`);
    const payload = await response.json();
    const results = Array.isArray(payload?.data) ? payload.data : [];
    const hit = selectBestHit(results, query);
    if (!hit?.gifUrl) continue;
    media[id] = {
      exerciseName: names[id] || id,
      providerName: hit.name || query,
      videoUrl: null,
      imageUrl: null,
      gifUrl: hit.gifUrl,
    };
  } catch (error) {
    process.stderr.write(`${id} (GIF): ${error.message}\n`);
  }
  await wait(1100);
}

const output = `// Gerado por scripts/sync-exercise-media.mjs. Não contém chaves ou credenciais.\nexport type ExerciseMediaItem = { exerciseName: string; providerName: string; videoUrl: string | null; imageUrl: string | null; gifUrl: string | null };\nexport const exerciseMedia: Record<string, ExerciseMediaItem> = ${JSON.stringify(media, null, 2)};\n`;
await writeFile(resolve("app/exercise-media.generated.ts"), output, "utf8");
process.stdout.write(`Mídia sincronizada para ${Object.keys(media).length} movimentos.\n`);
