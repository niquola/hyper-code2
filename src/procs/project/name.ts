// What the project this process works on is CALLED — and, from here on, part of
// every url its pages have.
//
// It used to be whatever the folder happened to be called, read at the two or
// three places that needed a word for a title. That was fine while a name was
// decoration. It stops being fine when the name is a path segment: a page is
// `/ehr/patient/<id>/<project>/<app>`, and a project renamed by moving its
// folder would silently take every bookmark, every link inside a Task and every
// address a patient was mailed with it.
//
// So it is DECLARED — `package.json` `name`, or `workspace.json` `name` — and
// the folder is only the last resort, for a project that has neither yet. A
// scoped npm name (`@clinic/cardio`) keeps its last segment: the scope is who
// publishes it, not what it is called here.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    const workdir = ctx.fns.procs.project.workdir({});
    const declared = declaredIn(`${workdir}/package.json`) ?? declaredIn(`${workdir}/workspace.json`);
    return slug(declared ?? basename(workdir));
}

function declaredIn(file: string): string | null {
    try {
        const name = JSON.parse(readFileSync(file, "utf-8"))?.name;
        return typeof name === "string" && name.trim() ? name.trim() : null;
    } catch { return null; }
}

// One path segment: lower case, letters, digits and dashes. A name that cannot
// be one is not refused here — `apps.generate` is where a bad name has to be a
// visible error — but what comes out of this function is always usable in a url.
export function slug(name: string): string {
    const last = name.split("/").filter(Boolean).pop() ?? name;
    return last.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
}
