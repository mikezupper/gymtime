import { expect,request } from "@playwright/test";
export const origin = "http://127.0.0.1:3817";
export async function capturedCode(email: string) {
  const client = await request.newContext();
  let code = "";
  await expect.poll(async () => {
    const response = await client.get("http://127.0.0.1:8827/messages");
    const messages: ReadonlyArray<{ message: { to: ReadonlyArray<string>;subject: string;text: string } }> = await response.json();
    const message = messages.slice().reverse().find((item) => item.message.to.includes(email) && item.message.subject === "Your Gymtime sign-in code");
    code = message?.message.text.match(/code is (\d{6})/)?.at(1) ?? "";
    return code;
  }).toMatch(/^\d{6}$/);
  await client.dispose();
  return code;
}
export default async function setup() {
  const client = await request.newContext({ baseURL: origin,extraHTTPHeaders: { Origin: origin } });
  expect((await client.post("/api/v1/auth/request-code",{ data: { email: "organizer@example.test" } })).status()).toBe(200);
  const code = await capturedCode("organizer@example.test");
  const response = await client.post("/api/v1/auth/verify-code",{ data: { email: "organizer@example.test",code } });
  expect(response.status()).toBe(200);
  const session = await response.json();
  const headers = { "X-CSRF-Token": session.csrf_token, "Idempotency-Key": "1".repeat(64) };
  expect((await client.post("/api/v1/schedule/actions", {headers, data: {operation:"configure_gym",name:"School Gym",timezone:"America/New_York",split:true,version:1,hours:[0,1,2,3,4,5,6].map((weekday)=>({weekday,start:"08:00",end:"22:00"}))}})).status()).toBe(200);
  const season = await client.post("/api/v1/schedule/actions", {headers:{...headers,"Idempotency-Key":"2".repeat(64)},data:{operation:"create_season",name:"E2E basketball",start_date:"2027-01-01",end_date:"2027-12-31"}});
  expect(season.status()).toBe(200);
  const id=(await season.json()).resources[0].id;
  expect((await client.post("/api/v1/schedule/actions",{headers:{...headers,"Idempotency-Key":"3".repeat(64)},data:{operation:"set_season_status",id,status:"active",version:1}})).status()).toBe(200);
  await client.storageState({ path: ".local/e2e-auth.json" });
  await client.dispose();
}
