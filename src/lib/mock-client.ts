import type { ClientExtras } from "@/lib/api-client";
import type { Difficulty, PracticeRun } from "@/types/api";
import type { PlacementAttempt, PracticeSession, PracticeSessionState } from "@/lib/client-contracts";
import { mockProblems } from "@/lib/mock-problems";
import { CATALOG_PAGE_SIZE, parseCatalogSearch, toCatalogItem } from "@/lib/problem-catalog";
import { ApiRequestError } from "@/lib/api-error";

type State = { progress: Record<Difficulty, number>; attempts: Record<string, PlacementAttempt>; runs: Record<string, PracticeRun>; sessions?: (PracticeSession & { problemId: string })[] };
function load(): State {
  try { const value = sessionStorage.getItem("codeduel.mock-client"); if (value) return JSON.parse(value); } catch { /* fresh preview */ }
  return { progress: { easy: 0, medium: 0, advanced: 0 }, attempts: {}, runs: {} };
}
function save(state: State) { try { sessionStorage.setItem("codeduel.mock-client", JSON.stringify(state)); } catch { /* preview storage unavailable */ } }
const now = () => new Date(Date.now() + 40_000).toISOString();
const mockTags: Record<string,string[]> = { "pair-indices":["arrays","hash-maps"], "balanced-brackets":["strings","stacks"], "merge-intervals":["arrays","intervals","sorting"] };
export const mockClient: ClientExtras = {
  async claimHandle() {},
  async acceptFairPlay() {},
  async getMe() { return { user: { id: "mock-player", handle: "PreviewPlayer", rankedAccess: true, banned: false } }; },
  async getProblems() { return { problems: mockProblems }; },
  async getProblemCatalog(search, difficulty, page) {
    const { text, tags } = parseCatalogSearch(search);
    const term = text.toLowerCase();
    const matches = mockProblems.filter(problem => (difficulty === "all" || problem.difficulty === difficulty)
      && tags.every(tag=>(mockTags[problem.slug]??[]).includes(tag))
      && `${problem.title} ${problem.slug} ${problem.entrypoint??""} ${problem.statementMarkdown} ${(mockTags[problem.slug]??[]).join(" ")}`.toLowerCase().includes(term));
    return { problems: matches.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE).map(problem=>toCatalogItem(problem,mockTags[problem.slug]??[])),
      total: matches.length, page, pageSize: CATALOG_PAGE_SIZE, availableTags:[...new Set(Object.values(mockTags).flat())].sort() };
  },
  async getProblem(id) {
    const problem = mockProblems.find(item => item.id === id);
    if (!problem) throw new ApiRequestError(404, "Problem not found.");
    return problem;
  },
  async getProfile(handle) { return { handle, ranks: (await mockClient.getRatings()).ratings.map(r => ({difficulty:r.difficulty,placementsCompleted:r.placementsCompleted,rank:r.rank})), recentMatches: [] }; },
  async getRatings() { return { ratings: (Object.entries(load().progress) as [Difficulty,number][]).map(([difficulty,n]) => ({ difficulty, placementsCompleted:n, rank:n===5?{tier:"Silver",division:"II"}:null, rankProgressPoints:n===5?0:null })) }; },
  async getPlacements() {
    const s=load(), active=Object.values(s.attempts).find(a=>a.status==="active");
    return { attempt:active?{id:active.id,difficulty:active.difficulty,placementNumber:active.placementNumber,problemId:active.problem.id,endsAt:active.endsAt}:null,
      progress:(await mockClient.getRatings()).ratings.map(r=>({...r,placementsTotal:5})) };
  },
  async startPlacement(difficulty) {
    const s=load(); const existing=Object.values(s.attempts).find(a=>a.status==="active"&&a.difficulty===difficulty);
    if(existing)return {attempt:{id:existing.id}};
    if(s.progress[difficulty]>=5)throw new ApiRequestError(409,"Placements are already complete.");
    const id=crypto.randomUUID();
    s.attempts[id]={id,difficulty,placementNumber:s.progress[difficulty]+1,status:"active",endsAt:new Date(Date.now()+130_000).toISOString(),serverTime:now(),problem:{...mockProblems[s.progress[difficulty]%mockProblems.length],difficulty},submitted:false,result:null};
    save(s);return {attempt:{id}};
  },
  async getPlacement(id) {
    const s=load(),a=s.attempts[id];if(!a)throw new ApiRequestError(404,"Placement not found.");
    if(a.status==="active"&&(a.submitted||Date.parse(a.endsAt)<=Date.now()+40_000)) {a.status="completed";a.submitted=true;a.result={testsPassed:2,testsTotal:2};s.progress[a.difficulty]=Math.min(5,s.progress[a.difficulty]+1);save(s);}
    return {...a,serverTime:now()};
  },
  async submitPlacement(id) {const s=load(),a=s.attempts[id];if(!a)throw new ApiRequestError(404,"Placement not found.");if(a.submitted)throw new ApiRequestError(409,"Already locked.");a.submitted=true;save(s);return {submissionId:crypto.randomUUID(),locked:true};},
  async getPracticeSession(problemId) {
    const sessions=load().sessions??[];
    const all=sessions.filter(s=>s.problemId===problemId);
    const latest=all.at(-1);
    const recent=all.filter(s=>s.timed&&s.completedAt&&!s.abandonedAt).reverse().map(s=>({seconds:s.elapsedSeconds,completedAt:s.completedAt!,firstSolve:!all.some(previous=>previous.completedAt&&previous.startedAt<s.startedAt)}));
    const active=sessions.find(s=>s.timed&&!s.completedAt&&!s.abandonedAt);
    const groups=new Map<string,PracticeSessionState["comparisons"][number]>();
    for(const solved of sessions.filter(s=>s.timed&&s.completedAt&&!s.abandonedAt)){
      const problem=mockProblems.find(p=>p.id===solved.problemId);if(!problem)continue;
      const firstSolve=!sessions.some(s=>s.problemId===solved.problemId&&s.completedAt&&s.startedAt<solved.startedAt);
      for(const tag of [null,...(mockTags[problem.slug]??[])]){
        const key=`${problem.difficulty}:${tag}:${firstSolve}`,previous=groups.get(key);
        groups.set(key,{difficulty:problem.difficulty,tag,firstSolve,count:(previous?.count??0)+1,averageSeconds:(previous?.averageSeconds??0)+solved.elapsedSeconds});
      }
    }
    return {session:latest?{...latest,abandonedAt:latest.abandonedAt??null,elapsedSeconds:latest.completedAt||latest.abandonedAt?latest.elapsedSeconds:Math.max(0,Math.floor((Date.now()-Date.parse(latest.startedAt))/1000))}:null,
      activeTimed:active?{...active,title:mockProblems.find(p=>p.id===active.problemId)?.title??"Practice problem"}:null,
      stats:{timedSolves:recent.length,bestSeconds:recent.length?Math.min(...recent.map(s=>s.seconds)):null,abandonedAttempts:all.filter(s=>s.abandonedAt).length,recent:recent.slice(0,10)},comparisons:[...groups.values()].map(row=>({...row,averageSeconds:Math.round(row.averageSeconds/row.count)}))};
  },
  async startPracticeSession(problemId,timed,abandonSessionId) {
    const s=load();s.sessions??=[];
    if(abandonSessionId){const old=s.sessions.find(item=>item.id===abandonSessionId&&!item.completedAt&&!item.abandonedAt);if(!old)throw new ApiRequestError(409,"Attempt has ended.");old.abandonedAt=new Date().toISOString();old.elapsedSeconds=Math.max(0,Math.floor((Date.now()-Date.parse(old.startedAt))/1000));}
    if(timed&&s.sessions.some(item=>item.timed&&!item.completedAt&&!item.abandonedAt&&item.problemId!==problemId))throw new ApiRequestError(409,"Resume or abandon your current timed attempt.");
    const active=s.sessions.find(item=>item.problemId===problemId&&!item.completedAt&&!item.abandonedAt);
    if(active){save(s);return active;}
    const session={id:crypto.randomUUID(),problemId,timed,startedAt:new Date().toISOString(),completedAt:null,abandonedAt:null,elapsedSeconds:0};
    s.sessions.push(session);save(s);return session;
  },
  async abandonPracticeSession(id){const s=load(),session=s.sessions?.find(item=>item.id===id);if(!session)throw new ApiRequestError(404,"Attempt not found.");if(session.completedAt)throw new ApiRequestError(409,"Attempt complete.");session.abandonedAt??=new Date().toISOString();session.elapsedSeconds=Math.max(0,Math.floor((Date.parse(session.abandonedAt)-Date.parse(session.startedAt))/1000));save(s);},
  async runPractice(_slug,_code,sessionId) {const s=load(),id=crypto.randomUUID();
    if(sessionId){const session=s.sessions?.find(item=>item.id===sessionId);if(!session||session.completedAt||session.abandonedAt)throw new ApiRequestError(409,"Attempt unavailable.");session.completedAt=new Date().toISOString();session.elapsedSeconds=Math.max(0,Math.floor((Date.now()-Date.parse(session.startedAt))/1000));}
    s.runs[id]={id,verdict:"accepted",testsPassed:2,testsTotal:2};save(s);return {...s.runs[id],verdict:"queued"};},
  async getPractice(id) {const run=load().runs[id];if(!run)throw new ApiRequestError(404,"Run not found.");return run;},
  async presence(_id,connected) {return {connected};},
  async report() {},
};
