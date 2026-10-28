const {SCRIPT,seal,access,fail}=require('./_shared');
module.exports=async(req,res)=>{if(req.method!=='POST')return res.status(405).end();try{
 const {pilotToken,name,size,type}=req.body||{};
 if(!/^[0-9a-f-]{36}$/i.test(pilotToken||''))throw Error('Login pilota richiesto');
 if(!Number.isSafeInteger(size)||size<1||size>200*1024*1024*1024)throw Error('Dimensione video non valida');
 if(typeof name!=='string'||name.length>180||!name.trim())throw Error('Nome file non valido');
 if(!/^video\//.test(type||''))throw Error('Seleziona un video');
 const auth=await fetch(SCRIPT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'upload_auth',pilotToken})});
 const a=await auth.json();if(!a.success||!a.pilota)throw Error(a.message||'Sessione pilota non valida');
 const token=await access();const folder=process.env.GOOGLE_DRIVE_FOLDER_ID;if(!folder)throw Error('GOOGLE_DRIVE_FOLDER_ID mancante');
 const safe=name.replace(/[\\/\x00-\x1f]/g,'_');
 const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,parents,webViewLink',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(size)},body:JSON.stringify({name:Date.now()+'_'+safe,mimeType:type,parents:[folder]})});
 if(!r.ok)throw Error('Google Drive: '+r.status+' '+(await r.text()).slice(0,250));
 const location=r.headers.get('location');if(!location||!location.startsWith('https://www.googleapis.com/'))throw Error('Sessione Google Drive non disponibile');
 res.json({ok:true,token:seal({location,pilota:a.pilota,size,exp:Date.now()+5*60*60*1000})});
 }catch(e){fail(res,e)}};
