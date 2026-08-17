// ctx.state.procs?.modules — one record per MOUNTED module, built by loadFns and read by everything else:
// the tab strip, the module manager, the block the coding agent gets.
//
// Two halves, and the difference matters. **Meta** is what the module declared
// about itself — a name, a face, its config. **Introspection** is what it turns
// out to be, read off the files it ships and never declared: fns make it a
// library, a `GET /<namespace>` makes it a tab, a `$hook_service.*` makes it a
// provider, a SKILL.md makes it a skill, a `$loader_*` makes it the owner of a
// kind. Nothing here is a switch to set; it is a description of what was found.
export type State = Array<{
    // what it is and what it brought
    name: string;                       // the container: a folder, a package, the host itself
    namespaces: string[];               // the dotted names its files landed under
    // Neither of these is a module anybody manages, and a page that cannot tell
    // them apart lists the process twice under a name it invented.
    self?: boolean;                     // the process itself: the framework, or this host's own src
    prefix?: string | null;             // a supervised project, mounted under this prefix
    plugin?: boolean;                   // a container a project turns on and off — what /plugins is about
    // meta — declared
    label: string;
    icon: string;
    description: string;
    config: Record<string, any>;        // what workspace.json passed under this name
    optional: boolean;                  // waits to be named in workspace.json, and can be removed
    // Where its tab belongs when a host groups them: "left" is part of what is
    // being built (the clinical screens a project is written against), "right"
    // is the tooling around that work. A host that has one strip ignores it.
    place: "left" | "right";
    preview: { files: string; fn: string } | null;
    // where it came from
    source: "core" | "official" | "user" | "project" | "platform" | "external";
    from: string | null;                // the git url / package / path an external came from
    dir: string;                        // the module folder — manifest and SKILL.md live here
    // introspection — read off its files
    skill: string | null;
    tab: boolean;
    clients: string[];                  // the urls of the client.js files it ships
    fns: string[];
    routes: string[];
    hooks: string[];                    // extension points it answers
    loaders: string[];                  // kinds it owns
    provides: string[];                 // services, from $hook_service.<name>
}>;
