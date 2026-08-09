// The mechanism's own configuration, and only that: how long a token this
// process signs is good for, and whose *other* key it is willing to trust.
//
// Everything about doors — whether there is a login at all, who may open one,
// which provider answers for an identity — belongs to the app. The framework
// signs, verifies and reads a cookie; it has no opinion about who should be let
// in, and an app that gave it one would have to be forked to change its mind.
export default {
    // A session this process signs lasts this many days.
    days: { type: "integer", default: 30, env: "AUTH_DAYS" },
    // The name of the session cookie. An app that runs beside another one on the
    // same host needs its own, or the two sign each other out.
    cookie: { type: "string", default: "procs_session", env: "AUTH_COOKIE" },
    // An SPKI PEM accepted **in addition to** our own key. This is the whole
    // federation seam: a host that trusts another one adds its public key here
    // and nothing else changes.
    publicKey: { type: "string", default: "", env: "AUTH_PUBLIC_KEY" },
} as const satisfies ConfigSchema;
