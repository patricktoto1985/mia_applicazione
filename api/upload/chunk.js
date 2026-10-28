const {unseal,seal,fail}=require('./_shared');
module.exports=async(req,res)=>{if(req.method!=='POST')return res.status(405).end();try{
 const s=unseal(req.headers['x-grcc-upload-token']);const start=Number(req.headers['x-grcc-start']),total=Number(req.headers['x-grcc-total']);
 const chunks=[];for await(const b of req)chunks.push(b);const buf=Buffer.concat(chunks);
 if(!Number.isSafeInteger(start)||start<0||total!==s.size||buf.length<1||buf.length>1024*1024||start+buf.length>total)throw Error('Blocco non valido');
 if(start%262144!==0||(start+buf.length!==total&&buf.length%262144!==0))throw Error('Allineamento blocco errato');
 const r=await fetch(s.location,{method:'PUT',headers:{'Content-Length':String(buf.length),'Content-Range':`bytes ${start}-${start+buf.length-1}/${total}`},body:buf});
 if(r.status===308)return res.json({ok:true,done:false});
 if(!r.ok)throw Error('Drive upload HTTP '+r.status+' '+(await r.text()).slice(0,200));
 const j=await r.json();if(!j.id)throw Error('Drive non ha confermato il file');
 res.json({ok:true,done:true,receipt:seal({id:j.id,pilota:s.pilota,exp:Date.now()+12*60*60*1000})});
 }catch(e){fail(res,e)}};
