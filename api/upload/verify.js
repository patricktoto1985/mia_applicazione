const {unseal,access,fail}=require('./_shared');
module.exports=async(req,res)=>{if(req.method!=='POST')return res.status(405).end();try{
 const s=unseal(req.body?.receipt);if(!s.id||!s.pilota)throw Error('Ricevuta video non valida');
 const token=await access();const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(s.id)+'?fields=id,mimeType,parents,trashed,webViewLink',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok)throw Error('File Drive non verificabile');const f=await r.json();
 if(f.trashed||!f.mimeType?.startsWith('video/')||!f.parents?.includes(process.env.GOOGLE_DRIVE_FOLDER_ID))throw Error('File video non autorizzato');
 res.json({ok:true,pilota:s.pilota,url:f.webViewLink||'https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view'});
 }catch(e){fail(res,e)}};
