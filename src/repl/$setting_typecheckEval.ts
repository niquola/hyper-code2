export default {
    type: "boolean",
    default: true,
    env: "EVAL_TYPECHECK",
    title: "Typecheck eval before execution",
    description: "Use the in-process TypeScript Language Service to reject invalid eval code before it runs.",
};
