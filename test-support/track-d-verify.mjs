// Only the disposable verification stack on 55432, with Next dev on 3011.
import assert from 'node:assert/strict';
import pg from 'pg';
const base='http://localhost:3011';
const db=new pg.Client({connectionString:'postgresql://codeduel:codeduel_local_only@localhost:55432/codeduel'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let checked=0;
function scan(value){
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
    assert(!/mmr|rating.?deviation|volatility|reference.?solution|hidden.?tests?/i.test(key),`Private key ${key}`);scan(item);
  }
}
async function req(cookie,method,path,body,status=200){
  const response=await fetch(base+path,{method,redirect:'manual',headers:{cookie,origin:base,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();assert.equal(response.status,status,`${method} ${path}: ${text}`);
  const value=text?JSON.parse(text):null;scan(value);checked++;return value;
}
async function login(handle){
  const jar=new Map();const save=r=>r.headers.getSetCookie().forEach(s=>{const [pair]=s.split(';');const at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));});
  const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
  let r=await fetch(base+'/api/auth/csrf');save(r);const {csrfToken}=await r.json();
  r=await fetch(base+'/api/auth/callback/dev',{method:'POST',headers:{cookie:cookie(),origin:base,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,handle,json:'true'})});save(r);
  assert(jar.has('next-auth.session-token'));return cookie();
}
async function until(load,done){const deadline=Date.now()+60000;while(true){const data=await load();if(done(data))return data;assert(Date.now()<deadline,'Judge timed out');await sleep(2000);}}
await db.connect();
try{
  const suffix=Date.now().toString(36),a=await login(`tdverify${suffix}`),b=await login(`tdother${suffix}`);
  const me=await req(a,'GET','/api/me');assert(me.user.rankedAccess);assert.equal((await req('','GET','/api/me')).user,null);
  const catalog=await req('','GET','/api/problems');assert(catalog.problems.length>=14);assert(catalog.problems.every(p=>p.publicTests.length===2));
  const problem=catalog.problems.find(p=>p.slug==='digit-sum');
  const counts=async()=> (await db.query('SELECT (SELECT count(*) FROM submissions WHERE user_id=$1)::int submissions,(SELECT count(*) FROM rating_events WHERE user_id=$1)::int ratings',[me.user.id])).rows[0];
  const before=await counts();
  await req('','POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode:'pass'},401);
  const run=await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode:'def digit_sum(number):\n    return sum(map(int,str(number)))'},202);
  await req(b,'GET',`/api/practice/runs/${run.id}`,undefined,404);
  await req(a,'GET','/api/practice/runs/------------------------------------',undefined,404);
  const result=await until(()=>req(a,'GET',`/api/practice/runs/${run.id}`),r=>!['queued','running'].includes(r.verdict));
  assert.equal(result.verdict,'accepted');assert.equal(result.testsTotal,2);assert.deepEqual(await counts(),before);
  console.log('PASS public catalog, owned practice result, two-test judging, no ranked writes');
  await db.query("UPDATE user_difficulty_ratings SET placement_matches_completed=0,visible_tier=NULL,visible_division=NULL WHERE user_id=$1 AND difficulty='medium'",[me.user.id]);
  for(let n=1;n<=5;n++){
    const created=await req(a,'POST','/api/placements',{difficulty:'medium'},201);
    const resumed=await req(a,'POST','/api/placements',{difficulty:'medium'});assert.deepEqual(resumed,created);
    const attempt=await req(a,'GET',`/api/placements/${created.attempt.id}`);assert.equal(attempt.placementNumber,n);assert.equal(attempt.problem.difficulty,'medium');
    await req(b,'GET',`/api/placements/${attempt.id}`,undefined,404);
    await req(a,'POST',`/api/placements/${attempt.id}/submissions`,{sourceCode:attempt.problem.starterCode},202);
    await req(a,'POST',`/api/placements/${attempt.id}/submissions`,{sourceCode:attempt.problem.starterCode},409);
    const judged=await until(()=>req(a,'GET',`/api/placements/${attempt.id}`),r=>r.status==='completed');assert(judged.result);
  }
  const state=await req(a,'GET','/api/placements');assert.equal(state.progress.find(p=>p.difficulty==='medium').placementsCompleted,5);
  assert(state.progress.find(p=>p.difficulty==='medium').rank);
  await req(a,'POST','/api/placements',{difficulty:'medium'},409);
  await req(b,'GET',`/api/players/${me.user.handle}`);
  console.log('PASS five judged placements, resume contract, ownership, duplicate 409, public rank');
  console.log(`PASS ${checked} HTTP responses inspected for private rating and solution fields`);
}finally{await db.end();}
