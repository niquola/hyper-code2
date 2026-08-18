/**
 * Resolve compact attachment refs into provider-ready content blocks
 *
 * Loads attachment bytes immediately before an LLM request. Images become inline image blocks, PDFs become native document blocks with extracted-text fallback, and text files become bounded manifests.
 * @param opts.messages Canonical transcript messages containing compact attachment refs.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Canonical transcript messages containing compact attachment refs. */
        messages: any[];
    },
): Promise<any[]> {
    const messages=JSON.parse(JSON.stringify(opts.messages));for(const message of messages){if(!Array.isArray(message?.content))continue;const out:any[]=[];for(const part of message.content){if(part?.type!=="image_ref"&&part?.type!=="document_ref"){out.push(part);continue;}const rows=await ctx.fns.procs.db.select({sql:"SELECT * FROM attachments WHERE id=?",params:[part.attachmentId]}) as any[],row=rows[0];if(!row||!await Bun.file(String(row.storage_path)).exists()){out.push({type:"text",text:`[Attachment unavailable: ${part.fileName}]`});continue;}const path=String(row.storage_path),fileName=String(row.original_name??row.file_name),label=`[Attached file: ${fileName}\nMIME: ${row.mime_type}\nSize: ${row.size_bytes} bytes\nLocal path: ${path}]`;if(part.type==="image_ref"){const data=Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64");out.push(Buffer.byteLength(data)<=4.5*1024*1024?{type:"image",data,mimeType:String(row.mime_type)}:{type:"text",text:label+"\nToo large for inline vision; inspect with tools."});}else if(String(row.mime_type)==="application/pdf"&&Number(row.size_bytes)<=20*1024*1024){const data=Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64");out.push({type:"document",data,mimeType:"application/pdf",fileName,extractedText:row.extracted_text==null?undefined:String(row.extracted_text),path});}else out.push({type:"text",text:label+(row.extracted_text?`\n\nContents:\n${String(row.extracted_text)}`:"\nUse tools to inspect this file.")});}message.content=out;}return messages;
}
