/** Checks whether the named Hyper Browser session has an authenticated Substack account.
 * @param opts.session Named Hyper Browser session used for Substack authentication checks.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Browser session name. @default substack */session?:string}={}):Promise<{loggedIn:boolean;email:string|null;url:string}>{const session=opts.session??"substack";await ctx.fns.browser.navigate({session,url:"https://substack.com/account/settings",settleMs:2500});const info=await ctx.fns.browser.evaluate({session,expression:`({url:location.href,email:(document.body.innerText.match(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/i)||[])[0]||null})`});return{loggedIn:!/\/sign-in|\/login/.test(info.url),email:info.email,url:info.url};}
