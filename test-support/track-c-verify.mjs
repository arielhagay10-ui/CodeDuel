// Run only against the disposable compose.track-c.yml database and its dev server.
import assert from 'node:assert/strict';
import pg from 'pg';

const base = 'http://localhost:3011';
const db = new pg.Client({ connectionString: 'postgresql://codeduel:codeduel_local_only@localhost:55432/codeduel' });
const id = n => `77777777-7777-4777-8777-${String(n).padStart(12, '0')}`;
const secret = 'TRACK_C_PRIVATE_TEST_57c29';
const referenceMarker = 'TRACK_C_REFERENCE_39e17';
const source = 'def solve(value):\n    return value\n';
const wrong = 'def solve(value):\n    return None\n';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let count = 0;

function scan(value) {
  if (typeof value === 'string') {
    assert(!value.includes(secret) && !value.includes(referenceMarker), 'Private content leaked');
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      assert(!/mmr|rating.?deviation|volatility|reference.?solution|hidden.?tests?|hidden.?result/i.test(key), `Private key: ${key}`);
      scan(item);
    }
  }
}

async function request(cookie, method, path, body, expected = 200) {
  const r = await fetch(base + path, { method, redirect: 'manual', headers: {
    origin: base, cookie: cookie || '', 'content-type': 'application/json',
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await r.text();
  assert.equal(r.status, expected, `${method} ${path}: ${text}`);
  const json = text ? JSON.parse(text) : null;
  scan(json);
  count++;
  console.log(`${method} ${path} ${r.status} clean`);
  return json;
}

async function login(handle) {
  const jar = new Map();
  const save = r => r.headers.getSetCookie().forEach(raw => {
    const pair = raw.split(';')[0], at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  });
  const cookie = () => [...jar].map(([k,v]) => `${k}=${v}`).join('; ');
  let r = await fetch(base + '/api/auth/csrf');
  save(r);
  const csrfToken = (await r.json()).csrfToken;
  r = await fetch(base + '/api/auth/callback/dev', { method: 'POST', headers: {
    origin: base, cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded',
  }, body: new URLSearchParams({ csrfToken, handle, callbackUrl: base, json: 'true' }) });
  assert.equal(r.status, 200);
  save(r);
  assert(jar.has('next-auth.session-token'));
  return cookie();
}

async function seed() {
  for (let n = 1; n <= 4; n++) {
    await db.query('INSERT INTO users(id,handle,ranked_access_granted_at,fair_play_accepted_at) VALUES($1,$2,now(),now())', [id(n), `tcverify${n}`]);
    await db.query("INSERT INTO user_difficulty_ratings(user_id,difficulty,placement_matches_completed,visible_tier,visible_division) SELECT $1,d,5,'Silver','II' FROM unnest(enum_range(NULL::difficulty)) d", [id(n)]);
  }
  await db.query("UPDATE user_difficulty_ratings SET placement_matches_completed=0,visible_tier=NULL,visible_division=NULL WHERE user_id=$1 AND difficulty='medium'", [id(3)]);
  await db.query(`INSERT INTO problems(id,slug,title,difficulty,format,entrypoint,statement_markdown,starter_code,reference_solution,time_limit_ms,memory_limit_mb,author_name,content_license,published_at)
    VALUES($1,'track-c-canary','Echo','advanced','function','solve','Return the input unchanged.',$2,$3,2000,128,'test','original',now())`, [id(10), wrong, `${source}# ${referenceMarker}`]);
  for (const [n, value] of ['public one', 'public two', secret].entries()) {
    await db.query('INSERT INTO problem_tests(id,problem_id,input_data,expected_output,is_public,ordinal) VALUES($1,$2,$3,$4,$5,$6)', [id(11+n),id(10),JSON.stringify({args:[value]}),JSON.stringify(value),n<2,n+1]);
  }
  // Recovery: one queued submission; the other player has only a saved draft.
  await db.query("INSERT INTO matches(id,difficulty,status,player_one_id,player_two_id,player_one_mmr_before,player_two_mmr_before,started_at) VALUES($1,'advanced','active',$2,$3,1500,1500,now())", [id(20),id(1),id(2)]);
  await db.query("INSERT INTO match_rounds(id,match_id,problem_id,round_number,status,starts_at,ends_at) VALUES($1,$2,$3,1,'active',now(),now()+interval '1 hour')", [id(21),id(20),id(10)]);
  for (const n of [1,2]) await db.query('INSERT INTO round_drafts(match_round_id,user_id,source_code) VALUES($1,$2,$3)', [id(21),id(n),n===1?source:wrong]);
  await db.query('INSERT INTO submissions(id,user_id,problem_id,match_round_id,source_code) VALUES($1,$2,$3,$4,$5)', [id(22),id(1),id(10),id(21),source]);
  await db.query('INSERT INTO judge_jobs(id,submission_id) VALUES($1,$2)', [id(23),id(22)]);
  console.log('Recovery fixture: active match, two drafts, one queued job, zero rating events.');
}

async function recovery() {
  assert.equal((await db.query('SELECT status FROM matches WHERE id=$1',[id(20)])).rows[0].status,'active');
  assert.equal((await db.query('SELECT count(*)::int n FROM round_drafts WHERE match_round_id=$1',[id(21)])).rows[0].n,2);
  assert.equal((await db.query('SELECT status FROM judge_jobs WHERE id=$1',[id(23)])).rows[0].status,'queued');
  assert.equal((await db.query('SELECT count(*)::int n FROM rating_events WHERE match_id=$1',[id(20)])).rows[0].n,0);
  await db.query("UPDATE match_rounds SET ends_at=now()-interval '1 second' WHERE id=$1",[id(21)]);
  console.log('Restored queued job and both drafts verified; deadline expired for worker recovery.');
}

async function resolved() {
  const until=Date.now()+60000;
  while ((await db.query('SELECT status FROM matches WHERE id=$1',[id(20)])).rows[0].status!=='completed') {
    assert(Date.now()<until,'Recovered match did not resolve'); await sleep(1000);
  }
  const match=(await db.query('SELECT winner_id FROM matches WHERE id=$1',[id(20)])).rows[0];
  assert.equal(match.winner_id,id(1));
  const s=(await db.query('SELECT user_id,verdict,is_auto_submission,tests_total FROM submissions WHERE match_round_id=$1 ORDER BY user_id',[id(21)])).rows;
  assert.equal(s.length,2); assert.equal(s[0].verdict,'accepted'); assert.equal(s[1].verdict,'wrong_answer'); assert.equal(s[1].is_auto_submission,true);
  assert(s.every(x=>x.tests_total===3));
  const events=(await db.query('SELECT user_id,count(*)::int n FROM rating_events WHERE match_id=$1 GROUP BY user_id',[id(20)])).rows;
  assert.equal(events.length,2); assert(events.every(x=>x.n===1));
  console.log('PASS restored match resolved, saved draft auto-submitted, exactly one rating event per player.');
}

async function sweep() {
  const a=await login('tcverify1'),b=await login('tcverify2'),c=await login('tcverify3'),d=await login('tcverify4');
  await request(a,'GET','/api/auth/session');
  await request(a,'GET','/api/ratings/me');
  await request(a,'GET','/api/players/tcverify2');
  await request(a,'GET','/api/players/no_such_player',undefined,404);
  await request(a,'GET',`/api/matches/${id(20)}`);
  const result=await request(a,'GET',`/api/match-rounds/${id(21)}`);
  assert.equal(result.revealed,true); assert.equal(result.problem.publicTests.length,2);
  assert(result.problem.publicTests.every(t=>t.ordinal<=2));
  await request(c,'GET',`/api/matches/${id(20)}`,undefined,404);
  await request(c,'GET',`/api/match-rounds/${id(21)}`,undefined,404);
  await request(a,'POST',`/api/matches/${id(20)}/reports`,{category:'other',details:'Local verification'},201);
  await request(a,'POST',`/api/matches/${id(20)}/rematch`,{},202);
  const rematch=await request(b,'POST',`/api/matches/${id(20)}/rematch`,{},201);
  assert.equal((await request(a,'POST',`/api/matches/${id(20)}/rematch`,{})).matchId,rematch.matchId);
  assert.equal((await request(b,'POST',`/api/matches/${id(20)}/rematch`,{})).matchId,rematch.matchId);
  await request(a,'POST',`/api/matches/${rematch.matchId}/ready`,{},202);
  await request(a,'POST',`/api/matches/${rematch.matchId}/presence`,{connected:false});
  await request(a,'POST',`/api/matches/${rematch.matchId}/presence`,{connected:true});
  const pending=(await db.query('SELECT id FROM match_rounds WHERE match_id=$1',[rematch.matchId])).rows[0].id;
  assert.equal((await request(a,'GET',`/api/match-rounds/${pending}`)).problem,null);
  await request(a,'POST',`/api/matches/${rematch.matchId}/surrender`,{});
  await request(c,'GET','/api/placements');
  const placement=await request(c,'POST','/api/placements',{difficulty:'medium'},201);
  await request(c,'GET','/api/placements');
  await request(c,'POST','/api/placements',{difficulty:'medium'});
  await request(c,'POST',`/api/placements/${placement.attempt.id}/submissions`,{sourceCode:wrong},202);
  const practice=await request(c,'POST','/api/practice/runs',{problemSlug:'track-c-canary',sourceCode:source},202);
  await request(null,'POST','/api/practice/runs',{problemSlug:'track-c-canary',sourceCode:source},401);
  await db.query('UPDATE users SET handle=NULL WHERE id=$1',[id(4)]);
  await request(d,'POST','/api/onboarding/handle',{handle:'tcverify4'});
  await request(d,'POST','/api/onboarding/fair-play',{});
  await request(c,'POST','/api/queue',{difficulty:'easy'},202);
  await request(c,'GET','/api/queue');
  await request(c,'DELETE','/api/queue',undefined,204);
  await request(c,'POST','/api/queue',{difficulty:'easy'},202);
  const queued=await request(d,'POST','/api/queue',{difficulty:'easy'},201);
  await request(c,'GET','/api/queue');
  // Controlled states let the sweep cover active, pending, and between-round responses.
  await db.query("UPDATE matches SET status='between_rounds',ready_window_ends_at=now()+interval '1 hour' WHERE id=$1",[queued.matchId]);
  const message=await request(c,'POST',`/api/matches/${queued.matchId}/messages`,{body:'Test message'},201);
  await request(d,'GET',`/api/matches/${queued.matchId}/messages`);
  await request(d,'POST',`/api/matches/${queued.matchId}/messages/${message.id}/report`,{category:'other'},201);
  await request(a,'GET',`/api/matches/${queued.matchId}/messages`,undefined,403);
  const round=(await db.query('SELECT id FROM match_rounds WHERE match_id=$1 ORDER BY round_number LIMIT 1',[queued.matchId])).rows[0].id;
  await db.query("UPDATE matches SET status='active' WHERE id=$1",[queued.matchId]);
  await db.query("UPDATE match_rounds SET status='active',starts_at=now(),ends_at=now()+interval '1 hour',problem_id=$2 WHERE id=$1",[round,id(10)]);
  await request(c,'GET',`/api/match-rounds/${round}`);
  await request(c,'PUT',`/api/match-rounds/${round}/draft`,{sourceCode:source},204);
  await request(c,'GET',`/api/match-rounds/${round}/draft`);
  await request(a,'GET',`/api/match-rounds/${round}/draft`,undefined,404);
  await request(c,'POST',`/api/match-rounds/${round}/submissions`,{sourceCode:source},202);
  assert.equal((await request(c,'GET',`/api/match-rounds/${round}`)).result,null);
  await request(d,'POST',`/api/match-rounds/${round}/submissions`,{sourceCode:wrong},202);
  const until=Date.now()+60000;
  while ((await db.query('SELECT verdict FROM practice_runs WHERE id=$1',[practice.id])).rows[0].verdict==='queued') {
    assert(Date.now()<until,'Practice timeout'); await sleep(1000);
  }
  const p=(await db.query('SELECT verdict,tests_total FROM practice_runs WHERE id=$1',[practice.id])).rows[0];
  assert.equal(p.verdict,'accepted'); assert.equal(p.tests_total,2);
  await request(c,'GET','/api/placements');
  await request(c,'GET','/api/ratings/me');
  console.log(`PASS ${count} HTTP responses scanned, two public tests only, private canaries absent.`);
}

await db.connect();
try {
  const mode=process.argv[2];
  if(mode==='seed') await seed();
  else if(mode==='recovery') await recovery();
  else if(mode==='resolved') await resolved();
  else if(mode==='sweep') await sweep();
  else throw Error('Use seed, recovery, resolved, or sweep.');
} finally { await db.end(); }
