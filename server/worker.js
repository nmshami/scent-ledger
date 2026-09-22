import records from '../web/assets/records.json';
const FRAGRANCE_IDS=new Set(records.map(r=>r.id));
const ORIGIN='https://scent-ledger-pilot.nmshami.chatgpt.site';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max;
function isAdmin(env,user){return (env.ADMIN_IDS||'').split(',').map(id=>id.trim()).filter(Boolean).includes(user);}
async function api(request,env,path){
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return json({error:'Sign in to submit or view your reviews.'},401);
  if(!env.DB)return json({error:'Review storage is temporarily unavailable. Please keep your draft and retry.'},503);
  if(request.method!=='GET'&&request.headers.get('Origin')!==ORIGIN)return json({error:'This request must come from The Scent Ledger.'},403);
  const db=env.DB;
  if(path==='/api/my-reviews'&&request.method==='GET'){
    const result=await db.prepare('SELECT id, fragrance_id, author, rating, experience, disclosure, body, status, created_at FROM reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user).all();
    return json({reviews:result.results});
  }
  if(path==='/api/reviews'&&request.method==='POST'){
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use JSON for this request.'},415);
    if(Number(request.headers.get('Content-Length'))>16000)return json({error:'Review is too long.'},413);
    const reader=request.body?.getReader();if(!reader)return json({error:'Review is missing.'},400);
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return json({error:'Review is too long.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Review format is invalid.'},400);}
    if(!body||!uuid.test(body.id)||!FRAGRANCE_IDS.has(body.fragranceId)||!clean(body.author,2,60)||!clean(body.body,40,4000)||!Number.isInteger(body.rating)||body.rating<1||body.rating>10||!['own','sampled','store'].includes(body.experience)||!['purchased','gifted','sponsored','other'].includes(body.disclosure)||body.consent!==true)return json({error:'Complete every required field, including 40–4,000 characters of review text and publication consent.'},400);
    const existing=await db.prepare('SELECT user_id, fragrance_id, author, rating, experience, disclosure, body FROM reviews WHERE id = ?').bind(body.id).first();
    if(existing){if(existing.user_id===user&&existing.fragrance_id===body.fragranceId&&existing.author===body.author.trim()&&existing.rating===body.rating&&existing.experience===body.experience&&existing.disclosure===body.disclosure&&existing.body===body.body.trim())return json({id:body.id,status:'pending',saved:true});return json({error:'This request identifier is already used. Open a new review draft.'},409);}
    const now=new Date().toISOString(),day=now.slice(0,10);
    const result=await db.prepare("INSERT INTO reviews (id,user_id,fragrance_id,author,rating,experience,disclosure,body,status,consent,created_at) SELECT ?,?,?,?,?,?,?,?,'pending',1,? WHERE (SELECT count(*) FROM reviews WHERE user_id = ? AND created_at >= ?) < 10").bind(body.id,user,body.fragranceId,body.author.trim(),body.rating,body.experience,body.disclosure,body.body.trim(),now,user,day).run();
    if(result.meta.changes!==1)return json({error:'Daily submission limit reached. Please try again tomorrow.'},429);
    return json({id:body.id,status:'pending',saved:true},201);
  }
  if(path.startsWith('/api/reviews/')&&request.method==='DELETE'){
    const id=path.slice('/api/reviews/'.length);if(!uuid.test(id))return json({error:'Invalid submission.'},400);
    const result=await db.prepare("DELETE FROM reviews WHERE id = ? AND user_id = ? AND status = 'pending'").bind(id,user).run();
    return result.meta.changes===1?json({withdrawn:true}):json({error:'Pending submission not found.'},404);
  }
  if(path.startsWith('/api/admin/')){
    if(!isAdmin(env,user))return json({error:'Not authorized.'},403);
    if(path==='/api/admin/reviews'&&request.method==='GET'){
      const status=new URL(request.url).searchParams.get('status')||'pending';
      if(!['pending','approved','rejected'].includes(status))return json({error:'Invalid status filter.'},400);
      const result=await db.prepare('SELECT id, user_id, fragrance_id, author, rating, experience, disclosure, body, status, created_at, moderated_by, moderated_at, moderation_note FROM reviews WHERE status = ? ORDER BY created_at ASC LIMIT 100').bind(status).all();
      return json({reviews:result.results});
    }
    const match=path.match(/^\/api\/admin\/reviews\/([^/]+)\/(approve|reject)$/);
    if(match&&request.method==='POST'){
      const [,id,action]=match;
      if(!uuid.test(id))return json({error:'Invalid submission.'},400);
      let note=null;
      if(action==='reject'){
        let body;try{body=await request.json();}catch{body={};}
        if(!clean(body?.note,3,500))return json({error:'A rejection note of 3–500 characters is required.'},400);
        note=body.note.trim();
      }
      const status=action==='approve'?'approved':'rejected';
      const now=new Date().toISOString();
      const result=await db.prepare("UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = ?, moderation_note = ? WHERE id = ? AND status = 'pending'").bind(status,user,now,note,id).run();
      return result.meta.changes===1?json({id,status}):json({error:'Pending submission not found.'},404);
    }
    return json({error:'Not found.'},404);
  }
  return json({error:'Not found.'},404);
}
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){try{return await api(request,env,path);}catch(error){console.error('Review storage failure',error?.name);return json({error:'Your request could not be confirmed. Your draft is preserved; please retry.'},503);}}
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const response=await env.ASSETS.fetch(request);
  const headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  return new Response(response.body,{status:response.status,headers});
}};
