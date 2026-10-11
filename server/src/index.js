import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { pool } from './db.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_this_secret';

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please log in first.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please log in again.' }); }
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = value => String(value ?? '').trim();

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'SkillSwap API' }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = String(req.body.password || '');
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, email and a password of at least 8 characters are required.' });
  const [existing] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', [name, email, hash]);
  const user = { id: result.insertId, name, email };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '2d' });
  res.status(201).json({ token, user });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = clean(req.body.email).toLowerCase(), password = String(req.body.password || '');
  const [rows] = await pool.query('SELECT id,name,email,password_hash FROM users WHERE email=?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
  const { id, name } = rows[0]; const user = { id, name, email };
  res.json({ token: jwt.sign(user, JWT_SECRET, { expiresIn: '2d' }), user });
}));
app.get('/api/me', auth, asyncRoute(async (req,res) => {
  const [[user]] = await pool.query('SELECT id,name,email,department,year_level,bio,availability,credits,created_at FROM users WHERE id=?', [req.user.id]);
  if (!user) return res.status(404).json({error:'User not found.'});
  const [skills] = await pool.query('SELECT skill_name,skill_type FROM skills WHERE user_id=? ORDER BY skill_name', [req.user.id]);
  const [[rating]] = await pool.query('SELECT ROUND(AVG(r.rating),1) average, COUNT(*) count FROM reviews r WHERE r.reviewee_id=?', [req.user.id]);
  res.json({ ...user, skills, rating: rating.average || null, reviewCount: rating.count });
}));
app.put('/api/me', auth, asyncRoute(async (req,res) => {
  const { name, department, year_level, bio, availability } = req.body;
  if (!clean(name)) return res.status(400).json({error:'Name is required.'});
  await pool.query('UPDATE users SET name=?,department=?,year_level=?,bio=?,availability=? WHERE id=?', [clean(name),clean(department),clean(year_level),clean(bio),clean(availability),req.user.id]);
  res.json({ok:true});
}));
app.put('/api/me/skills', auth, asyncRoute(async (req,res) => {
  const normalize = arr => [...new Set((Array.isArray(arr)?arr:[]).map(clean).filter(Boolean).map(x=>x.slice(0,80)))];
  const teach = normalize(req.body.teach), learn = normalize(req.body.learn);
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); await conn.query('DELETE FROM skills WHERE user_id=?',[req.user.id]);
    for (const s of teach) await conn.query('INSERT INTO skills(user_id,skill_name,skill_type) VALUES(?,?,\'teach\')',[req.user.id,s]);
    for (const s of learn) await conn.query('INSERT INTO skills(user_id,skill_name,skill_type) VALUES(?,?,\'learn\')',[req.user.id,s]);
    await conn.commit(); res.json({ok:true});
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
app.get('/api/students', auth, asyncRoute(async (req,res) => {
  const [users] = await pool.query('SELECT id,name,department,year_level,bio,availability,credits FROM users WHERE id<>? ORDER BY name',[req.user.id]);
  const [skills] = await pool.query('SELECT user_id,skill_name,skill_type FROM skills');
  const [ratings] = await pool.query('SELECT reviewee_id,ROUND(AVG(rating),1) rating,COUNT(*) review_count FROM reviews GROUP BY reviewee_id');
  const meSkills = skills.filter(s=>s.user_id===req.user.id);
  const myTeach = meSkills.filter(s=>s.skill_type==='teach').map(s=>s.skill_name.toLowerCase());
  const myLearn = meSkills.filter(s=>s.skill_type==='learn').map(s=>s.skill_name.toLowerCase());
  const normalized = s => s.trim().toLowerCase();
  const students = users.map(u=>{
    const theirs=skills.filter(s=>s.user_id===u.id), teach=theirs.filter(s=>s.skill_type==='teach').map(s=>s.skill_name), learn=theirs.filter(s=>s.skill_type==='learn').map(s=>s.skill_name);
    const teachesMe=teach.filter(s=>myLearn.includes(normalized(s)));
    const learnsFromMe=learn.filter(s=>myTeach.includes(normalized(s)));
    const overlap=teachesMe.length+learnsFromMe.length;
    const rating=ratings.find(r=>r.reviewee_id===u.id);
    const score=Math.min(100, overlap*35+(u.availability && u.availability===req.query.availability?15:0)+(rating?.rating?Number(rating.rating)*2:0));
    return {...u,teach,learn,teachesMe,learnsFromMe,matchScore:score,matchReason:overlap?`${teachesMe.length?`They teach ${teachesMe.join(', ')}. `:''}${learnsFromMe.length?`They want to learn ${learnsFromMe.join(', ')}.`:''}`:'Explore their skills and start a conversation.',rating:rating?.rating||null,reviewCount:rating?.review_count||0};
  });
  const q=normalized(req.query.q||'');
  res.json(students.filter(s=>!q||[s.name,s.department,...s.teach,...s.learn].some(x=>normalized(x||'').includes(q))).sort((a,b)=>b.matchScore-a.matchScore));
}));
app.post('/api/requests', auth, asyncRoute(async (req,res) => {
  const receiver=Number(req.body.receiverId), offered=clean(req.body.offeredSkill), requested=clean(req.body.requestedSkill);
  if (!receiver||receiver===req.user.id||!offered||!requested) return res.status(400).json({error:'Choose a student and both exchange skills.'});
  const [[target]] = await pool.query('SELECT id FROM users WHERE id=?',[receiver]); if(!target) return res.status(404).json({error:'Student not found.'});
  const [result]=await pool.query('INSERT INTO requests(sender_id,receiver_id,offered_skill,requested_skill) VALUES(?,?,?,?)',[req.user.id,receiver,offered,requested]);
  res.status(201).json({id:result.insertId,ok:true});
}));
app.get('/api/requests', auth, asyncRoute(async (req,res) => {
 const [rows]=await pool.query(`SELECT r.*, s.name sender_name, t.name receiver_name FROM requests r JOIN users s ON s.id=r.sender_id JOIN users t ON t.id=r.receiver_id WHERE r.sender_id=? OR r.receiver_id=? ORDER BY r.created_at DESC`,[req.user.id,req.user.id]); res.json(rows);
}));
app.patch('/api/requests/:id', auth, asyncRoute(async (req,res) => {
 const status=clean(req.body.status); if(!['accepted','declined','cancelled'].includes(status)) return res.status(400).json({error:'Invalid request status.'});
 const [[r]]=await pool.query('SELECT * FROM requests WHERE id=?',[req.params.id]); if(!r) return res.status(404).json({error:'Request not found.'});
 if((status==='accepted'||status==='declined')&&r.receiver_id!==req.user.id) return res.status(403).json({error:'Only the receiving student can respond.'});
 if(status==='cancelled'&&r.sender_id!==req.user.id) return res.status(403).json({error:'Only the sender can cancel.'});
 if(r.status!=='pending') return res.status(409).json({error:'This request has already been handled.'});
 const conn=await pool.getConnection(); try {await conn.beginTransaction(); await conn.query('UPDATE requests SET status=? WHERE id=?',[status,r.id]); if(status==='accepted') await conn.query('INSERT INTO sessions(request_id) VALUES(?)',[r.id]); await conn.commit(); res.json({ok:true});}catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
app.get('/api/sessions', auth, asyncRoute(async (req,res) => {
 const [rows]=await pool.query(`SELECT s.*,r.sender_id,r.receiver_id,r.offered_skill,r.requested_skill,a.name sender_name,b.name receiver_name FROM sessions s JOIN requests r ON r.id=s.request_id JOIN users a ON a.id=r.sender_id JOIN users b ON b.id=r.receiver_id WHERE r.sender_id=? OR r.receiver_id=? ORDER BY s.id DESC`,[req.user.id,req.user.id]); res.json(rows);
}));
app.patch('/api/sessions/:id', auth, asyncRoute(async (req,res) => {
 const status=clean(req.body.status), scheduledAt=req.body.scheduledAt||null;
 if(!['upcoming','completed','cancelled'].includes(status)) return res.status(400).json({error:'Invalid session status.'});
 const conn=await pool.getConnection(); try {await conn.beginTransaction();
 const [[s]]=await conn.query('SELECT s.*,r.sender_id,r.receiver_id FROM sessions s JOIN requests r ON r.id=s.request_id WHERE s.id=? FOR UPDATE',[req.params.id]);
 if(!s){await conn.rollback();return res.status(404).json({error:'Session not found.'});}
 if(![s.sender_id,s.receiver_id].includes(req.user.id)){await conn.rollback();return res.status(403).json({error:'Not allowed.'});}
 if(s.status==='completed'&&status!=='completed'){await conn.rollback();return res.status(409).json({error:'Completed sessions cannot be changed.'});}
 if(status==='completed'&&s.status!=='completed'){
   const [[a]]=await conn.query('SELECT credits FROM users WHERE id=? FOR UPDATE',[s.sender_id]); const [[b]]=await conn.query('SELECT credits FROM users WHERE id=? FOR UPDATE',[s.receiver_id]);
   if(b.credits<1){await conn.rollback();return res.status(400).json({error:'The learner needs at least 1 credit to complete this session.'});}
   await conn.query('UPDATE users SET credits=credits+1 WHERE id=?',[s.sender_id]); await conn.query('UPDATE users SET credits=credits-1 WHERE id=?',[s.receiver_id]);
   await conn.query('INSERT INTO credit_transactions(user_id,session_id,amount,description) VALUES(?,?,?,?)',[s.sender_id,s.id,1,'Earned for teaching a session']);
   await conn.query('INSERT INTO credit_transactions(user_id,session_id,amount,description) VALUES(?,?,?,?)',[s.receiver_id,s.id,-1,'Spent on a learning session']);
 }
 await conn.query('UPDATE sessions SET status=?,scheduled_at=COALESCE(?,scheduled_at),completed_at=IF(?=\'completed\',CURRENT_TIMESTAMP,completed_at) WHERE id=?',[status,scheduledAt,status,s.id]); await conn.commit(); res.json({ok:true});
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
app.get('/api/credits', auth, asyncRoute(async (req,res)=>{const [rows]=await pool.query('SELECT * FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC',[req.user.id]);res.json(rows);}));
app.post('/api/reviews', auth, asyncRoute(async (req,res)=>{
 const sessionId=Number(req.body.sessionId), rating=Number(req.body.rating), comment=clean(req.body.comment);
 if(!sessionId||!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Choose a session and a rating from 1 to 5.'});
 const [[s]]=await pool.query('SELECT s.status,r.sender_id,r.receiver_id FROM sessions s JOIN requests r ON r.id=s.request_id WHERE s.id=?',[sessionId]);
 if(!s||s.status!=='completed')return res.status(400).json({error:'Only completed sessions can be reviewed.'});
 if(![s.sender_id,s.receiver_id].includes(req.user.id))return res.status(403).json({error:'Not allowed.'});
 const reviewee=req.user.id===s.sender_id?s.receiver_id:s.sender_id;
 await pool.query('INSERT INTO reviews(session_id,reviewer_id,reviewee_id,rating,comment) VALUES(?,?,?,?,?)',[sessionId,req.user.id,reviewee,rating,comment]);res.status(201).json({ok:true});
}));
app.get('/api/reviews', auth, asyncRoute(async(req,res)=>{const [rows]=await pool.query('SELECT r.*,u.name reviewer_name FROM reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.reviewee_id=? ORDER BY r.created_at DESC',[req.user.id]);res.json(rows);}));
app.use((err,req,res,next)=>{console.error(err); if(err.code==='ER_DUP_ENTRY')return res.status(409).json({error:'That item already exists.'});res.status(500).json({error:'Server error. Check the API terminal and database configuration.'});});
app.listen(PORT,()=>console.log(`SkillSwap API listening on port ${PORT}`));
