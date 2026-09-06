/**
 * The Chrome user-data directory this machine drives.
 *
 * Which profile Chrome opens is not a detail: the logins live there. Starting
 * on the wrong one looks exactly like "everything logged itself out", which is
 * why the choice is one function instead of a flag repeated at call sites.
 *
 * Order: CDP_USER_DATA_DIR wins; then the Hyper-owned location; then the
 * uniskill skill's directory, which is where the real 3.7 GB of sessions still
 * lives after the migration. Moving it is a deliberate step, not something this
 * function should do behind anyone's back.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ userDataDir: string; profile: string; legacy: boolean }> {
    const profile = ctx.env.CDP_PROFILE || "Profile 1";
    if (ctx.env.CDP_USER_DATA_DIR) return { userDataDir: ctx.env.CDP_USER_DATA_DIR, profile, legacy: false };

    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    const owned = `${home}/.hyper/browser/chrome-profile`;
    const legacy = `${home}/uniskill/skills/browser/chrome-profile`;
    const exists = async (dir: string) => await Bun.file(`${dir}/${profile}/Preferences`).exists();

    if (await exists(owned)) return { userDataDir: owned, profile, legacy: false };
    if (await exists(legacy)) return { userDataDir: legacy, profile, legacy: true };
    return { userDataDir: owned, profile, legacy: false };
}
