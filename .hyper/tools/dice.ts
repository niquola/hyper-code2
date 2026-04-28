export default async function (
  _ctx: Context,
  opts?: types.tools.DiceOpts
) {
  const count = opts?.count ?? 1;
  const sides = opts?.sides ?? 6;
  const modifier = opts?.modifier ?? 0;

  if (count < 1 || count > 100) throw new Error('count must be 1-100');
  if (sides < 2 || sides > 100) throw new Error('sides must be 2-100');

  const arr = new Uint8Array(count);
  crypto.getRandomValues(arr);

  const rolls = Array.from(arr, b => (b % sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;

  return { notation: `${count}d${sides}${modifier ? (modifier > 0 ? '+' + modifier : modifier) : ''}`, rolls, modifier, total };
}