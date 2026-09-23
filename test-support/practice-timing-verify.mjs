// Run only against the isolated preview on 3011 (verification DB on 55432).
import assert from 'node:assert/strict';
const base='http://localhost:3011';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function login(handle){
  const jar=new Map();
  const save=r=>r.headers.getSetCookie().forEach(s=>{const pair=s.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));});
  const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
  let r=await fetch(base+'/api/auth/csrf');save(r);const {csrfToken}=await r.json();
  r=await fetch(base+'/api/auth/callback/dev',{method:'POST',headers:{cookie:cookie(),origin:base,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,handle,json:'true'})});save(r);
  assert(jar.has('next-auth.session-token'));return cookie();
}
async function req(cookie,method,path,body,status=200){
  const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await r.text();assert([status].flat().includes(r.status),`${method} ${path}: ${r.status} ${text}`);
  return text?JSON.parse(text):null;
}
async function judge(cookie,run){
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){const state=await req(cookie,'GET',`/api/practice/runs/${run.id}`);if(!['queued','running'].includes(state.verdict))return state;await delay(1000);}
  throw new Error('Judge timed out');
}
const suffix=Date.now().toString(36),a=await login(`timea${suffix}`),b=await login(`timeb${suffix}`);
const {problems}=await req('','GET','/api/problems');
const problem=problems.find(p=>p.slug==='digit-sum');
const other=problems.find(p=>p.slug==='word-count');
const path=`/api/practice/sessions?problemId=${problem.id}`;
await req('','GET',path,undefined,401);
await req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:'yes'},422);
const starts=await Promise.all(Array.from({length:4},()=>req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:true},[200,201])));
const session=starts[0];assert(starts.every(s=>s.id===session.id));
await delay(1200);
const resumed=await req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:false});
assert.equal(resumed.id,session.id);assert.equal(resumed.startedAt,session.startedAt);assert.equal(resumed.timed,true);assert(resumed.elapsedSeconds>=1);
assert.equal((await req(b,'GET',path)).session,null);
await req(b,'PATCH','/api/practice/sessions',{sessionId:session.id},404);
await req(a,'POST','/api/practice/sessions',{problemId:other.id,timed:true},409);
const activeOtherView=await req(a,'GET',`/api/practice/sessions?problemId=${other.id}`);
assert.equal(activeOtherView.activeTimed.id,session.id);
for(const untimedProblem of problems.filter(p=>!['digit-sum','word-count'].includes(p.slug)).slice(0,2)){
  assert.equal((await req(a,'POST','/api/practice/sessions',{problemId:untimedProblem.id,timed:false},201)).timed,false);
}
await req(b,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode:'pass',sessionId:session.id},409);
const failed=await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode:'def digit_sum(number):\n    return -1',sessionId:session.id},202);
assert.equal((await judge(a,failed)).verdict,'wrong_answer');
assert.equal((await req(a,'GET',path)).session.completedAt,null);
const sourceCode='def digit_sum(number):\n    return sum(map(int, str(number)))';
const run=await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode,sessionId:session.id},202);
assert.equal((await judge(a,run)).verdict,'accepted');
const completed=await req(a,'GET',path);assert(completed.session.completedAt);assert.equal(completed.stats.timedSolves,1);
const seconds=completed.session.elapsedSeconds;await delay(1200);assert.equal((await req(a,'GET',path)).session.elapsedSeconds,seconds);
await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode,sessionId:session.id},409);
const untimed=await req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:false},201);
assert.notEqual(untimed.id,session.id);assert.equal(untimed.timed,false);
const untimedRun=await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode,sessionId:untimed.id},202);
assert.equal((await judge(a,untimedRun)).verdict,'accepted');
assert.equal((await req(a,'GET',path)).stats.timedSolves,1);
const repeat=await req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:true},201);
const repeatRun=await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode,sessionId:repeat.id},202);
assert.equal((await judge(a,repeatRun)).verdict,'accepted');
const stats=await req(a,'GET',path);assert.equal(stats.stats.timedSolves,2);
assert.equal(stats.stats.recent[0].firstSolve,false);assert.equal(stats.stats.recent[1].firstSolve,true);
assert(stats.comparisons.some(row=>row.difficulty==='easy'&&row.tag===null&&row.firstSolve&&row.count===1));
assert(stats.comparisons.some(row=>row.tag==='math'&&!row.firstSolve&&row.count===1));
const toAbandon=await req(a,'POST','/api/practice/sessions',{problemId:problem.id,timed:true},201);
const switched=await req(a,'POST','/api/practice/sessions',{problemId:other.id,timed:true,abandonSessionId:toAbandon.id},201);
assert(switched.id!==toAbandon.id);
const abandoned=await req(a,'GET',path);assert(abandoned.session.abandonedAt);assert.equal(abandoned.stats.timedSolves,2);assert.equal(abandoned.stats.abandonedAttempts,1);
await delay(1200);assert.equal((await req(a,'GET',path)).session.elapsedSeconds,abandoned.session.elapsedSeconds);
await req(a,'POST','/api/practice/runs',{problemSlug:problem.slug,sourceCode,sessionId:toAbandon.id},409);
await req(a,'PATCH','/api/practice/sessions',{sessionId:switched.id},204);
await req(a,'PATCH','/api/practice/sessions',{sessionId:switched.id},204);
assert.equal((await req(a,'GET',path)).activeTimed,null);
const competing=await Promise.all([problem,other].map(p=>req(b,'POST','/api/practice/sessions',{problemId:p.id,timed:true},[201,409])));
assert.equal(competing.filter(r=>r.id).length,1,'Cross-problem concurrent starts must leave only one timed attempt');
console.log('PASS single timed attempt across concurrent starts, unrestricted untimed practice, atomic abandon/switch, owner isolation, stopped abandoned clock, first/repeat difficulty/topic statistics, real judged completion');
