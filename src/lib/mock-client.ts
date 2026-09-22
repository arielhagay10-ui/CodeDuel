import type { ClientExtras } from "@/lib/api-client";
import type { Difficulty, PracticeRun } from "@/types/api";
import type { PlacementAttempt } from "@/lib/client-contracts";
import { mockProblems } from "@/lib/mock-problems";
import { ApiRequestError } from "@/lib/api-error";

type State = { progress: Record<Difficulty, number>; attempts: Record<string, PlacementAttempt>; runs: Record<string, PracticeRun> };
function load(): State {
  try { const value = sessionStorage.getItem("codeduel.mock-client"); if (value) return JSON.parse(value); } catch { /* fresh preview */ }
  return { progress: { easy: 0, medium: 0, advanced: 0 }, attempts: {}, runs: {} };
}
function save(state: State) { try { sessionStorage.setItem("codeduel.mock-client", JSON.stringify(state)); } catch { /* preview storage unavailable */ } }
const now = () => new Date(Date.now() + 40_000).toISOString();
export const mockClient: ClientExtras = {
  async claimHandle() {},
  async acceptFairPlay() {},
  async getMe() { return { user: { id: "mock-player", handle: "PreviewPlayer", rankedAccess: true, banned: false } }; },
  async getProblems() { return { problems: mockProblems }; },
  async getProfile(handle) { return { handle, ranks: (await mockClient.getRatings()).ratings.map(r => ({difficulty:r.difficulty,rank:r.rank})), recentMatches: [] }; },
  async getRatings() { return { ratings: (Object.entries(load().progress) as [Difficulty,number][]).map(([difficulty,n]) => ({ difficulty, placementsCompleted:n, rank:n===5?{tier:"Silver",division:"II"}:null })) }; },
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
  async runPractice() {const s=load(),id=crypto.randomUUID();s.runs[id]={id,verdict:"accepted",testsPassed:2,testsTotal:2};save(s);return {...s.runs[id],verdict:"queued"};},
  async getPractice(id) {const run=load().runs[id];if(!run)throw new ApiRequestError(404,"Run not found.");return run;},
  async presence(_id,connected) {return {connected};},
  async report() {},
};
