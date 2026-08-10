// One step of a tour: a sentence and, at most, one thing to do. The shape is
// shared by the two halves of a tour — `page.tour` hands it to the browser,
// `page.review` reads it off the pages it names without one — so a step is one
// vocabulary and not two.
export type Step = types.screen.Descriptor & {
    say?: string;
    open?: string | ({ url?: string } & types.screen.Descriptor);
    click?: types.screen.Descriptor;
    point?: types.screen.Descriptor;
    fill?: { form: string; values: Record<string, string | number | boolean> };
    submit?: string;
};
