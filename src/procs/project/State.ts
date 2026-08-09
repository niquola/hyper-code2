// ctx.state.procs?.project — what this process is running.
export type State = {
    // namespace → directory for every service declared `runtime: "in-process"`.
    // project/modules reads it, services/start and stop write it; nothing else
    // knows the app is not an ordinary module.
    appRoots?: Record<string, string>;
};
