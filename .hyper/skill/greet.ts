export default async function (_ctx: Context, _session: Session | null, opts: { name?: string } = {}) {
  const name = opts?.name?.trim() || "world";
  return `Hello, ${name}!`;
}