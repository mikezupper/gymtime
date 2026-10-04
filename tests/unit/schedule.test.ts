import { expect,it } from "vitest";
import { Effect, Either, Layer, ManagedRuntime, Schema, TestClock, TestContext } from "effect";
import { ApiFailure } from "../../apps/web/src/domain/api.js";
import { ApiClient } from "../../apps/web/src/services/api.js";
import { RetryKeys } from "../../apps/web/src/services/retry-keys.js";
import { prepareSave } from "../../apps/web/src/services/schedule.js";
import { monday, shiftDate, slotsConflict, recurringSelection, type Slot } from "../../apps/web/src/domain/schedule.js";
const snapshot={gym:{name:"Gym",timezone:"America/New_York",split:true,version:1,hours:[]},seasons:[],teams:[],slots:[],bookings:[],requests:[],closures:[],swaps:[],now:1000};
it("network retries retain the same mutation identity and a failed reload remains retryable",async()=>{
 const keys:string[]=[];let reads=0;let writes=0;let generated=0;
 const runtime=ManagedRuntime.make(Layer.mergeAll(TestContext.TestContext,Layer.succeed(RetryKeys,{create:Effect.sync(()=>{generated+=1;return "a".repeat(64);})}),Layer.succeed(ApiClient,{request:(path,schema,options)=>Effect.gen(function*(){
  if(path.endsWith("actions")){keys.push(options.key??"");writes+=1;if(writes===1)return yield* Effect.fail(new ApiFailure({code:"network",message:"offline",issues:[]}));return yield* Schema.decodeUnknown(schema)({resources:[],warnings:[]}).pipe(Effect.mapError(()=>new ApiFailure({code:"invalid_response",message:"fixture",issues:[]})));}
  reads+=1;if(reads===1)return yield* Effect.fail(new ApiFailure({code:"network",message:"offline",issues:[]}));return yield* Schema.decodeUnknown(schema)(snapshot).pipe(Effect.mapError(()=>new ApiFailure({code:"invalid_response",message:"fixture",issues:[]})));
 })})));
 const action={operation:"create_season",name:"Winter",start_date:"2027-01-01",end_date:"2027-03-01"} as const;
 const pending=runtime.runPromise(prepareSave(action,"","csrf"));await runtime.runPromise(TestClock.adjust("1 second"));const first=await pending;expect(Either.isLeft(first.result)).toBe(true);const second=await runtime.runPromise(prepareSave(action,first.key,"csrf"));expect(Either.isRight(second.result)).toBe(true);expect(generated).toBe(1);expect(keys).toEqual(["a".repeat(64),"a".repeat(64),"a".repeat(64)]);await runtime.dispose();
});
it("week navigation works across month and year boundaries",()=>{expect(monday("2027-01-01")).toBe("2026-12-28");expect(shiftDate("2027-01-31",1)).toBe("2027-02-01");});
it("calendar annotations use physical overlap, including full-gym and separate halves",()=>{
 const base:Slot={id:1,season:1,date:"2027-01-04",start:"16:00",end:"17:00",starts_at:100,ends_at:200,space:"half_a",enabled:true,available:true,version:1};
 expect(slotsConflict(base,{...base,id:2,space:"half_b"})).toBe(false);expect(slotsConflict(base,{...base,id:2,space:"full"})).toBe(true);expect(slotsConflict(base,{...base,id:2,starts_at:200,ends_at:300})).toBe(false);
});
it("recurring selection reports missing and unavailable dates and stops at the season end",()=>{
 const anchor:Slot={id:1,season:1,date:"2027-01-04",start:"16:15",end:"17:15",starts_at:100,ends_at:200,space:"half_a",enabled:true,available:true,version:1};
 const schedule={...snapshot,seasons:[{id:1,name:"Winter",start_date:"2027-01-01",end_date:"2027-01-25",status:"active" as const,version:1}],slots:[anchor,{...anchor,id:2,date:"2027-01-18",available:false},{...anchor,id:3,date:"2027-01-25"}]};
 const result=recurringSelection(schedule,anchor,"2027-02-01");
 expect(result.slots).toEqual([1,3]);
 expect(result.excluded).toEqual([{date:"2027-01-11",reason:"The organizer has not published a matching slot."},{date:"2027-01-18",reason:"This space and time are unavailable."}]);
});
