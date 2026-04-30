export default async function () {
    return new Response(await Bun.file('src/events/client.js').text(), { headers: { 'content-type': 'application/javascript; charset=utf-8' } });
}
