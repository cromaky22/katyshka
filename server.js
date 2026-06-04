const express = require('express');
const path = require('path');
const http = require('http');
const io = require('socket.io')(server, { cors: { origin: '*' } });

const app = express();
const server = http.createServer(app);

// In-memory database (data lost on restart, but works everywhere)
const users = {};
const promos = { '1': 200, '2': 200, '3': 200, '4': 200, '5': 200, '6': 200 };
const activated = {};

app.use(express.json());
app.use(express.static(__dirname));

function getBalance(id) { return users[id]?.balance || 100; }
function setBalance(id, amt) { if(!users[id]) users[id]={balance:100}; users[id].balance=Math.round(amt*100)/100; }
function getName(id) { return users[id]?.first_name || 'Player'; }

// API
app.post('/api/users', (req,res)=>{
  const u=req.body||{};
  if(!u.id) return res.status(400).json({error:'missing id'});
  if(!users[u.id]) users[u.id]={balance:100,first_name:u.first_name||null};
  res.json({ok:true});
});

app.get('/api/users/:id', (req,res)=>{
  const u=users[req.params.id];
  if(!u) return res.json({balance:100});
  res.json(u);
});

app.post('/api/deposit', (req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount) return res.status(400).json({error:'missing'});
  setBalance(userId, getBalance(userId)+Number(amount));
  res.json({ok:true,balance:getBalance(userId)});
});

app.post('/api/withdraw', (req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount) return res.status(400).json({error:'missing'});
  const amt=Number(amount), fee=Math.round(amt*0.03*100)/100, total=amt+fee;
  if(getBalance(userId)<total) return res.status(400).json({error:'insufficient'});
  setBalance(userId, getBalance(userId)-total);
  res.json({ok:true,received:amt,fee,balance:getBalance(userId)});
});

// Promo API
app.post('/api/promos/:code/activate', (req,res)=>{
  const code=(req.params.code||'').toUpperCase();
  const userId=req.body?.userId;
  if(!promos[code]) return res.status(404).json({error:'not found'});
  if(!activated[userId]) activated[userId]=[];
  if(activated[userId].includes(code)) return res.status(400).json({error:'already'});
  activated[userId].push(code);
  setBalance(userId, getBalance(userId)+promos[code]);
  res.json({ok:true,amount:promos[code]});
});

// === CRYPTOBOT ===
const CRYPTOBOT_TOKEN='411440:AAWUSDQWHE8fLkRQN20YRJi0DBb2skCPOdJ';
const CRYPTOBOT_API='https://pay.crypt.bot/api';

async function cryptobotReq(method, body){
  const r=await fetch(`${CRYPTOBOT_API}/${method}`,{
    method:body?'POST':'GET',
    headers:{'Content-Type':'application/json','Crypto-Pay-API-Token':CRYPTOBOT_TOKEN},
    body:body?JSON.stringify(body):undefined
  });
  return r.json();
}

