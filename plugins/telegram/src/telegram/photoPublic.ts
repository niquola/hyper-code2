/** Downloads one Telegram message photo and uploads it to a stable public GCS URL. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Telegram channel identifier. */ chat:string|number;
 /** Telegram message identifier. */ id:number;
}):Promise<string|null>{const chat=String(opts.chat),object=`tg/${chat.replace(/^-100/,"")}/${opts.id}.jpg`,url=`https://storage.googleapis.com/niquola-public/${object}`,path=`/tmp/telegram-${chat.replace(/[^0-9-]/g,"")}-${opts.id}.jpg`;const photo=await ctx.fns.telegram.photo({chat,id:opts.id,path});if(!photo)return null;try{await ctx.fns.gcs.upload({bucket:"niquola-public",object,file:photo.path,contentType:"image/jpeg"});return url}finally{try{await ctx.fns.files.remove({path:photo.path})}catch{}}}