app.post('/api/deposit/invoice', async(req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount||amount<0.1) return res.status(400).json({error:'min $0.1'});
  try{
    const r=await cryptobotReq('createInvoice',{asset:'USDT',amount:Number(amount).toFixed(6),description:`Deposit ${userId}`,payload:JSON.stringify({userId}),expires_in:1800});
    if(r.ok) res.json({ok:true,invoiceId:r.result.invoice_id,payUrl:r.result.bot_invoice_url});
    else res.status(500).json({error:r.error});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/deposit/check', async(req,res)=>{
  const {invoiceId}=req.body||{};
  if(!invoiceId) return res.status(400).json({error:'missing'});
  try{
    const r=await cryptobotReq('getInvoices',{invoice_ids:String(invoiceId)});
    if(r.ok&&r.result.items?.length>0){
      const inv=r.result.items[0];
      if(inv.status==='paid'){
        const payload=JSON.parse(inv.payload||'{}');
        setBalance(payload.userId, getBalance(payload.userId)+parseFloat(inv.amount));
      }
      res.json({ok:true,status:inv.status});
    }else res.json({ok:true,status:'not_found'});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/cryptobot-webhook', express.raw({type:'application/json'}), (req,res)=>{
  try{
    const body=JSON.parse(req.body.toString());
    if(body.update_type==='invoice_paid'){
      const payload=JSON.parse(body.payload.payload||'{}');
      if(payload.userId){
        setBalance(payload.userId, getBalance(payload.userId)+parseFloat(body.payload.amount));
        io.emit('balance_update',{userId:payload.userId,amount:parseFloat(body.payload.amount)});
      }
    }
  }catch(e){}
  res.json({ok:true});
});

app.post('/api/withdraw/cryptobot', async(req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount||amount<1) return res.status(400).json({error:'min $1'});
  const amt=Math.round(Number(amount)*100)/100, fee=Math.round(amt*0.03*100)/100, total=amt+fee;
  if(getBalance(userId)<total) return res.status(400).json({error:'insufficient'});
  try{
    const spendId='wd_'+Date.now()+'_'+Math.random().toString(36).substr(2,9);
    const r=await cryptobotReq('transfer',{user_id:parseInt(userId)||0,asset:'USDT',amount:amt.toFixed(6),spend_id:spendId,comment:'Katyshka withdraw'});
    if(r.ok){setBalance(userId,getBalance(userId)-total);res.json({ok:true,received:amt,fee,balance:getBalance(userId)});}
    else res.status(500).json({error:r.error});
  }catch(e){res.status(500).json({error:e.message);}
});

// === XROCKET ===
const XROCKET_API_KEY='f391f7a440adb0cfb0f7a1afe';
const XROCKET_API='https://pay.xrocket.tg/api';

async function xrocketReq(method,body){
  const r=await fetch(`${XROCKET_API}/${method}`,{
    method:body?'POST':'GET',
    headers:{'Content-Type':'application/json','X-API-Key':XROCKET_API_KEY},
    body:body?JSON.stringify(body):undefined
  });
  return r.json();
}

app.post('/api/deposit/xrocket', async(req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount||amount<0.1) return res.status(400).json({error:'min $0.1'});
  try{
    const r=await xrocketReq('invoice',{amount:Number(amount).toFixed(6),currency:'TONCOIN',description:`Deposit ${userId}`,payload:JSON.stringify({userId}),expiredIn:1800});
    if(r.data) res.json({ok:true,invoiceId:r.data.id,payUrl:r.data.payUrl});
    else res.status(500).json({error:r.error||r.message});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/withdraw/xrocket', async(req,res)=>{
  const {userId,amount}=req.body||{};
  if(!userId||!amount||amount<1) return res.status(400).json({error:'min $1'});
  const amt=Math.round(Number(amount)*100)/100, fee=Math.round(amt*0.03*100)/100, total=amt+fee;
  if(getBalance(userId)<total) return res.status(400).json({error:'insufficient'});
  try{
    const r=await xrocketReq('cheque',{amount:amt.toFixed(6),currency:'TONCOIN',description:`Withdraw ${userId}`,usersNumber:1,chequePerUser:amt.toFixed(6)});
    if(r.data){setBalance(userId,getBalance(userId)-total);res.json({ok:true,received:amt,fee,balance:getBalance(userId)});}
    else res.status(500).json({error:r.error||r.message});
  }catch(e){res.status(500).json({error:e.message});}
});

// === WHEEL GAME ===
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function isRed(n){return RED.indexOf(n)!==-1;}
function betWin(type,num){
  if(type==='0')return num===0;
  if(type==='red')return isRed(num);
  if(type==='black')return num>0&&!isRed(num);
  if(type==='odd')return num>0&&num%2===0;
  if(type==='notodd')return num>0&&num%2===1;
  if(type==='range1')return num>=1&&num<=18;
  if(type==='range2')return num>=19&&num<=36;
  if(type==='range3')return num>=1&&num<=12;
  if(type==='range4')return num>=13&&num<=24;
  if(type==='range5')return num>=25&&num<=36;
  if(!isNaN(Number(type)))return num===Number(type);
  return false;
}
function betCoef(type){
  if(type==='0'||!isNaN(Number(type)))return 36;
  if(type==='range3'||type==='range4'||type==='range5')return 3;
  return 2;
}

let wheel={phase:'betting',timer:20,roundId:0,result:null,bets:{},history:[]};
let wheelIv=null;

function startWheel(){
  if(wheelIv)clearInterval(wheelIv);
  wheel.timer=20;wheel.phase='betting';
  io.emit('wheel:timer',{timer:20,phase:'betting'});
  wheelIv=setInterval(()=>{
    wheel.timer--;
    io.emit('wheel:timer',{timer:wheel.timer,phase:wheel.phase});
    if(wheel.timer<=0){clearInterval(wheelIv);spinWheel();}
  },1000);
}

function spinWheel(){
  wheel.phase='spinning';
  const idx=Math.floor(Math.random()*WHEEL.length);
  const num=WHEEL[idx];
  const color=num===0?'green':isRed(num)?'red':'black';
  const allBets=[];
  for(const uid in wheel.bets){wheel.bets[uid].forEach(b=>allBets.push({userId:uid,type:b.type,amount:b.amount,playerName:b.playerName||'Player'}));}
  const results={};
  for(const uid in wheel.bets){
    let win=0;
    wheel.bets[uid].forEach(b=>{if(betWin(b.type,num))win+=b.amount*betCoef(b.type);});
    win=Math.round(win*100)/100;
    results[uid]=win;
    if(win>0)setBalance(uid,getBalance(uid)+win);
  }
  wheel.result={num,color,index:idx};
  wheel.history.unshift({num,color});
  if(wheel.history.length>20)wheel.history.pop();
  io.emit('wheel:spin',{result:wheel.result,allBets,results,history:wheel.history});
  setTimeout(()=>{wheel.bets={};wheel.result=null;wheel.roundId++;startWheel();io.emit('wheel:newRound',{roundId:wheel.roundId,history:wheel.history});},7000);
}

io.on('connection',(socket)=>{
  const userId=socket.handshake.query.userId||'0';
  socket.emit('wheel:state',{phase:wheel.phase,timer:wheel.timer,myBets:wheel.bets[userId]||[]});
  socket.on('wheel:bet',(data)=>{
    if(wheel.phase!=='betting')return;
    const {type,amount,playerName}=data;
    if(!type||!amount||amount<=0)return;
    const total=(wheel.bets[userId]||[]).reduce((s,b)=>s+b.amount,0);
    if(total+amount>getBalance(userId))return;
    if(!wheel.bets[userId])wheel.bets[userId]=[];
    wheel.bets[userId].push({type,amount,playerName:playerName||'Player'});
    setBalance(userId,getBalance(userId)-amount);
    const allBets=[];
    for(const uid in wheel.bets){wheel.bets[uid].forEach(b=>allBets.push({userId:uid,type:b.type,amount:b.amount,playerName:b.playerName}));}
    io.emit('wheel:betsUpdate',{allBets,myBets:wheel.bets[userId]||[]});
  });
});

startWheel();

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Server on ${PORT}`));
